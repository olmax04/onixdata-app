export type QrAuthState =
  | "idle"
  | "starting"
  | "qr_ready"
  | "scanned"
  | "finishing"
  | "ready"
  | "error"
  | "unknown_screen"

export interface QrCode {
  payload?: string
  /** The code re-drawn as vectors — what the dialog shows when it exists. */
  svg?: string
  /** The code as pixels, cut out of the screenshot; used when decoding failed. */
  pngBase64?: string
  capturedAt: string
}

export interface QrAuthStatus {
  state: QrAuthState
  qr?: QrCode
  screenHint?: string
  /** Only sent with `unknown_screen`, so the operator can see what Viber shows. */
  screenshotBase64?: string
  error?: string
}

export type QrStatusTone = "neutral" | "info" | "success" | "warning" | "danger"

export interface DescribedQrStatus {
  label: string
  tone: QrStatusTone
  /** Whether something is happening that the operator just has to wait out. */
  busy: boolean
}

/** Fast enough to catch a scan quickly, slow enough not to flood the device. */
export const QR_POLL_INTERVAL_MS = 2000

const LABELS: Record<QrAuthState, DescribedQrStatus> = {
  idle: { label: "Не запущено", tone: "neutral", busy: false },
  starting: { label: "Открываем Viber и готовим QR-код…", tone: "info", busy: true },
  qr_ready: { label: "Ожидание сканирования", tone: "info", busy: false },
  scanned: { label: "Отсканировано, подтверждаем…", tone: "info", busy: true },
  finishing: { label: "Настраиваем Viber, почти готово…", tone: "info", busy: true },
  ready: { label: "Готово — Viber авторизован", tone: "success", busy: false },
  error: { label: "Ошибка авторизации", tone: "danger", busy: false },
  unknown_screen: {
    label: "Viber показывает незнакомый экран — посмотрите скриншот",
    tone: "warning",
    busy: false,
  },
}

/**
 * Turns a status payload into the one line the dialog shows.
 *
 * The server's own error text wins over the generic label: it names the actual
 * problem ("устройство занято", "номер ушёл на SMS"), which is the difference
 * between an operator who knows what to do and one who retries blindly.
 */
export function describeQrStatus(status: QrAuthStatus): DescribedQrStatus {
  const base = LABELS[status.state] ?? LABELS.idle
  if (status.state === "error" && status.error) {
    return { ...base, label: status.error }
  }
  return base
}

/** Whether the dialog should keep polling. */
export function isQrSessionLive(state: QrAuthState): boolean {
  return state === "starting" || state === "qr_ready" || state === "scanned" || state === "finishing" || state === "unknown_screen"
}

export type QrImageSource =
  | { kind: "svg"; markup: string }
  | { kind: "png"; src: string }

/**
 * What to draw for the code.
 *
 * The SVG is re-rendered from the decoded payload, so it is sharp however big
 * the dialog makes it; the PNG is a 150px crop off the emulator screen and only
 * appears when the decode failed, which is why it is the second choice.
 */
export function qrImageSource(qr: QrCode | undefined): QrImageSource | null {
  if (!qr) return null
  if (qr.svg) return { kind: "svg", markup: qr.svg }
  if (qr.pngBase64) return { kind: "png", src: `data:image/png;base64,${qr.pngBase64}` }
  return null
}
