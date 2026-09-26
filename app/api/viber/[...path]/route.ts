import { NextRequest, NextResponse } from "next/server"

import {
  buildStatusPayload,
  composeAbortSignals,
  createSseHeartbeatStream,
  matchProxyRoute,
  sanitizeCollectBody,
  sanitizeDecodeBody,
  type ProxyMatch,
  type ProxyMethod,
} from "@/lib/viber-parser/proxy"
import type { TaskDetailDto, TaskSummaryDto } from "@/lib/viber-parser/types"

const DEFAULT_PARSER_URL = "http://127.0.0.1:3001"

/** Опрос статуса и деталей задачи: короткий бюджет, чтобы поллинг не залипал. */
const STATUS_TIMEOUT_MS = 15_000
/** Обычные управляющие POST/GET-запросы. */
const DEFAULT_TIMEOUT_MS = 65_000
/** Дешифровка: рестарт Viber + сетевой синк контактов. */
const DECODE_TIMEOUT_MS = 360_000
/** Снятие снимка БД: бут LDPlayer до 180 с. */
const SYNC_TIMEOUT_MS = 240_000
/** Экспорт сообщений: ждём только заголовки, тело стримится сколько нужно. */
const EXPORT_HEADERS_TIMEOUT_MS = 65_000
/** Периодичность heartbeat в SSE-прокси. */
const SSE_PING_MS = 15_000

interface RouteContext {
  params: { path: string[] }
}

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status })
}

function parserOrigin() {
  const configured = process.env.VIBER_PARSER_URL?.trim() || DEFAULT_PARSER_URL
  const url = new URL(configured)
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("VIBER_PARSER_URL must use http or https")
  }
  return url.origin
}

function combinedSignal(request: NextRequest, timeoutMs: number): AbortSignal {
  return composeAbortSignals([AbortSignal.timeout(timeoutMs), request.signal])
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text().catch(() => "")
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return { message: text }
  }
}

function upstreamMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object") {
    const record = payload as { message?: unknown; error?: unknown }
    if (typeof record.message === "string" && record.message) return record.message
    if (Array.isArray(record.message) && record.message.length > 0) {
      return record.message.map(String).join("; ")
    }
    if (typeof record.error === "string" && record.error) return record.error
  }
  return fallback
}

function isTimeout(error: unknown): boolean {
  return error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")
}

function failure(error: unknown, request: NextRequest, unavailableStatus = 502) {
  if (request.signal?.aborted) {
    // Клиент ушёл — отвечать уже некому.
    return new NextResponse(null, { status: 499 })
  }
  if (isTimeout(error)) {
    return jsonError("Бэкенд Viber не ответил вовремя", 504)
  }
  return jsonError("Бэкенд Viber недоступен", unavailableStatus)
}

type UpstreamInit = {
  method?: ProxyMethod
  body?: unknown
  rawBody?: string
  contentType?: string
  timeoutMs?: number
}

async function callUpstream(
  request: NextRequest,
  path: string,
  init: UpstreamInit = {}
): Promise<Response> {
  const origin = parserOrigin()
  const method = init.method ?? "GET"
  const headers: Record<string, string> = {}
  let body: string | undefined

  if (init.body !== undefined) {
    headers["Content-Type"] = "application/json"
    body = JSON.stringify(init.body)
  } else if (init.rawBody !== undefined) {
    headers["Content-Type"] = init.contentType || "application/json"
    body = init.rawBody
  }

  return fetch(`${origin}${path}`, {
    method,
    cache: "no-store",
    headers: Object.keys(headers).length > 0 ? headers : undefined,
    body,
    signal: combinedSignal(request, init.timeoutMs ?? DEFAULT_TIMEOUT_MS),
  })
}

