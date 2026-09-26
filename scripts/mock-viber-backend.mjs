#!/usr/bin/env node
/**
 * Мок бэкенда Viber Parser (NestJS) для локальной отладки панели /dashboard/viber.
 *
 * Повторяет контракт настоящего бэкенда:
 *  - ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }) — неизвестное поле в body даёт 400;
 *  - задачи живут только в памяти процесса, GET /api/tasks отдаёт их без лимита (новые первыми);
 *  - SSE /api/tasks/:id/events шлёт безымянные события { taskId, status, step?, progress?, error?, timestamp }
 *    и не шлёт heartbeat: на шаге waiting_numbers_sync в потоке 40 секунд тишины;
 *  - завершённая задача отдаёт мгновенно закрытый пустой поток.
 *
 * Запуск:  PORT=3001 node scripts/mock-viber-backend.mjs
 * Хаос:    PORT=3001 MOCK_CHAOS=1 node scripts/mock-viber-backend.mjs
 *          (~25 % запросов к /api/tasks подвисают на 8 с или отвечают 500)
 */

import { createServer } from "node:http"

const PORT = Number.parseInt(process.env.PORT ?? "3001", 10)
const CHAOS = process.env.MOCK_CHAOS === "1"
/** MOCK_NO_BROADCAST=1 повторяет старую сборку бэкенда без модуля рассылки (404 на /api/broadcast/*). */
const NO_BROADCAST = process.env.MOCK_NO_BROADCAST === "1"
const CHAOS_RATE = 0.25
const CHAOS_HANG_MS = 8000

const STEP_MS = 2000
const NUMBERS_SYNC_SILENCE_MS = 40_000

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const nowIso = () => new Date().toISOString()

// ---------------------------------------------------------------- фикстуры

const groups = [
  {
    id: 26,
    type: 5,
    groupId: "1234567890123456",
    name: "АVTOTRAL 🚨",
    messageCount: 15_240,
    participantCount: 120,
    lastMessageDate: nowIso(),
    unreadCount: 4,
  },
  {
    id: 27,
    type: 1,
    groupId: "9876543210987654",
    name: "Логістика UA",
    messageCount: 4210,
    participantCount: 48,
    lastMessageDate: nowIso(),
    unreadCount: 0,
  },
  {
    id: 28,
    type: 0,
    groupId: null,
    name: "Особистий чат",
    messageCount: 92,
    participantCount: 2,
    lastMessageDate: nowIso(),
    unreadCount: 1,
  },
]

const ROLE_BY_INDEX = ["superadmin", "admin", "member", "member", "member"]

function buildParticipants(conversationId, count) {
  const list = []
  for (let index = 0; index < count; index += 1) {
    const decoded = index % 4 !== 3
    const number = decoded
      ? `+3805${String(10_000_000 + conversationId * 1000 + index).slice(0, 8)}`
      : `em:AQANrniLcl9lwBpv${String(index).padStart(4, "0")}`
    list.push({
      id: conversationId * 1000 + index + 1,
      memberId: decoded ? `mid_${conversationId}_${index}` : `em:key_${index}`,
      number,
      name: index === 0 ? "Milena" : `Учасник ${index + 1}`,
      contactName: null,
      viberName: `viber_${conversationId}_${index}`,
      groupRole: index === 0 ? 2 : index === 1 ? 1 : 0,
      roleLabel: ROLE_BY_INDEX[Math.min(index, ROLE_BY_INDEX.length - 1)] ?? "member",
      active: true,
      isSelf: index === 0,
      isOnline: index % 7 === 0,
      lastSeen: index % 7 === 0 ? null : new Date(Date.now() - index * 600_000).toISOString(),
    })
  }
  return list
}

const participantsByGroup = new Map(
  groups.map((group) => [group.id, buildParticipants(group.id, group.participantCount)])
)

const monitorState = {
  isRunning: false,
  liveWatch: true,
  pollIntervalMs: 2500,
  lastPollAt: null,
  lastProcessedMessageId: 1541,
  processedMessagesCount: 0,
  phonesFromTextCount: 0,
  phonesFromViberCount: 0,
  groups: [{ conversationId: 26, name: "АVTOTRAL 🚨", enabled: false, lastMessageId: 1541 }],
}

