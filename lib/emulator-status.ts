export type SetupState = "running" | "ready" | "failed"
export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger"

export type EmulatorStatusId =
  | "unknown"
  | "stopped"
  | "paused"
  | "starting"
  | "container_error"
  | "setting_up"
  | "setup_failed"
  | "adb_offline"
  | "booting"
  | "android_ready"
  | "setup_complete"

export interface EmulatorSetupStatus {
  state: SetupState
  stage: string
  updatedAt: string
  exitCode: number
}

export interface ViberAccountInfo {
  phoneNumber: string
  displayName: string | null
  status: "pending" | "authorized"
  authorizedAt: string | null
  source: "login" | "device"
}

export interface EmulatorItem {
  id: string
  name: string
  containerName: string
  status: string
  state: string
  created: number
  adbPort?: number | null
  adbSerial?: string | null
  scrcpyUrl?: string | null
  bootCompleted?: boolean
  viberRunning?: boolean
  adbOnline?: boolean
  setupStatus?: EmulatorSetupStatus | null
  viberAccount?: ViberAccountInfo | null
}

export interface EmulatorStatusView {
  id: EmulatorStatusId
  label: string
  description: string
  tone: StatusTone
  stageLabel: string | null
  busy: boolean
  action: "start" | "open_logs" | "open_screen" | null
}

const STAGE_TRANSLATIONS: Record<string, string> = {
  "first boot": "Первый запуск",
  "google services": "Установка Google-сервисов",
  "google play services": "Установка Google-сервисов",
  "device profile": "Настройка профиля устройства",
  "root isolation": "Настройка изоляции root",
  "root hide": "Настройка изоляции root",
  "final cleanup": "Очистка временных файлов",
  "final adb check": "Проверка подключения ADB",
  "complete": "Настройка завершена",
  "audit": "Проверка системы",
}

export function translateSetupStage(stage?: string | null): string {
  if (!stage || typeof stage !== "string") return ""
  const trimmed = stage.trim()
  if (!trimmed) return ""

  const prepareMatch = trimmed.match(/^prepare\s+after\s+(.+)$/i)
  if (prepareMatch && prepareMatch[1]) {
    const subStage = translateSetupStage(prepareMatch[1])
    return `Подготовка после: ${subStage}`
  }

  const normalized = trimmed.toLowerCase()
  return STAGE_TRANSLATIONS[normalized] || trimmed
}

export function getEmulatorStatus(emulator: EmulatorItem): EmulatorStatusView {
  const state = (emulator.state || "").trim().toLowerCase()

  // 1. Контейнер dead или removing
  if (state === "dead") {
    return {
      id: "container_error",
      label: "Ошибка контейнера",
      description: "Контейнер завершился с ошибкой",
      tone: "danger",
      stageLabel: null,
      busy: false,
      action: "open_logs",
    }
  }

  if (state === "removing") {
    return {
      id: "container_error",
      label: "Удаление",
      description: "Контейнер удаляется",
      tone: "neutral",
      stageLabel: null,
      busy: true,
      action: null,
    }
  }

  // 2. Контейнер paused
  if (state === "paused") {
    return {
      id: "paused",
      label: "Приостановлен",
      description: "Контейнер приостановлен",
      tone: "neutral",
      stageLabel: null,
      busy: false,
      action: null,
    }
  }

  // 3. Контейнер exited
  if (state === "exited") {
    return {
      id: "stopped",
      label: "Остановлен",
      description: "Инстанс остановлен",
      tone: "neutral",
      stageLabel: null,
      busy: false,
      action: "start",
    }
  }

  // 4. Контейнер created или restarting
  if (state === "created" || state === "restarting") {
    return {
      id: "starting",
      label: "Запуск эмулятора",
      description: "Инициализация и запуск контейнера",
      tone: "neutral",
      stageLabel: null,
      busy: true,
      action: null,
    }
  }

  // 5. Неизвестное состояние контейнера (если не running)
  if (state !== "running") {
    return {
      id: "unknown",
      label: "Статус неизвестен",
      description: "Не удалось определить состояние контейнера",
      tone: "neutral",
      stageLabel: null,
      busy: false,
      action: null,
    }
  }

  // Для работающего контейнера:
  const setup = emulator.setupStatus
  const isAdbKnown = typeof emulator.adbOnline === "boolean"
  const isBootKnown = typeof emulator.bootCompleted === "boolean"

  // 6. Работающий контейнер, настройка failed
  if (setup?.state === "failed") {
    const stageLabel = translateSetupStage(setup.stage)
    const stageText = stageLabel ? ` на этапе «${stageLabel}»` : ""
    return {
      id: "setup_failed",
      label: "Ошибка настройки",
      description: `Сбой${stageText} (код ${setup.exitCode})`,
      tone: "danger",
      stageLabel: stageLabel || null,
      busy: false,
      action: "open_logs",
    }
  }

  // 7. Работающий контейнер, настройка running
  if (setup?.state === "running") {
    const stageLabel = translateSetupStage(setup.stage)
    const description =
      emulator.adbOnline === false
        ? "ADB временно недоступен; возможно переподключение после перезагрузки"
        : stageLabel
          ? `Выполняется этап: ${stageLabel}`
          : "Выполняется настройка инстанса"

    return {
      id: "setting_up",
      label: "Настройка инстанса",
      description,
      tone: "info",
      stageLabel: stageLabel || null,
      busy: true,
      action: null,
    }
  }

  // 8. Настройка не идёт, adbOnline === false
  if (emulator.adbOnline === false) {
    return {
      id: "adb_offline",
      label: "Нет подключения ADB",
      description: "Инстанс запущен, но соединение с ADB не установлено",
      tone: "warning",
      stageLabel: null,
      busy: false,
      action: "open_logs",
    }
  }

  // 9. adbOnline неизвестен (не boolean)
  if (!isAdbKnown) {
    return {
      id: "unknown",
      label: "Проверка подключения",
      description: "Проверка подключения к ADB",
      tone: "neutral",
      stageLabel: null,
      busy: true,
      action: null,
    }
  }

  // 10. ADB доступен, bootCompleted === false
  if (emulator.bootCompleted === false) {
    return {
      id: "booting",
      label: "Загрузка Android",
      description: "Операционная система Android загружается",
      tone: "info",
      stageLabel: null,
      busy: true,
      action: null,
    }
  }

  // 11. ADB доступен, загрузка неизвестна (не boolean)
  if (!isBootKnown) {
    return {
      id: "unknown",
      label: "Проверка Android",
      description: "Проверка состояния загрузки Android",
      tone: "neutral",
      stageLabel: null,
      busy: true,
      action: null,
    }
  }

  // 12. ADB доступен, Android загружен, настройка ready
  if (setup?.state === "ready") {
    const stageLabel = translateSetupStage(setup.stage)
    return {
      id: "setup_complete",
      label: "Настройка завершена",
      description: "Настройка завершена. Проверьте вход в Viber на экране",
      tone: "success",
      stageLabel: stageLabel || null,
      busy: false,
      action: "open_screen",
    }
  }

  // 13. ADB доступен, Android загружен, результата настройки нет
  return {
    id: "android_ready",
    label: "Android загружен",
    description: "Android загружен, настройка не подтверждена",
    tone: "info",
    stageLabel: null,
    busy: false,
    action: null,
  }
}