/** Прозрачно отдаёт JSON бэкенда, а ошибки приводит к единому формату { error }. */
async function passthroughJson(
  request: NextRequest,
  path: string,
  init: UpstreamInit = {},
  fallbackError = "Бэкенд Viber вернул ошибку"
) {
  const upstream = await callUpstream(request, path, init)
  if (upstream.status === 204) {
    return new NextResponse(null, { status: 204 })
  }
  const payload = await readJson(upstream)
  if (!upstream.ok) {
    return jsonError(upstreamMessage(payload, fallbackError), upstream.status)
  }
  return NextResponse.json(payload ?? null, { status: upstream.status })
}

async function proxySse(request: NextRequest, path: string) {
  const origin = parserOrigin()
  const upstream = await fetch(`${origin}${path}`, {
    headers: { Accept: "text/event-stream" },
    cache: "no-store",
    signal: request.signal,
  })

  if (!upstream.ok) {
    const payload = await readJson(upstream)
    return jsonError(
      upstreamMessage(payload, `Поток событий недоступен (${upstream.status})`),
      upstream.status
    )
  }

  const contentType = upstream.headers.get("content-type") ?? ""
  if (!contentType.includes("text/event-stream") || !upstream.body) {
    await upstream.body?.cancel().catch(() => undefined)
    return jsonError("Бэкенд вернул не поток событий", 502)
  }

  const stream = upstream.body.pipeThrough(createSseHeartbeatStream(SSE_PING_MS))

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}

async function handleStatus(request: NextRequest) {
  const origin = parserOrigin()
  const tasksRes = await fetch(`${origin}/api/tasks`, {
    cache: "no-store",
    signal: combinedSignal(request, STATUS_TIMEOUT_MS),
  })

  if (!tasksRes.ok) {
    const payload = await readJson(tasksRes)
    return jsonError(
      upstreamMessage(payload, `Бэкенд Viber ответил ${tasksRes.status}`),
      tasksRes.status >= 500 ? 503 : tasksRes.status
    )
  }

  const raw = await readJson(tasksRes)
  const tasks = Array.isArray(raw) ? (raw as TaskSummaryDto[]) : []
  const preview = buildStatusPayload({ tasks, detail: null, fetchedAt: new Date().toISOString() })

  let detail: TaskDetailDto | null = null
  if (preview.taskId) {
    try {
      const detailRes = await fetch(`${origin}/api/tasks/${encodeURIComponent(preview.taskId)}`, {
        cache: "no-store",
        signal: combinedSignal(request, STATUS_TIMEOUT_MS),
      })
      if (detailRes.ok) {
        const detailPayload = await readJson(detailRes)
        if (detailPayload && typeof detailPayload === "object") {
          detail = detailPayload as TaskDetailDto
        }
      } else {
        await detailRes.body?.cancel().catch(() => undefined)
      }
    } catch {
      // Список задач получен — отдаём статус без detail, клиент не теряет состояние.
      detail = null
    }
  }

  return NextResponse.json(
    buildStatusPayload({ tasks, detail, fetchedAt: new Date().toISOString() })
  )
}

async function handleGroups(request: NextRequest) {
  const upstream = await callUpstream(request, "/api/groups?all=true")
  const payload = await readJson(upstream)

  if (!upstream.ok) {
    return jsonError(
      upstreamMessage(payload, "Не удалось загрузить группы: эмулятор недоступен"),
      upstream.status
    )
  }

  const list = (Array.isArray(payload) ? payload : []) as Array<{
    id: number
    type: number
    groupId: string | null
    name: string | null
    messageCount: number
    participantCount: number
    lastMessageDate?: string | null
    unreadCount?: number
  }>

  const groups = list.map((g) => ({
    conversationId: g.id,
    groupId: g.groupId ? Number(g.groupId) || 0 : 0,
    name: g.name,
    conversationType: g.type,
    memberCount: g.participantCount,
    messageCount: g.messageCount,
    lastMessageDate: g.lastMessageDate,
    unreadCount: g.unreadCount,
  }))

  return NextResponse.json({ count: groups.length, groups })
}

