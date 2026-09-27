import { NextRequest, NextResponse } from "next/server"

const DEFAULT_PARSER_URL = process.env.VIBER_PARSER_URL || "http://127.0.0.1:8080"
const UPSTREAM_TIMEOUT_MS = 65_000
/**
 * Статус опрашивается каждые пару секунд, но сервис сбора занят работой с
 * устройством и может отвечать с задержкой. Короткий таймаут превращал
 * медленный ответ в «сервис офлайн», поэтому ждём заметно дольше.
 */
const STATUS_UPSTREAM_TIMEOUT_MS = 20_000
/** Таймаут на установление SSE-соединения с апстримом. */
const SSE_CONNECT_TIMEOUT_MS = 10_000
/** Через сколько браузер должен повторить попытку, когда апстрим недоступен. */
const SSE_STUB_RETRY_MS = 10_000


interface RouteContext {
  params: { path: string[] }
}

function jsonError(error: string, status: number, headers?: HeadersInit) {
  return NextResponse.json({ error }, { status, headers })
}

/**
 * Открывает поток событий апстрима с таймаутом на УСТАНОВЛЕНИЕ соединения.
 * Таймаут на всё время жизни ставить нельзя — он оборвал бы живой SSE-поток,
 * а без таймаута мёртвый апстрим оставляет висящий fetch в процессе Next.
 */