export function getAdbDetail(adbOnline?: boolean | null): {
  text: string
  variant: "success" | "danger" | "muted"
} {
  if (typeof adbOnline !== "boolean") return { text: "неизвестно", variant: "muted" }
  return adbOnline
    ? { text: "подключён", variant: "success" }
    : { text: "недоступен", variant: "danger" }
}

export function getAndroidDetail(bootCompleted?: boolean | null): {
  text: string
  variant: "success" | "warning" | "muted"
} {
  if (typeof bootCompleted !== "boolean") return { text: "неизвестно", variant: "muted" }
  return bootCompleted
    ? { text: "загружен", variant: "success" }
    : { text: "загружается", variant: "warning" }
}

export function getViberDetail(viberRunning?: boolean | null): {
  text: string
  variant: "success" | "warning" | "muted"
} {
  if (typeof viberRunning !== "boolean") return { text: "неизвестно", variant: "muted" }
  return viberRunning
    ? { text: "запущен", variant: "success" }
    : { text: "не запущен", variant: "warning" }
}

/**
 * Разбивка номера по группам для кодов стран, которые встречаются в проекте.
 * Для остальных номер делится по три цифры — читаемо и без справочника.
 */
const PHONE_GROUPINGS: Record<string, number[]> = {
  "1": [3, 3, 4],
  "7": [3, 3, 2, 2],
  "48": [3, 3, 3],
  "375": [2, 3, 2, 2],
  "380": [2, 3, 2, 2],
}

export function formatPhoneNumber(phoneNumber: string | null | undefined): string {
  if (!phoneNumber) return ""
  const digits = phoneNumber.replace(/\D/g, "")
  if (!digits) return ""

  let code = ""
  for (const length of [3, 2, 1]) {
    const candidate = digits.slice(0, length)
    if (PHONE_GROUPINGS[candidate]) {
      code = candidate
      break
    }
  }

  const rest = digits.slice(code.length)
  const pattern = code ? PHONE_GROUPINGS[code] ?? [] : []
  const chunks: string[] = []
  let cursor = 0

  for (const size of pattern) {
    if (cursor >= rest.length) break
    chunks.push(rest.slice(cursor, cursor + size))
    cursor += size
  }
  while (cursor < rest.length) {
    chunks.push(rest.slice(cursor, cursor + 3))
    cursor += 3
  }

  const tail = chunks.join(" ")
  if (!code) return `+${tail}`
  return tail ? `+${code} ${tail}` : `+${code}`
}

export function formatViberAccount(account: ViberAccountInfo | null | undefined): string {
  if (!account) return ""
  const name = account.displayName?.trim() || ""
  const phone = formatPhoneNumber(account.phoneNumber)
  return [name, phone].filter(Boolean).join(" · ")
}

export function getAuthDetail(account?: ViberAccountInfo | null): {
  text: string
  variant: "success" | "warning" | "muted"
} {
  const label = formatViberAccount(account)
  if (!account || !label) return { text: "Вход не выполнен", variant: "muted" }
  if (account.status === "pending") return { text: `Ожидает код: ${label}`, variant: "warning" }
  return { text: `Вход: ${label}`, variant: "success" }
}