async function handleGroupMembers(request: NextRequest, conversationIdRaw: string) {
  const conversationId = Number(conversationIdRaw)
  const upstream = await callUpstream(
    request,
    `/api/groups/${encodeURIComponent(conversationIdRaw)}/participants`
  )
  const payload = await readJson(upstream)

  if (!upstream.ok) {
    return jsonError(
      upstreamMessage(payload, `Не удалось загрузить участников группы ${conversationIdRaw}`),
      upstream.status
    )
  }

  const participants = (Array.isArray(payload) ? payload : []) as Array<{
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
      isSelf: p.isSelf ?? p.id === 1,
      isOnline: p.isOnline,
      lastSeen: p.lastSeen,
    }
  })

  return NextResponse.json({
    conversationId: Number.isFinite(conversationId) ? conversationId : conversationIdRaw,
    count: members.length,
    members,
    rawParticipants: participants,
  })
}

/**
 * Выгрузка сообщений стримится телом ответа и может идти минутами. Таймаут держим
 * только до получения заголовков: после них поток рвётся лишь уходом клиента,
 * иначе пользователь получал бы обрезанный CSV.
 */
async function handleExport(request: NextRequest, search: string) {
  const origin = parserOrigin()
  const controller = new AbortController()
  const abortByClient = () => controller.abort(request.signal?.reason)
  if (request.signal?.aborted) abortByClient()
  else request.signal?.addEventListener("abort", abortByClient, { once: true })

  const headersTimer = setTimeout(() => controller.abort(), EXPORT_HEADERS_TIMEOUT_MS)
  let upstream: Response
  try {
    upstream = await fetch(`${origin}/api/messages/monitored/export${search}`, {
      cache: "no-store",
      signal: controller.signal,
    })
  } finally {
    clearTimeout(headersTimer)
  }

  if (!upstream.ok) {
    const payload = await readJson(upstream)
    return jsonError(upstreamMessage(payload, "Не удалось выгрузить сообщения"), upstream.status)
  }

  const headers = new Headers()
  headers.set("Content-Type", upstream.headers.get("content-type") || "application/octet-stream")
  headers.set("Cache-Control", "no-store")
  const disposition = upstream.headers.get("content-disposition")
  if (disposition) headers.set("Content-Disposition", disposition)

  return new Response(upstream.body, { status: upstream.status, headers })
}

async function handleCollect(request: NextRequest) {
  const raw = await request.json().catch(() => null)
  const sanitized = sanitizeCollectBody(raw)
  if (!sanitized.ok) {
    return jsonError(sanitized.error, 400)
  }

  const upstream = await callUpstream(request, "/api/participants/collect", {
    method: "POST",
    body: sanitized.value,
  })
  const payload = await readJson(upstream)

  if (!upstream.ok) {
    return jsonError(
      upstreamMessage(payload, "Не удалось запустить сбор участников"),
      upstream.status
    )
  }

  const accepted = (payload ?? {}) as { taskId?: string; message?: string; status?: string }
  return NextResponse.json(
    {
      taskId: accepted.taskId ?? null,
      message: accepted.message ?? "Сбор участников запущен",
      group: sanitized.value.group,
      groupName: sanitized.value.group,
      status: accepted.status ?? "initializing",
    },
    { status: 200 }
  )
}

async function handleStopAll(request: NextRequest) {
  const origin = parserOrigin()
  const tasksRes = await fetch(`${origin}/api/tasks`, {
    cache: "no-store",
    signal: combinedSignal(request, STATUS_TIMEOUT_MS),
  })

  if (!tasksRes.ok) {
    await tasksRes.body?.cancel().catch(() => undefined)
    return jsonError("Не удалось получить список задач для остановки", 502)
  }

  const raw = await readJson(tasksRes)
  const tasks = (Array.isArray(raw) ? raw : []) as TaskSummaryDto[]
  const active = tasks.filter(
    (t) => t.status === "initializing" || t.status === "starting" || t.status === "running"
  )

  for (const task of active) {
    await callUpstream(request, `/api/tasks/${encodeURIComponent(task.id)}/stop`, {
      method: "POST",
    }).catch(() => undefined)
  }

  return NextResponse.json({
    message: active.length > 0 ? "Сбор успешно остановлен" : "Активных задач нет",
    stopped: active.map((t) => t.id),
  })
}