async function openUpstreamStream(url: string) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), SSE_CONNECT_TIMEOUT_MS)
  try {
    return await fetch(url, {
      headers: { Accept: "text/event-stream" },
      cache: "no-store",
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Ответ, на котором нативный EventSource переподключится сам: он делает это
 * только при 200 + text/event-stream, на любом другом ответе уходит в CLOSED.
 */
function reconnectableStreamStub(reason: string) {
  return new Response(`retry: ${SSE_STUB_RETRY_MS}
: ${reason}

`, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  })
}

/**
 * Транспортная неудача: сервис не ответил вовремя или недоступен.
 * Возвращаем HTTP-ошибку, а не «сервис офлайн» — клиент должен отличать
 * обрыв связи от честного состояния сервиса.
 */
function upstreamFailure(error: unknown) {
  const timedOut = error instanceof Error && error.name === "TimeoutError"
  return jsonError(
    timedOut
      ? "Сервис сбора данных не ответил вовремя"
      : "Нет связи с сервисом сбора данных",
    timedOut ? 504 : 502
  )
}

/**
 * Ответы апстрима кешируются, поэтому ручное обновление в панели должно уметь
 * обойти кеш: параметр `refresh` пробрасываем как есть.
 */
function forwardRefresh(request: NextRequest, url: URL) {
  if (request.nextUrl.searchParams.has("refresh")) {
    url.searchParams.set("refresh", "1")
  }
  return url
}

function parserOrigin() {
  const configured = process.env.VIBER_PARSER_URL?.trim() || DEFAULT_PARSER_URL
  const url = new URL(configured)
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("VIBER_PARSER_URL must use http or https")
  }
  return url.origin
}

async function forwardUpstream(
  request: NextRequest,
  context: RouteContext,
  method: "PATCH" | "PUT" | "DELETE"
) {
  const pathParts = context.params.path || []
  const route = pathParts.join("/")
  const origin = parserOrigin()
  const search = request.nextUrl.search
  const init: RequestInit = {
    method,
    cache: "no-store",
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  }
  if (method !== "DELETE") {
    const bodyText = await request.text()
    init.headers = {
      "Content-Type": request.headers.get("content-type") || "application/json",
    }
    init.body = bodyText || undefined
  }

  const upstream = await fetch(`${origin}/api/${route}${search}`, init)
  if (upstream.status === 204) {
    return new NextResponse(null, { status: 204 })
  }

  const contentType = upstream.headers.get("content-type") || ""
  if (contentType.includes("application/json")) {
    const data = await upstream.json()
    return NextResponse.json(data, { status: upstream.status })
  }
  return new Response(upstream.body, {
    status: upstream.status,
    headers: { "Content-Type": contentType },
  })
}

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: NextRequest, context: RouteContext) {
  const pathParts = context.params.path || []
  const route = pathParts.join("/")
  const origin = parserOrigin()
  const search = request.nextUrl.search

  try {
    // 1. Status: /api/viber/status
    // Сетевая ошибка или таймаут НЕ возвращают «сервис офлайн»: они уходят во
    // внешний catch и отдают 502/504, чтобы клиент отличил обрыв связи от
    // реально недоступного сервиса и сохранил последнее известное состояние.
    if (route === "status") {
      const deviceId = request.nextUrl.searchParams.get("deviceId")
      const upstreamTasksUrl = deviceId
        ? `${origin}/api/tasks?deviceId=${encodeURIComponent(deviceId)}`
        : `${origin}/api/tasks`

      const tasksRes = await fetch(upstreamTasksUrl, {
        cache: "no-store",
        signal: AbortSignal.timeout(STATUS_UPSTREAM_TIMEOUT_MS),
      })

      if (!tasksRes.ok) {
        return NextResponse.json({
          state: "ERROR",
          isDriverActive: false,
          taskId: null,
          latestTaskStatus: null,
          currentStep: null,
          progress: null,
          groupName: null,
          error: `Сервис сбора данных ответил ошибкой (${tasksRes.status})`,
        })
      }

      const allTasks = (await tasksRes.json()) as Array<{
        id: string
        status: string
        groupTarget: string
        deviceId?: string | null
        groupName?: string | null
        currentStep?: string | null
        progress?: Record<string, unknown>
      }>

      const tasks = deviceId
        ? allTasks.filter((t) => {
            if (!t.deviceId || t.deviceId === "default") return true
            if (t.deviceId === deviceId) return true
            // Сопоставление имени инстанса и сетевого serial
            const devLower = deviceId.toLowerCase()
            const taskDevLower = (t.deviceId || "").toLowerCase()
            if (devLower === "worker" && (taskDevLower.includes(":5555") || taskDevLower === "worker")) return true
            if (devLower === "worker-2" && (taskDevLower.includes(":5556") || taskDevLower === "worker-2")) return true
            return false
          })
        : allTasks

      const activeTask = tasks.find(
        (t) => t.status === "initializing" || t.status === "starting" || t.status === "running"
      )

      if (activeTask) {
        const rawStep = activeTask.currentStep as unknown
        const stepName =
          typeof rawStep === "object" && rawStep !== null && "step" in rawStep
            ? String((rawStep as { step: unknown }).step)
            : typeof rawStep === "string"
              ? rawStep
              : null

        return NextResponse.json({
          state: activeTask.status === "running" ? "RUNNING" : "INITIALIZING",
          isDriverActive: true,
          taskId: activeTask.id,
          latestTaskStatus: activeTask.status,
          currentStep: stepName,
          progress: activeTask.progress ?? null,
          groupName: activeTask.groupName ?? activeTask.groupTarget,
        })
      }

      const latestTask = tasks[0]
      return NextResponse.json({
        state: latestTask && latestTask.status === "error" ? "ERROR" : "IDLE",
        isDriverActive: true,
        taskId: latestTask ? latestTask.id : null,
        latestTaskStatus: latestTask ? latestTask.status : null,
        currentStep: null,
        progress: latestTask?.progress ?? null,
        groupName: latestTask?.groupName ?? latestTask?.groupTarget ?? null,
      })
    }

    // 2. Groups: /api/viber/groups
    if (route === "groups") {
      const deviceId = request.nextUrl.searchParams.get("deviceId")
      const onDevice = request.nextUrl.searchParams.get("onDevice")
      const groupsUrl = new URL(`${origin}/api/groups`)
      groupsUrl.searchParams.set("all", "true")
      if (deviceId) {
        groupsUrl.searchParams.set("deviceId", deviceId)
      }
      // Мониторингу нужны только группы, открытые на инстансе; панели парсера —
      // весь список вместе с архивом, поэтому флаг проносится как есть.
      if (onDevice) {
        groupsUrl.searchParams.set("onDevice", onDevice)
      }
      forwardRefresh(request, groupsUrl)

      const res = await fetch(groupsUrl.toString(), {
        cache: "no-store",
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      })

      const data = await res.json().catch(() => null)
      if (!res.ok) {
        const payload = data as { message?: string; error?: string } | null
        const message = payload?.message || payload?.error || "Не удалось загрузить группы: устройство недоступно"
        return jsonError(message, res.status)
      }

      const list = (data ?? []) as Array<{
        id: number
        type: number
        groupId: string | null
        name: string | null
        messageCount: number
        participantCount: number
        lastMessageDate?: string | null
        unreadCount?: number
        onDevice?: boolean
      }>

      // Подтягиваем статус синхронизации с базой данных (Supabase)
      const syncGroupMap = new Map<number | string, { participantCount: number; activeMembers?: number; lastSyncedAt?: string }>()
      try {
        const syncRes = await fetch(`${origin}/api/users/sync/status`, {
          cache: "no-store",
          signal: AbortSignal.timeout(10000),
        })
        if (syncRes && typeof syncRes.json === "function") {
          const syncData = await syncRes.json().catch(() => null)
          if (Array.isArray(syncData?.groups)) {
            for (const sg of syncData.groups) {
              if (sg.conversationId !== undefined && sg.conversationId !== null) {
                syncGroupMap.set(Number(sg.conversationId), {
                  participantCount: sg.participantCount ?? 0,
                  activeMembers: sg.activeMembers,
                  lastSyncedAt: sg.lastSyncedAt,
                })
              }
              if (sg.groupKey) {
                syncGroupMap.set(String(sg.groupKey), {
                  participantCount: sg.participantCount ?? 0,
                  activeMembers: sg.activeMembers,
                  lastSyncedAt: sg.lastSyncedAt,
                })
              }
            }
          }
        }
      } catch {
        // Игнорируем: если Supabase недоступен, отдаем данные эмулятора
      }

      const groups = list.map((g) => {
        const syncInfo = syncGroupMap.get(g.id) ?? (g.groupId ? syncGroupMap.get(String(g.groupId)) : undefined)
        const dbCount = syncInfo?.participantCount ?? 0
        return {
          conversationId: g.id,
          groupId: g.groupId ?? null,
          name: g.name,
          conversationType: g.type,
          memberCount: g.participantCount,
          emulatorParticipantCount: g.participantCount,
          dbParticipantCount: dbCount,
          storedParticipantCount: dbCount,
          hasStoredData: dbCount > 0,
          messageCount: g.messageCount,
          lastMessageDate: g.lastMessageDate,
          lastSyncedAt: syncInfo?.lastSyncedAt ?? null,
          unreadCount: g.unreadCount,
          onDevice: g.onDevice,
        }
      })

      return NextResponse.json({
        count: groups.length,
        groups,
      })
    }

    // 3. Group Members: /api/viber/groups/:id/members or /api/viber/groups/:id/participants
    if (
      pathParts.length === 3 &&
      pathParts[0] === "groups" &&
      (pathParts[2] === "members" || pathParts[2] === "participants")
    ) {
      const groupTargetId = pathParts[1]
      const requestedSource = request.nextUrl.searchParams.get("source") || "supabase"
      const deviceId = request.nextUrl.searchParams.get("deviceId")

      const targetUrl = requestedSource === "emulator"
        ? new URL(`${origin}/api/groups/${encodeURIComponent(groupTargetId)}/participants`)
        : new URL(`${origin}/api/users/group/${encodeURIComponent(groupTargetId)}`)

      if (deviceId && requestedSource === "emulator") {
        targetUrl.searchParams.set("deviceId", deviceId)
      }
      forwardRefresh(request, targetUrl)

      let res = await fetch(targetUrl.toString(), {
        cache: "no-store",
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      })

      let actualSource = requestedSource
      // Если при запросе к Supabase произошла ошибка, пробуем эмулятор как запасной вариант
      if (!res.ok && requestedSource === "supabase") {
        const fallbackUrl = new URL(`${origin}/api/groups/${encodeURIComponent(groupTargetId)}/participants`)
        if (deviceId) fallbackUrl.searchParams.set("deviceId", deviceId)
        forwardRefresh(request, fallbackUrl)
        try {
          const fallbackRes = await fetch(fallbackUrl.toString(), {
            cache: "no-store",
            signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
          })
          if (fallbackRes.ok) {
            res = fallbackRes
            actualSource = "emulator"
          }
        } catch {
          // ignore fallback error
        }
      }

      if (!res.ok) {
        return jsonError(`Failed to fetch group members for ID ${groupTargetId}`, res.status)
      }

      const participants = (await res.json()) as Array<{
        id: number
        memberId: string | null
        number: string | null
        name: string | null
        contactName: string | null
        viberName: string | null
        groupRole: number | null
        roleLabel: string
        active: boolean
        isSelf?: boolean
        isOnline?: boolean
        lastSeen?: string | null
      }>

      const members = participants.map((p) => {
        const rawNumber = p.number?.trim() || ""
        const isEncrypted = !rawNumber || rawNumber.toLowerCase().startsWith("em")
        const isDecoded = !isEncrypted
        return {
          participantId: p.id,
          memberId: p.memberId,
          encryptedMemberId: isEncrypted ? rawNumber : null,
          phoneNumber: isDecoded ? rawNumber : "Ожидает дешифровки",
          rawNumber: rawNumber || null,
          isDecoded,
          name: p.name || p.viberName || p.contactName || null,
          roleLabel: p.roleLabel,
          isSelf: p.isSelf ?? (p.id === 1),
          isOnline: p.isOnline,
          lastSeen: p.lastSeen,
        }
      })

      const parsedConversationId = Number.parseInt(groupTargetId, 10)
      const conversationId = Number.isFinite(parsedConversationId) ? parsedConversationId : groupTargetId

      // Полную копию исходных участников не отдаём: клиент её не читает,
      // а ответ на большой группе становится вдвое тяжелее.
      return NextResponse.json({
        conversationId,
        count: members.length,
        source: actualSource,
        members,
      })
    }

    // 4. Group Detail: /api/viber/groups/:id
    if (pathParts.length === 2 && pathParts[0] === "groups") {
      const groupId = pathParts[1]
      const res = await fetch(`${origin}/api/groups/${groupId}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      })
      const data = await res.json()
      return NextResponse.json(data, { status: res.status })
    }

    // 5. Database stats: /api/viber/database/stats
    if (route === "database/stats") {
      const deviceId = request.nextUrl.searchParams.get("deviceId")
      const statsUrl = new URL(`${origin}/api/database/stats`)
      if (deviceId) {
        statsUrl.searchParams.set("deviceId", deviceId)
      }
      forwardRefresh(request, statsUrl)
      const res = await fetch(statsUrl.toString(), {
        cache: "no-store",
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      })
      const data = await res.json()
      return NextResponse.json(data, { status: res.status })
    }

    // 6. SSE Task Events: /api/viber/tasks/:id/events
    if (
      pathParts.length === 3 &&
      pathParts[0] === "tasks" &&
      pathParts[2] === "events"
    ) {
      const taskId = pathParts[1]
      const upstream = await openUpstreamStream(`${origin}/api/tasks/${taskId}/events`)

      // Не выдаём 200 и пустой поток поверх ошибки апстрима: иначе клиент
      // видит «открылся и закрылся» и бесконечно переподключается к 404.
      //
      // ОГРАНИЧЕНИЕ: панель трактует 404 как «задачи больше нет» и перестаёт её
      // отслеживать. Это верно только для одного инстанса API — реестр задач
      // живёт в памяти процесса (src/tasks/tasks.service.ts). При нескольких
      // репликах (Railway) запрос может попасть в другую реплику, и 404 будет
      // ложным; поток событий там не работает в принципе — нужен общий стор.
      if (!upstream.ok) {
        await upstream.body?.cancel()
        return jsonError(
          upstream.status === 404
            ? `Задача ${taskId} не найдена`
            : `Поток событий недоступен (${upstream.status})`,
          upstream.status
        )
      }

      return new Response(upstream.body, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      })
    }

    // 7. Task Participants: /api/viber/tasks/:id/participants
    if (
      pathParts.length === 3 &&
      pathParts[0] === "tasks" &&
      pathParts[2] === "participants"
    ) {
      const taskId = pathParts[1]
      const res = await fetch(`${origin}/api/tasks/${taskId}/participants`, {
        cache: "no-store",
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      })
      const data = await res.json()
      return NextResponse.json(data, { status: res.status })
    }

    // 8. Single Task: /api/viber/tasks/:id
    if (pathParts.length === 2 && pathParts[0] === "tasks") {
      const taskId = pathParts[1]
      const res = await fetch(`${origin}/api/tasks/${taskId}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      })
      const data = await res.json()
      return NextResponse.json(data, { status: res.status })
    }

    // 9. Tasks list: /api/viber/tasks
    if (route === "tasks") {
      const res = await fetch(`${origin}/api/tasks${search}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      })
      const data = await res.json()
      return NextResponse.json(data, { status: res.status })
    }

    // 10. SSE Messages Events: /api/viber/messages/events or /api/viber/messages/monitor/events
    if (route === "messages/events" || route === "messages/monitor/events") {
      // Потребитель ленты монитора полагается на нативный авто-реконнект
      // EventSource, а тот работает только при 200 + text/event-stream: на любом
      // другом ответе поток уходит в CLOSED навсегда. Поэтому и ошибку апстрима,
      // и его полное отсутствие (ECONNREFUSED при ручном перезапуске API)
      // отдаём как корректный поток с `retry:`.
      let upstream: Response
      try {
        upstream = await openUpstreamStream(`${origin}/api/messages/monitor/events`)
      } catch (error) {
        const timedOut = error instanceof Error && error.name === "AbortError"
        return reconnectableStreamStub(
          timedOut ? "upstream did not respond in time" : "upstream unavailable"
        )
      }

      if (!upstream.ok) {
        await upstream.body?.cancel()
        return reconnectableStreamStub(`upstream unavailable (${upstream.status})`)
      }

      return new Response(upstream.body, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        },
      })
    }

    // 11. Export monitored messages: /api/viber/messages/monitored/export
    if (route === "messages/monitored/export") {
      const res = await fetch(`${origin}/api/messages/monitored/export${search}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      })
      const headers = new Headers()
      headers.set(
        "Content-Type",
        res.headers.get("content-type") || "application/octet-stream"
      )
      headers.set("Cache-Control", "no-store")
      const disposition = res.headers.get("content-disposition")
      if (disposition) {
        headers.set("Content-Disposition", disposition)
      }
      return new Response(res.body, { status: res.status, headers })
    }

    // 12. Monitored Messages list: /api/viber/messages/monitored
    if (route === "messages/monitored") {
      try {
        const res = await fetch(`${origin}/api/messages/monitored${search}`, {
          cache: "no-store",
          signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
        })
        if (res.ok) {
          const data = await res.json()
          return NextResponse.json(data, { status: res.status })
        }
      } catch {
        // upstream error
      }
      return NextResponse.json([])
    }

    // 13. Messages monitor status: /api/viber/messages/monitor/status
    // Строку запроса проносим насквозь: статус фильтруется по ?deviceId=.
    if (route === "messages/monitor/status") {
      const res = await fetch(`${origin}/api/messages/monitor/status${search}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      })
      const data = await res.json()
      return NextResponse.json(data, { status: res.status })
    }

    // 14. QR auth status: /api/viber/auth/qr/status
    // Отдельным маршрутом, а не общим проксированием: статус опрашивается
    // каждые пару секунд и должен жить по своему, короткому таймауту.
    if (route === "auth/qr/status" || route === "viber/auth/qr/status") {
      const res = await fetch(`${origin}/api/auth/qr/status${search}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(STATUS_UPSTREAM_TIMEOUT_MS),
      })
      const data = await res.json()
      return NextResponse.json(data, { status: res.status })
    }

    // Fallback GET proxy
    const fallbackRes = await fetch(`${origin}/api/${route}${search}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    })
    const contentType = fallbackRes.headers.get("content-type") || ""
    if (contentType.includes("application/json")) {
      const data = await fallbackRes.json()
      return NextResponse.json(data, { status: fallbackRes.status })
    }
    return new Response(fallbackRes.body, {
      status: fallbackRes.status,
      headers: { "Content-Type": contentType },
    })
  } catch (error) {
    return upstreamFailure(error)
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const pathParts = context.params.path || []
  const route = pathParts.join("/")
  const origin = parserOrigin()
  const search = request.nextUrl.search

  try {
    // 1. Start Session: /api/viber/start (legacy)
    if (route === "start") {
      return NextResponse.json({ message: "Сессия активна и готова к сбору" })
    }

    // 2. Stop Session: /api/viber/stop
    if (route === "stop") {
      try {
        const tasksRes = await fetch(`${origin}/api/tasks`, { cache: "no-store" })
        if (tasksRes.ok) {
          const tasks = (await tasksRes.json()) as Array<{ id: string; status: string }>
          const activeTasks = tasks.filter(
            (t) => t.status === "initializing" || t.status === "starting" || t.status === "running"
          )
          for (const t of activeTasks) {
            await fetch(`${origin}/api/tasks/${t.id}/stop`, { method: "POST" })
          }
        }
      } catch {
        // ignore
      }
      return NextResponse.json({ message: "Сбор успешно остановлен" })
    }

    // 3. Stop specific task: /api/viber/tasks/:id/stop
    if (
      pathParts.length === 3 &&
      pathParts[0] === "tasks" &&
      pathParts[2] === "stop"
    ) {
      const taskId = pathParts[1]
      const res = await fetch(`${origin}/api/tasks/${taskId}/stop`, { method: "POST" })
      const data = await res.json()
      return NextResponse.json(data, { status: res.status })
    }

    // 4. Collect / Scroll: /api/viber/participants/collect or legacy scroll-members / scroll-50
    if (
      route === "participants/collect" ||
      route === "scroll-members" ||
      route === "scroll-50" ||
      route === "parser/scroll-members" ||
      route === "parser/scroll-50" ||
      route === "collect"
    ) {
      let body: Record<string, unknown> = {}
      try {
        body = (await request.json()) as Record<string, unknown>
      } catch {
        body = {}
      }

      const group =
        typeof body.group === "string" && body.group.trim()
          ? body.group.trim()
          : typeof body.groupName === "string"
            ? body.groupName.trim()
            : ""

      if (!group) {
        return jsonError("group is required", 400)
      }

      const pageLimit =
        typeof body.pageLimit === "number"
          ? body.pageLimit
          : typeof body.limit === "number"
            ? body.limit
            : undefined

      const scrollPages = typeof body.scrollPages === "number" ? body.scrollPages : undefined
      const allowPartial = typeof body.allowPartial === "boolean" ? body.allowPartial : undefined
      const restartApp = typeof body.restartApp === "boolean" ? body.restartApp : undefined
      const forceRefresh = typeof body.forceRefresh === "boolean" ? body.forceRefresh : undefined
      const deviceId = typeof body.deviceId === "string" ? body.deviceId : undefined

      const collectRes = await fetch(`${origin}/api/participants/collect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          group,
          pageLimit,
          scrollPages,
          allowPartial,
          restartApp,
          forceRefresh,
          deviceId,
        }),
      })

      const collectPayload = (await collectRes.json()) as {
        taskId?: string
        message?: string
      }

      if (!collectRes.ok) {
        return jsonError(
          collectPayload.message || "Не удалось запустить сбор участников",
          collectRes.status
        )
      }

      return NextResponse.json({
        message: "Сбор участников запущен",
        groupName: group,
        group,
        limit: pageLimit ?? 50,
        pageLimit,
        clearDatabase: false,
        taskId: collectPayload.taskId,
      })
    }

    // 5. Decode: /api/viber/database/decode or /api/viber/participants/decode
    if (route === "database/decode" || route === "participants/decode") {
      let body: Record<string, unknown> = {}
      try {
        body = (await request.json()) as Record<string, unknown>
      } catch {
        body = {}
      }

      const deviceId =
        (typeof body.deviceId === "string" ? body.deviceId : null) ||
        request.nextUrl.searchParams.get("deviceId")
      const decodeUrl = deviceId
        ? `${origin}/api/database/decode?deviceId=${encodeURIComponent(deviceId)}`
        : `${origin}/api/database/decode`

      const decodeRes = await fetch(decodeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dryRun: body.dryRun ?? false,
          includeSelf: body.includeSelf ?? false,
          limit: typeof body.limit === "number" ? body.limit : undefined,
          restartApp: typeof body.restartApp === "boolean" ? body.restartApp : true,
          waitForSyncSeconds: typeof body.waitForSyncSeconds === "number" ? body.waitForSyncSeconds : 10,
        }),
      })

      const decodePayload = (await decodeRes.json()) as Record<string, unknown>

      if (!decodeRes.ok) {
        return jsonError(
          String(decodePayload.message || "Ошибка дешифровки базы данных"),
          decodeRes.status
        )
      }

      return NextResponse.json({
        dryRun: decodePayload.dryRun ?? false,
        read: decodePayload.read ?? 0,
        decodedCount: decodePayload.decodedCount ?? 0,
        updated: decodePayload.updated ?? 0,
        changedRows: decodePayload.changedRows ?? 0,
        skippedCount: decodePayload.skippedCount ?? 0,
        invalidCount: decodePayload.invalidCount ?? 0,
        backupPath: null,
        decoded: decodePayload.decoded ?? [],
      })
    }

    // 6. Database Sync: /api/viber/database/sync or /api/viber/clear-database
    if (
      route === "database/sync" ||
      route === "clear-database" ||
      route === "parser/clear-database"
    ) {
      const deviceId = request.nextUrl.searchParams.get("deviceId")
      const syncUrl = deviceId
        ? `${origin}/api/database/sync?deviceId=${encodeURIComponent(deviceId)}`
        : `${origin}/api/database/sync`

      const syncRes = await fetch(syncUrl, { method: "POST" })
      const syncPayload = (await syncRes.json()) as Record<string, unknown>

      return NextResponse.json({
        message: syncPayload.message || "Данные успешно синхронизированы",
        ...syncPayload,
      })
    }

    // 7. Messages monitor start: /api/viber/messages/monitor/start
    if (route === "messages/monitor/start") {
      const bodyText = await request.text()
      const res = await fetch(`${origin}/api/messages/monitor/start${search}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: bodyText || "{}",
      })
      const data = await res.json()
      return NextResponse.json(data, { status: res.status })
    }

    // 8. Messages monitor stop: /api/viber/messages/monitor/stop
    if (route === "messages/monitor/stop") {
      const res = await fetch(`${origin}/api/messages/monitor/stop${search}`, { method: "POST" })
      const data = await res.json()
      return NextResponse.json(data, { status: res.status })
    }

    // 9. Auth phone: /api/viber/auth/phone
    if (route === "auth/phone" || route === "viber/auth/phone") {
      const bodyText = await request.text()
      const authRes = await fetch(`${origin}/api/auth/phone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: bodyText || undefined,
      })
      const data = await authRes.json()
      return NextResponse.json(data, { status: authRes.status })
    }

    // 10. Auth code: /api/viber/auth/code
    if (route === "auth/code" || route === "viber/auth/code") {
      const bodyText = await request.text()
      const authRes = await fetch(`${origin}/api/auth/code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: bodyText || undefined,
      })
      const data = await authRes.json()
      return NextResponse.json(data, { status: authRes.status })
    }

    // 11. QR auth start / cancel: /api/viber/auth/qr/start, /api/viber/auth/qr/cancel
    if (
      route === "auth/qr/start" ||
      route === "viber/auth/qr/start" ||
      route === "auth/qr/cancel" ||
      route === "viber/auth/qr/cancel"
    ) {
      const action = route.endsWith("cancel") ? "cancel" : "start"
      const qrBody = await request.text()
      const qrRes = await fetch(`${origin}/api/auth/qr/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: qrBody || undefined,
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      })
      const data = await qrRes.json()
      return NextResponse.json(data, { status: qrRes.status })
    }

    // Fallback POST proxy
    const bodyText = await request.text()
    const fallbackRes = await fetch(`${origin}/api/${route}${search}`, {
      method: "POST",
      headers: { "Content-Type": request.headers.get("content-type") || "application/json" },
      body: bodyText || undefined,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    })

    const contentType = fallbackRes.headers.get("content-type") || ""
    if (contentType.includes("application/json")) {
      const data = await fallbackRes.json()
      return NextResponse.json(data, { status: fallbackRes.status })
    }
    return new Response(fallbackRes.body, {
      status: fallbackRes.status,
      headers: { "Content-Type": contentType },
    })
  } catch (error) {
    return upstreamFailure(error)
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    return await forwardUpstream(request, context, "PATCH")
  } catch (error) {
    return upstreamFailure(error)
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    return await forwardUpstream(request, context, "PUT")
  } catch (error) {
    return upstreamFailure(error)
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    return await forwardUpstream(request, context, "DELETE")
  } catch (error) {
    return upstreamFailure(error)
  }
}