const monitoredMessages = []
const monitorSubscribers = new Set()
let nextMessageId = 1542

const campaigns = []
const sendHistory = []

// ---------------------------------------------------------------- задачи

/** @type {Map<string, any>} */
const tasks = new Map()

function createTask(groupTarget) {
  const id = `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  const task = {
    id,
    groupTarget,
    groupName: undefined,
    conversationId: undefined,
    status: "initializing",
    currentStep: null,
    stepHistory: [],
    progress: null,
    error: null,
    result: null,
    createdAt: new Date(),
    startedAt: undefined,
    completedAt: undefined,
    aborted: false,
    subscribers: new Set(),
  }
  tasks.set(id, task)
  setStep(task, "initializing", "Инициализация задачи и проверка параметров")
  return task
}

function emit(task) {
  const payload = JSON.stringify({
    taskId: task.id,
    status: task.status,
    ...(task.currentStep ? { step: task.currentStep } : {}),
    ...(task.progress ? { progress: task.progress } : {}),
    ...(task.error ? { error: task.error } : {}),
    timestamp: nowIso(),
  })
  for (const res of task.subscribers) {
    res.write(`data: ${payload}\n\n`)
  }
}

function setStep(task, step, description, progress) {
  const now = new Date()
  if (task.currentStep) {
    task.currentStep.durationMs = Math.max(
      0,
      now.getTime() - new Date(task.currentStep.startedAt).getTime()
    )
    task.stepHistory.push({ ...task.currentStep })
  }

  task.currentStep = {
    step,
    description,
    startedAt: now.toISOString(),
    ...(progress !== undefined ? { progress } : {}),
  }
  if (progress) {
    task.progress = { ...(task.progress ?? {}), ...progress }
  }

  if (step === "attaching_frida" || step === "navigating_viber") {
    if (task.status === "initializing") {
      task.status = "starting"
      task.startedAt = now
    }
  } else if (
    step === "paging_participants" ||
    step === "syncing_live_db" ||
    step === "restarting_viber" ||
    step === "waiting_numbers_sync" ||
    step === "deduplicating_and_finalizing" ||
    step === "exporting_results"
  ) {
    task.status = "running"
  }

  emit(task)
}

function updateProgress(task, progress) {
  task.progress = { ...(task.progress ?? {}), ...progress }
  if (task.currentStep) {
    task.currentStep.progress = { ...(task.currentStep.progress ?? {}), ...progress }
  }
  emit(task)
}

function finishStep(task) {
  if (!task.currentStep) return
  task.currentStep.durationMs = Math.max(
    0,
    Date.now() - new Date(task.currentStep.startedAt).getTime()
  )
  task.stepHistory.push({ ...task.currentStep })
}

function completeTask(task, result) {
  finishStep(task)
  task.currentStep = null
  task.status = "ready"
  task.result = result
  task.completedAt = new Date()
  emit(task)
  closeSubscribers(task)
}

function failTask(task, message) {
  finishStep(task)
  task.status = "error"
  task.error = message
  task.completedAt = new Date()
  emit(task)
  closeSubscribers(task)
}

function stopTask(task) {
  if (isTerminal(task)) return task
  task.aborted = true
  finishStep(task)
  task.status = "stopped"
  task.completedAt = new Date()
  emit(task)
  closeSubscribers(task)
  return task
}

function closeSubscribers(task) {
  for (const res of task.subscribers) {
    res.end()
  }
  task.subscribers.clear()
}

function isTerminal(task) {
  return task.status === "ready" || task.status === "error" || task.status === "stopped"
}

function toSummary(task) {
  return {
    id: task.id,
    groupTarget: task.groupTarget,
    groupName: task.groupName,
    conversationId: task.conversationId,
    status: task.status,
    currentStep: task.currentStep,
    createdAt: task.createdAt.toISOString(),
    startedAt: task.startedAt ? task.startedAt.toISOString() : undefined,
    completedAt: task.completedAt ? task.completedAt.toISOString() : undefined,
  }
}

function toDetail(task) {
  return {
    ...toSummary(task),
    stepHistory: task.stepHistory,
    progress: task.progress,
    error: task.error,
    result: task.result,
  }
}

function hasActiveTask() {
  for (const task of tasks.values()) {
    if (!isTerminal(task)) return true
  }
  return false
}

async function runCollectFlow(task, dto) {
  const stop = () => task.aborted

  try {
    const group =
      groups.find((item) => String(item.id) === String(dto.group)) ??
      groups.find((item) => item.name === dto.group) ??
      groups[0]

    setStep(task, "resolving_group", "Определение параметров группы и ID беседы в SQLite")
    await sleep(STEP_MS)
    if (stop()) return

    task.groupName = group.name
    task.conversationId = group.id
    updateProgress(task, {
      groupName: group.name,
      conversationId: group.id,
      groupId: group.groupId ?? "0",
    })

    setStep(task, "attaching_frida", "Подключение Frida к процессу com.viber.voip")
    await sleep(STEP_MS)
    if (stop()) return

    setStep(task, "navigating_viber", "Навигация в UI Viber к списку участников группы через AdbUi")
    await sleep(STEP_MS)
    if (stop()) return
    const headerTotal = group.participantCount
    updateProgress(task, { headerTotal })

    setStep(task, "paging_participants", "Сбор страниц участников через Frida без прокрутки экрана", {
      headerTotal,
      pagesCount: 0,
    })

    const pageSize = 20
    const pages = Math.max(1, Math.ceil(headerTotal / pageSize))
    for (let page = 1; page <= pages; page += 1) {
      await sleep(700)
      if (stop()) return
      updateProgress(task, {
        pagesCount: page,
        currentOffset: Math.min(page * pageSize, headerTotal),
        pageSize,
        lastPage: page === pages,
      })
    }

    setStep(
      task,
      "syncing_live_db",
      "Запись полученных участников и связей в рабочую базу данных эмулятора"
    )
    await sleep(STEP_MS)
    if (stop()) return

    if (dto.restartApp !== false) {
      setStep(task, "restarting_viber", "Перезапуск Viber для сброса WAL и сетевой синхронизации телефонов")
      await sleep(STEP_MS)
      if (stop()) return

      // Самый опасный шаг: в SSE-потоке настоящего бэкенда здесь полная тишина.
      setStep(
        task,
        "waiting_numbers_sync",
        "Ожидание сетевой синхронизации телефонных номеров клиентом Viber"
      )
      await sleep(NUMBERS_SYNC_SILENCE_MS)
      if (stop()) return
      updateProgress(task, { syncedPhoneNumbers: headerTotal, stable: true })

      setStep(
        task,
        "deduplicating_and_finalizing",
        "Снятие снимка базы, сопоставление имён и дедупликация участников"
      )
      await sleep(STEP_MS)
      if (stop()) return
    }

    if (dto.fetchOnlineStatus !== false) {
      setStep(
        task,
        "fetching_online_activity",
        "Сбор последней активности участников (В сети / Дата последнего посещения) через Frida",
        { total: headerTotal, completed: 0 }
      )
      for (let done = 0; done <= headerTotal; done += Math.ceil(headerTotal / 5)) {
        await sleep(600)
        if (stop()) return
        updateProgress(task, { onlineChecked: Math.min(done, headerTotal), onlineTotal: headerTotal })
      }
    }

    setStep(task, "exporting_results", "Формирование отчёта и экспорт в TXT, CSV и JSON файлы")
    await sleep(STEP_MS)
    if (stop()) return

    // После сбора номера считаются дешифрованными.
    const list = participantsByGroup.get(group.id) ?? []
    for (const participant of list) {
      if (participant.number.startsWith("em:")) {
        participant.number = `+3805${String(20_000_000 + participant.id).slice(0, 8)}`
        participant.memberId = `mid_sync_${participant.id}`
      }
    }

    completeTask(task, {
      group: group.name,
      conversationId: group.id,
      groupId: group.groupId ?? "0",
      headerTotal,
      pagesCount: pages,
      participantsCount: list.length,
      participantsWithPhone: list.filter((item) => !item.number.startsWith("em:")).length,
      savedJsonPath: `C:/mock/data/rosters/${group.id}-full.json`,
      savedTxtPath: `C:/mock/data/rosters/${group.id}-full.txt`,
      savedCsvPath: `C:/mock/data/rosters/${group.id}-full.csv`,
    })
  } catch (error) {
    failTask(task, error instanceof Error ? error.message : String(error))
  }
}

// ---------------------------------------------------------------- helpers

function sendJson(res, status, payload) {
  const body = payload === undefined ? "" : JSON.stringify(payload)
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
  })
  res.end(body)
}

function badRequest(res, messages) {
  sendJson(res, 400, {
    message: Array.isArray(messages) ? messages : [messages],
    error: "Bad Request",
    statusCode: 400,
  })
}

function notFound(res, message) {
  sendJson(res, 404, { message, error: "Not Found", statusCode: 404 })
}

async function readBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const text = Buffer.concat(chunks).toString("utf8")
  if (!text.trim()) return {}
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

/** Повторяет ValidationPipe: whitelist + forbidNonWhitelisted + проверка типов. */
function validateDto(body, schema) {
  const errors = []
  const value = {}

  for (const key of Object.keys(body)) {
    if (!(key in schema)) {
      errors.push(`property ${key} should not exist`)
    }
  }

  for (const [key, rule] of Object.entries(schema)) {
    const raw = body[key]
    if (raw === undefined) {
      if (rule.required) errors.push(`${key} should not be empty`)
      continue
    }
    if (rule.type === "string") {
      if (typeof raw !== "string") errors.push(`${key} must be a string`)
      else if (rule.required && raw.trim() === "") errors.push(`${key} should not be empty`)
      else value[key] = raw
    } else if (rule.type === "boolean") {
      if (typeof raw !== "boolean") errors.push(`${key} must be a boolean value`)
      else value[key] = raw
    } else if (rule.type === "number") {
      if (typeof raw !== "number" || !Number.isFinite(raw)) {
        errors.push(`${key} must be a number conforming to the specified constraints`)
      } else value[key] = raw
    } else {
      value[key] = raw
    }
  }

  return { errors, value }
}

function openSse(res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
    "Access-Control-Allow-Origin": "*",
  })
}

function maybeChaos(res) {
  if (!CHAOS || Math.random() > CHAOS_RATE) return false
  if (Math.random() < 0.5) {
    // Клиент за CHAOS_HANG_MS мог уйти: пишем только в живой сокет и не роняем процесс.
    res.on("error", () => {})
    const timer = setTimeout(() => {
      if (res.destroyed || res.writableEnded) return
      sendJson(res, 200, Array.from(tasks.values()).map(toSummary))
    }, CHAOS_HANG_MS)
    timer.unref?.()
    return true
  }
  sendJson(res, 500, {
    message: "Внутренняя ошибка эмулятора (mock chaos)",
    error: "Internal Server Error",
    statusCode: 500,
  })
  return true
}

// ---------------------------------------------------------------- маршруты

const COLLECT_SCHEMA = {
  group: { type: "string", required: true },
  allowPartial: { type: "boolean" },
  restartApp: { type: "boolean" },
  idleTimeoutMs: { type: "number" },
  numbersSyncTimeoutMs: { type: "number" },
  syncLiveDbAfter: { type: "boolean" },
  fetchOnlineStatus: { type: "boolean" },
}

const DECODE_SCHEMA = {
  dryRun: { type: "boolean" },
  limit: { type: "number" },
  restartApp: { type: "boolean" },
  waitForSyncSeconds: { type: "number" },
}

const MONITOR_START_SCHEMA = {
  conversationId: { type: "number" },
  pollIntervalMs: { type: "number" },
  fromLatest: { type: "boolean" },
  startFromId: { type: "number" },
}

const MONITOR_ENABLE_SCHEMA = {
  fromLatest: { type: "boolean" },
}

function monitorStatusDto() {
  const enabled = monitorState.groups.filter((item) => item.enabled)
  return {
    isRunning: monitorState.isRunning,
    conversationId: enabled.length === 1 ? enabled[0].conversationId : null,
    groups: monitorState.groups,
    liveWatch: monitorState.liveWatch,
    pollIntervalMs: monitorState.pollIntervalMs,
    lastPollAt: monitorState.lastPollAt,
    lastProcessedMessageId: monitorState.lastProcessedMessageId,
    processedMessagesCount: monitorState.processedMessagesCount,
    phonesFromTextCount: monitorState.phonesFromTextCount,
    phonesFromViberCount: monitorState.phonesFromViberCount,
  }
}

function pushMonitoredMessage() {
  const enabled = monitorState.groups.filter((item) => item.enabled)
  if (!monitorState.isRunning || enabled.length === 0) return

  const target = enabled[Math.floor(Math.random() * enabled.length)]
  const hasPhone = Math.random() > 0.4
  const phone = `+3806${String(10_000_000 + Math.floor(Math.random() * 8_999_999)).slice(0, 8)}`
  const message = {
    id: nextMessageId++,
    conversationId: target.conversationId,
    conversationName: target.name,
    token: String(5_907_779_393_516_782_000 + nextMessageId),
    date: nowIso(),
    body: hasPhone ? `Терміново потрібен автовоз, дзвоніть ${phone}` : "Є завантаження на завтра",
    senderId: 42,
    senderName: "Учасник 12",
    senderMemberId: "mid_26_12",
    outgoing: false,
    hasPhoneInText: hasPhone,
    attachedPhone: hasPhone ? phone : null,
    phoneSource: hasPhone ? "message_text" : "none",
    allFoundPhones: hasPhone ? [phone] : [],
    hasMedia: false,
    mediaUris: [],
  }

  monitoredMessages.unshift(message)
  if (monitoredMessages.length > 500) monitoredMessages.pop()
  monitorState.lastProcessedMessageId = message.id
  monitorState.processedMessagesCount += 1
  monitorState.lastPollAt = nowIso()
  if (hasPhone) monitorState.phonesFromTextCount += 1
  target.lastMessageId = message.id

  const payload = `event: message\ndata: ${JSON.stringify(message)}\n\n`
  for (const res of monitorSubscribers) res.write(payload)
}

setInterval(pushMonitoredMessage, 10_000).unref()
setInterval(() => {
  const payload = 'event: ping\ndata: {"type":"ping"}\n\n'
  for (const res of monitorSubscribers) res.write(payload)
}, 15_000).unref()

async function handle(req, res, url) {
  const path = url.pathname
  const method = req.method ?? "GET"
  const segments = path.split("/").filter(Boolean)

  // -------------------------------------------------------------- tasks
  if (path === "/api/tasks" && method === "GET") {
    if (maybeChaos(res)) return
    const status = url.searchParams.get("status")
    const list = Array.from(tasks.values())
      .filter((task) => !status || task.status === status)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map(toSummary)
    return sendJson(res, 200, list)
  }

  if (segments[0] === "api" && segments[1] === "tasks" && segments[2]) {
    const task = tasks.get(segments[2])

    if (segments.length === 3 && method === "GET") {
      if (!task) return notFound(res, `Задача с ID "${segments[2]}" не найдена`)
      return sendJson(res, 200, toDetail(task))
    }

    if (segments.length === 4 && segments[3] === "stop" && method === "POST") {
      if (!task) return notFound(res, `Задача с ID "${segments[2]}" не найдена`)
      stopTask(task)
      return sendJson(res, 200, {
        taskId: task.id,
        status: task.status,
        message: "Сигнал остановки отправлен. Задача переведена в статус stopped.",
      })
    }

    if (segments.length === 4 && segments[3] === "events" && method === "GET") {
      if (!task) return notFound(res, `Задача с ID "${segments[2]}" не найдена`)
      openSse(res)
      if (isTerminal(task)) {
        // Как у настоящего бэкенда: поток завершённой задачи закрывается сразу и пустым.
        return res.end()
      }
      task.subscribers.add(res)
      req.on("close", () => task.subscribers.delete(res))
      return undefined
    }

    if (segments.length === 4 && segments[3] === "participants" && method === "GET") {
      if (!task) return notFound(res, `Задача с ID "${segments[2]}" не найдена`)
      if (task.status !== "ready") {
        return notFound(
          res,
          `Результат задачи ${task.id} еще не готов. Текущий статус: "${task.status}".`
        )
      }
      return sendJson(res, 200, participantsByGroup.get(task.conversationId) ?? [])
    }
  }

  // ------------------------------------------------------- participants
  if (path === "/api/participants/collect" && method === "POST") {
    const body = await readBody(req)
    if (body === null) return badRequest(res, "Unexpected token in JSON")

    const { errors, value } = validateDto(body, COLLECT_SCHEMA)
    if (errors.length > 0) return badRequest(res, errors)

    if (hasActiveTask()) {
      return sendJson(res, 409, {
        message: "Эмулятор сейчас занят выполнением другой задачи. Дождитесь её завершения.",
        error: "Conflict",
        statusCode: 409,
      })
    }

    const task = createTask(value.group)
    void runCollectFlow(task, value)
    return sendJson(res, 202, {
      taskId: task.id,
      status: task.status,
      group: value.group,
      message: `Задача сбора участников для группы "${value.group}" успешно запущена.`,
    })
  }

  if (path === "/api/participants/online-status" && method === "POST") {
    const body = await readBody(req)
    if (body === null) return badRequest(res, "Unexpected token in JSON")
    const memberIds = Array.isArray(body.memberIds) ? body.memberIds : []
    return sendJson(
      res,
      200,
      memberIds.map((memberId) => ({ memberId, isOnline: false, lastSeen: null }))
    )
  }

  // ------------------------------------------------------------- groups
  if (path === "/api/groups" && method === "GET") {
    const all = url.searchParams.get("all")
    const includeAll = all === "true" || all === "1"
    return sendJson(
      res,
      200,
      groups.filter((group) => includeAll || group.type !== 0)
    )
  }

  if (segments[0] === "api" && segments[1] === "groups" && segments[2] && method === "GET") {
    const id = Number(segments[2])
    const group = groups.find((item) => item.id === id)
    if (!group) return notFound(res, `Группа ${segments[2]} не найдена`)

    if (segments.length === 3) {
      return sendJson(res, 200, { ...group, participants: undefined })
    }
    if (segments.length === 4 && segments[3] === "participants") {
      return sendJson(res, 200, participantsByGroup.get(id) ?? [])
    }
  }

  // ----------------------------------------------------------- database
  if (path === "/api/database/stats" && method === "GET") {
    const all = Array.from(participantsByGroup.values()).flat()
    return sendJson(res, 200, {
      conversationsCount: groups.length,
      messagesCount: groups.reduce((sum, group) => sum + group.messageCount, 0),
      participantsCount: all.length,
      undecodedParticipantsCount: all.filter((item) => item.number.startsWith("em:")).length,
      isSnapshotCurrent: true,
    })
  }

  if (path === "/api/database/sync" && method === "POST") {
    await sleep(1500)
    const all = Array.from(participantsByGroup.values()).flat()
    return sendJson(res, 200, {
      message: "Снимок базы обновлён с эмулятора",
      snapshotPath: "C:/mock/data/snapshots/viber_messages",
      fileSize: 41_943_040,
      conversationsCount: groups.length,
      messagesCount: groups.reduce((sum, group) => sum + group.messageCount, 0),
      participantsCount: all.length,
      isCurrent: true,
    })
  }

  if (path === "/api/database/decode" && method === "POST") {
    const body = await readBody(req)
    if (body === null) return badRequest(res, "Unexpected token in JSON")

    const { errors, value } = validateDto(body, DECODE_SCHEMA)
    if (errors.length > 0) return badRequest(res, errors)

    await sleep(2000)
    const all = Array.from(participantsByGroup.values()).flat()
    const undecoded = all.filter((item) => item.number.startsWith("em:"))
    const limit = typeof value.limit === "number" ? value.limit : undecoded.length
    const target = undecoded.slice(0, limit)

    if (value.dryRun !== true) {
      for (const participant of target) {
        participant.number = `+3805${String(30_000_000 + participant.id).slice(0, 8)}`
        participant.memberId = `mid_decoded_${participant.id}`
      }
    }

    return sendJson(res, 200, {
      success: true,
      message: "Дешифровка успешно выполнена и сохранена в базе данных",
      dryRun: value.dryRun === true,
      totalRows: all.length,
      undecodedFound: undecoded.length,
      decodedCount: target.length,
      errorsCount: 0,
      sampleDecoded: target.slice(0, 5).map((item) => ({
        id: item.id,
        name: item.name,
        oldMemberId: `em:key_${item.id}`,
        newMemberId: item.memberId,
      })),
      restartedApp: value.restartApp !== false,
    })
  }

  // ----------------------------------------------------------- messages
  if (path === "/api/messages/monitor/status" && method === "GET") {
    return sendJson(res, 200, monitorStatusDto())
  }

  if (path === "/api/messages/monitor/groups" && method === "GET") {
    return sendJson(res, 200, monitorState.groups)
  }

  if (path === "/api/messages/monitor/start" && method === "POST") {
    const body = await readBody(req)
    if (body === null) return badRequest(res, "Unexpected token in JSON")
    const { errors, value } = validateDto(body, MONITOR_START_SCHEMA)
    if (errors.length > 0) return badRequest(res, errors)

    monitorState.isRunning = true
    monitorState.lastPollAt = nowIso()
    if (typeof value.conversationId === "number") {
      const found = monitorState.groups.find(
        (item) => item.conversationId === value.conversationId
      )
      if (found) found.enabled = true
    }
    return sendJson(res, 200, monitorStatusDto())
  }

  if (path === "/api/messages/monitor/stop" && method === "POST") {
    monitorState.isRunning = false
    return sendJson(res, 200, monitorStatusDto())
  }

  if (
    segments[0] === "api" &&
    segments[1] === "messages" &&
    segments[2] === "monitor" &&
    segments[3] === "groups" &&
    segments[4] &&
    (segments[5] === "enable" || segments[5] === "disable") &&
    method === "POST"
  ) {
    const body = await readBody(req)
    if (body === null) return badRequest(res, "Unexpected token in JSON")
    const { errors } = validateDto(body, MONITOR_ENABLE_SCHEMA)
    if (errors.length > 0) return badRequest(res, errors)

    const conversationId = Number(segments[4])
    const group = groups.find((item) => item.id === conversationId)
    if (!group) return notFound(res, `Группа ${segments[4]} не найдена`)

    let entry = monitorState.groups.find((item) => item.conversationId === conversationId)
    if (!entry) {
      entry = { conversationId, name: group.name, enabled: false, lastMessageId: 0 }
      monitorState.groups.push(entry)
    }
    entry.enabled = segments[5] === "enable"
    if (entry.enabled) monitorState.isRunning = true
    return sendJson(res, 200, monitorStatusDto())
  }

  if (path === "/api/messages/monitored" && method === "GET") {
    const limit = Number(url.searchParams.get("limit") ?? "50")
    const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 50
    return sendJson(res, 200, monitoredMessages.slice(0, safeLimit))
  }

  if (path === "/api/messages/monitored/export" && method === "GET") {
    const format = url.searchParams.get("format") ?? "json"
    const body =
      format === "csv"
        ? ["id,conversationId,date,body", ...monitoredMessages.map((m) => `${m.id},${m.conversationId},${m.date},"${(m.body ?? "").replace(/"/g, '""')}"`)].join("\r\n")
        : JSON.stringify(monitoredMessages, null, 2)
    res.writeHead(200, {
      "Content-Type": format === "csv" ? "text/csv; charset=utf-8" : "application/json",
      "Content-Disposition": `attachment; filename="viber-messages.${format}"`,
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    })
    return res.end(body)
  }

  if (path === "/api/messages/monitor/events" && method === "GET") {
    openSse(res)
    res.write(":\n\n")
    monitorSubscribers.add(res)
    req.on("close", () => monitorSubscribers.delete(res))
    return undefined
  }

  // ---------------------------------------------------------- broadcast
  if (NO_BROADCAST && path.startsWith("/api/broadcast")) {
    return notFound(res, `Cannot ${method} ${path}`)
  }

  if (path === "/api/broadcast/status" && method === "GET") {
    const running = campaigns.find((item) => item.status === "running") ?? null
    return sendJson(res, 200, { isRunning: !!running, campaign: running })
  }

  if (path === "/api/broadcast/history/last" && method === "GET") {
    const seen = new Set()
    const last = []
    for (const entry of sendHistory) {
      if (seen.has(entry.conversationId)) continue
      seen.add(entry.conversationId)
      last.push(entry)
    }
    return sendJson(res, 200, last)
  }

  if (path === "/api/broadcast/history" && method === "GET") {
    const limit = Number(url.searchParams.get("limit") ?? "50")
    return sendJson(res, 200, sendHistory.slice(0, Number.isFinite(limit) ? limit : 50))
  }

  if (path === "/api/broadcast/campaigns" && method === "GET") {
    return sendJson(res, 200, campaigns)
  }

  if (path === "/api/broadcast/campaigns" && method === "POST") {
    const body = await readBody(req)
    if (body === null) return badRequest(res, "Unexpected token in JSON")
    const conversationIds = Array.isArray(body.conversationIds) ? body.conversationIds : []
    const messages = Array.isArray(body.messages) ? body.messages : []
    if (conversationIds.length === 0) return badRequest(res, "conversationIds should not be empty")
    if (messages.length === 0) return badRequest(res, "messages should not be empty")

    const campaign = {
      id: `bc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: typeof body.name === "string" && body.name.trim() ? body.name.trim() : "Кампания",
      groups: conversationIds.map((conversationId) => ({
        conversationId,
        name: groups.find((group) => group.id === conversationId)?.name ?? null,
      })),
      messages,
      intervalMs: typeof body.intervalMs === "number" ? body.intervalMs : 120_000,
      minIntervalPerChatMs:
        typeof body.minIntervalPerChatMs === "number" ? body.minIntervalPerChatMs : 1_800_000,
      rotation: typeof body.rotation === "string" ? body.rotation : "shuffle-cycle",
      loop: body.loop !== false,
      activeFrom: typeof body.activeFrom === "string" ? body.activeFrom : null,
      activeTo: typeof body.activeTo === "string" ? body.activeTo : null,
      status: "idle",
      nextGroupIndex: 0,
      rotationState: [],
      sentCount: 0,
      failedCount: 0,
      lastError: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      startedAt: null,
      stoppedAt: null,
    }
    campaigns.unshift(campaign)
    return sendJson(res, 201, campaign)
  }

  if (segments[0] === "api" && segments[1] === "broadcast" && segments[2] === "campaigns" && segments[3]) {
    const campaign = campaigns.find((item) => item.id === segments[3])
    if (!campaign) return notFound(res, "Кампания не найдена")

    if (segments.length === 4 && method === "GET") return sendJson(res, 200, campaign)

    if (segments.length === 4 && method === "DELETE") {
      if (campaign.status === "running") {
        return sendJson(res, 409, { message: "Кампания запущена", error: "Conflict", statusCode: 409 })
      }
      campaigns.splice(campaigns.indexOf(campaign), 1)
      res.writeHead(204, { "Access-Control-Allow-Origin": "*" })
      return res.end()
    }

    if (segments.length === 4 && method === "PATCH") {
      const body = await readBody(req)
      if (body === null) return badRequest(res, "Unexpected token in JSON")
      Object.assign(campaign, body, { updatedAt: nowIso() })
      return sendJson(res, 200, campaign)
    }

    if (segments.length === 5 && segments[4] === "start" && method === "POST") {
      campaign.status = "running"
      campaign.startedAt = nowIso()
      return sendJson(res, 200, campaign)
    }

    if (segments.length === 5 && segments[4] === "stop" && method === "POST") {
      campaign.status = "stopped"
      campaign.stoppedAt = nowIso()
      return sendJson(res, 200, campaign)
    }
  }

  return notFound(res, `Cannot ${method} ${path}`)
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`)

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "*",
    })
    res.end()
    return
  }

  handle(req, res, url).catch((error) => {
    if (!res.writableEnded) {
      sendJson(res, 500, {
        message: error instanceof Error ? error.message : String(error),
        error: "Internal Server Error",
        statusCode: 500,
      })
    }
  })
})

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[mock-viber] слушает http://127.0.0.1:${PORT}`)
  console.log(`[mock-viber] режим хаоса: ${CHAOS ? "включён (25% сбоев на /api/tasks)" : "выключен"}`)
})