async function handleDecode(request: NextRequest) {
  const raw = await request.json().catch(() => null)
  const upstream = await callUpstream(request, "/api/database/decode", {
    method: "POST",
    body: sanitizeDecodeBody(raw),
    timeoutMs: DECODE_TIMEOUT_MS,
  })
  const payload = await readJson(upstream)

  if (!upstream.ok) {
    return jsonError(
      upstreamMessage(payload, "Ошибка дешифровки базы данных"),
      upstream.status
    )
  }

  return NextResponse.json(payload ?? null)
}

async function handleDatabaseSync(request: NextRequest) {
  const upstream = await callUpstream(request, "/api/database/sync", {
    method: "POST",
    timeoutMs: SYNC_TIMEOUT_MS,
  })
  const payload = await readJson(upstream)

  if (!upstream.ok) {
    return jsonError(
      upstreamMessage(payload, "Не удалось синхронизировать базу с эмулятором"),
      upstream.status
    )
  }

  const result = (payload ?? {}) as Record<string, unknown>
  return NextResponse.json({
    ...result,
    message:
      typeof result.message === "string" && result.message
        ? result.message
        : "База данных успешно синхронизирована с эмулятором",
  })
}

async function dispatchGet(request: NextRequest, match: ProxyMatch, search: string) {
  switch (match.kind) {
    case "status":
      return handleStatus(request)
    case "groups":
      return handleGroups(request)
    case "group-members":
      return handleGroupMembers(request, match.params?.id ?? "")
    case "group-detail":
      return passthroughJson(request, `/api/groups/${encodeURIComponent(match.params?.id ?? "")}`)
    case "database-stats":
      return passthroughJson(request, "/api/database/stats")
    case "tasks":
      return passthroughJson(request, `/api/tasks${search}`, { timeoutMs: STATUS_TIMEOUT_MS })
    case "task-detail":
      return passthroughJson(request, `/api/tasks/${encodeURIComponent(match.params?.id ?? "")}`, {
        timeoutMs: STATUS_TIMEOUT_MS,
      })
    case "task-participants":
      return passthroughJson(
        request,
        `/api/tasks/${encodeURIComponent(match.params?.id ?? "")}/participants`
      )
    case "task-events":
      return proxySse(request, `/api/tasks/${encodeURIComponent(match.params?.id ?? "")}/events`)
    case "messages-events":
      return proxySse(request, "/api/messages/monitor/events")
    case "messages-monitored":
      return passthroughJson(request, `/api/messages/monitored${search}`)
    case "messages-monitored-export":
      return handleExport(request, search)
    case "monitor-status":
      return passthroughJson(request, "/api/messages/monitor/status")
    case "monitor-groups":
      return passthroughJson(request, "/api/messages/monitor/groups")
    case "broadcast":
      return passthroughJson(
        request,
        `/api/${match.upstreamPath}${search}`,
        {},
        "Бэкенд не поддерживает рассылку"
      )
    case "viber-status":
      return passthroughJson(request, "/api/viber/status", {}, "Не удалось получить статус Viber")
    case "users":
      return passthroughJson(request, `/api/users${search}`, {}, "Не удалось получить список пользователей")
    default:
      return jsonError("Маршрут не поддерживается", 404)
  }
}

async function dispatchPost(request: NextRequest, match: ProxyMatch, search: string) {
  switch (match.kind) {
    case "start":
      return NextResponse.json({ message: "Сессия активна и готова к сбору" })
    case "stop":
      return handleStopAll(request)
    case "auth-phone":
      return passthroughJson(
        request,
        "/api/auth/phone",
        { method: "POST", rawBody: (await request.text()) || "{}" },
        "Не удалось отправить номер телефона"
      )
    case "auth-code":
      return passthroughJson(
        request,
        "/api/auth/code",
        { method: "POST", rawBody: (await request.text()) || "{}" },
        "Не удалось подтвердить код активации"
      )
    case "viber-start":
      return passthroughJson(
        request,
        "/api/viber/start",
        { method: "POST", rawBody: (await request.text()) || "{}" },
        "Не удалось запустить Viber"
      )
    case "users-sync-group":
      return passthroughJson(
        request,
        `/api/users/sync/group/${encodeURIComponent(match.params?.id ?? "")}`,
        { method: "POST" },
        "Не удалось синхронизировать участников группы"
      )
    case "users-sync-task":
      return passthroughJson(
        request,
        `/api/users/sync/task/${encodeURIComponent(match.params?.id ?? "")}`,
        { method: "POST" },
        "Не удалось синхронизировать участников задачи"
      )
    case "task-stop":
      return passthroughJson(
        request,
        `/api/tasks/${encodeURIComponent(match.params?.id ?? "")}/stop`,
        { method: "POST" },
        "Не удалось остановить задачу"
      )
    case "collect":
      return handleCollect(request)
    case "decode":
      return handleDecode(request)
    case "database-sync":
      return handleDatabaseSync(request)
    case "monitor-start":
      return passthroughJson(
        request,
        "/api/messages/monitor/start",
        { method: "POST", rawBody: (await request.text()) || "{}" },
        "Не удалось запустить мониторинг"
      )
    case "monitor-stop":
      return passthroughJson(
        request,
        "/api/messages/monitor/stop",
        { method: "POST" },
        "Не удалось остановить мониторинг"
      )
    case "monitor-group-toggle":
      return passthroughJson(
        request,
        `/api/messages/monitor/groups/${encodeURIComponent(match.params?.id ?? "")}/${match.params?.action ?? "enable"}`,
        { method: "POST", rawBody: (await request.text()) || "{}" },
        "Не удалось изменить мониторинг группы"
      )
    case "online-status":
      return passthroughJson(
        request,
        "/api/participants/online-status",
        { method: "POST", rawBody: (await request.text()) || "{}" },
        "Не удалось получить статусы активности"
      )
    case "broadcast":
      return passthroughJson(
        request,
        `/api/${match.upstreamPath}${search}`,
        { method: "POST", rawBody: (await request.text()) || "{}" },
        "Бэкенд не поддерживает рассылку"
      )
    default:
      return jsonError("Маршрут не поддерживается", 404)
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  const match = matchProxyRoute("GET", context.params.path ?? [])
  if (!match) return jsonError("Маршрут не поддерживается", 404)

  try {
    return await dispatchGet(request, match, request.nextUrl.search)
  } catch (error) {
    // Для статуса важно отличать «бэкенд не поднят» (503) от ошибки задачи.
    return failure(error, request, match.kind === "status" ? 503 : 502)
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const match = matchProxyRoute("POST", context.params.path ?? [])
  if (!match) return jsonError("Маршрут не поддерживается", 404)

  try {
    return await dispatchPost(request, match, request.nextUrl.search)
  } catch (error) {
    return failure(error, request)
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const match = matchProxyRoute("PATCH", context.params.path ?? [])
  if (!match || !match.upstreamPath) return jsonError("Маршрут не поддерживается", 404)

  try {
    return await passthroughJson(
      request,
      `/api/${match.upstreamPath}`,
      { method: "PATCH", rawBody: (await request.text()) || "{}" },
      "Бэкенд не поддерживает рассылку"
    )
  } catch (error) {
    return failure(error, request)
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const match = matchProxyRoute("DELETE", context.params.path ?? [])
  if (!match || !match.upstreamPath) return jsonError("Маршрут не поддерживается", 404)

  try {
    return await passthroughJson(
      request,
      `/api/${match.upstreamPath}`,
      { method: "DELETE" },
      "Бэкенд не поддерживает рассылку"
    )
  } catch (error) {
    return failure(error, request)
  }
}
