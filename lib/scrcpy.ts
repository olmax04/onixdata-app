/**
 * Ссылки на экран эмулятора в ws-scrcpy (сервис `scrcpy-web` на VPS).
 *
 * Рабочий адрес трансляции выглядит так:
 *
 *   http://<host>:8000/#!action=stream&udid=host.docker.internal%3A5557&player=broadway
 *     &ws=ws%3A%2F%2F<host>%3A8000%2F%3Faction%3Dproxy-adb%26remote%3Dtcp%253A8886%26udid%3D...
 *
 * `ws` — не корень сервера, а `proxy-adb` до scrcpy-server на устройстве
 * (tcp:8886): с голым `ws://<host>:8000/` поток не стартует. Плеер — broadway:
 * MSE в iframe и на части браузеров показывает чёрный экран.
 *
 * Модуль без зависимостей от окружения: им пользуются и клиент, и middleware.
 */

/** Путь, по которому панель проксирует scrcpy-web на своём домене (см. middleware). */
export const SCRCPY_PROXY_PATH = "/scrcpy"
/**
 * Страница ws-scrcpy за прокси. Не `/scrcpy/`: Next.js сам срезает
 * завершающий слеш редиректом, а WebSocket редирект не переживёт.
 */
export const SCRCPY_PROXY_PAGE = `${SCRCPY_PROXY_PATH}/index.html`
export const SCRCPY_DEFAULT_PORT = 8000
/** Порт scrcpy-server на устройстве, к которому ws-scrcpy ходит через `proxy-adb`. */
export const SCRCPY_DEVICE_SERVER_PORT = 8886
export const SCRCPY_PLAYER = "broadway"
const DEFAULT_ADB_PORT = 5555
const DEVICE_HOST = "host.docker.internal"

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"])

/**
 * Адреса, которые имеют смысл только на самом VPS: агент, запущенный без
 * HOST_PUBLIC_IP, отдаёт `localhost`, и из браузера такая ссылка ведёт в никуда.
 */
export function isLoopbackHost(hostname: string): boolean {
  return LOOPBACK_HOSTS.has(hostname.trim().toLowerCase())
}

function hashParams(url: URL): URLSearchParams {
  return new URLSearchParams(url.hash.replace(/^#!?/, ""))
}

/**
 * udid устройства в ws-scrcpy: из готовой ссылки агента, иначе по ADB-порту
 * (scrcpy-web подключает эмуляторы как `host.docker.internal:<adbPort>`).
 */
export function resolveScrcpyUdid(
  rawUrl: string | null | undefined,
  adbPort?: number | null
): string {
  if (rawUrl) {
    try {
      const udid = hashParams(new URL(rawUrl)).get("udid")?.trim()
      if (udid) return udid
    } catch {
      // Битая ссылка — берём udid по порту.
    }
  }
  return `${DEVICE_HOST}:${adbPort || DEFAULT_ADB_PORT}`
}

/**
 * Страница трансляции ws-scrcpy для устройства `udid`.
 *
 * `pageUrl` — где отдаётся ws-scrcpy: `http://host:8000/` напрямую или
 * `https://panel/scrcpy/index.html` через прокси панели. WebSocket идёт на тот
 * же адрес, поэтому на HTTPS он автоматически становится `wss://`.
 */
export function buildScrcpyStreamUrl(pageUrl: string, udid: string): string {
  const page = new URL(pageUrl)
  page.search = ""
  page.hash = ""

  const ws = new URL(page.toString())
  ws.protocol = page.protocol === "https:" ? "wss:" : "ws:"
  ws.search = new URLSearchParams({
    action: "proxy-adb",
    remote: `tcp:${SCRCPY_DEVICE_SERVER_PORT}`,
    udid,
  }).toString()

  const hash = new URLSearchParams({
    action: "stream",
    udid,
    player: SCRCPY_PLAYER,
    ws: ws.toString(),
  }).toString()

  return `${page.toString()}#!${hash}`
}

/**
 * Прямая ссылка на scrcpy-web для конкретного эмулятора.
 *
 * Хост из ссылки агента сохраняется, если он публичный. Loopback-хост
 * заменяется на `publicOrigin` — адрес scrcpy-web, известный серверу панели.
 */
export function formatScrcpyStreamUrl(
  rawUrl: string | null | undefined,
  adbPort?: number | null,
  publicOrigin?: string | null
): string | null {
  if (!rawUrl) return null
  let origin: string
  try {
    const url = new URL(rawUrl)
    origin = url.origin
    if (isLoopbackHost(url.hostname) && publicOrigin) {
      origin = new URL(publicOrigin).origin
    }
  } catch {
    return null
  }
  return buildScrcpyStreamUrl(`${origin}/`, resolveScrcpyUdid(rawUrl, adbPort))
}

/**
 * Ссылка на трансляцию через прокси панели: тот же протокол и домен, что у
 * самой панели, поэтому iframe не упирается в блокировку Mixed Content.
 */
export function panelScrcpyStreamUrl(
  panelOrigin: string,
  rawUrl: string | null | undefined,
  adbPort?: number | null
): string | null {
  if (!rawUrl) return null
  try {
    return buildScrcpyStreamUrl(
      `${new URL(panelOrigin).origin}${SCRCPY_PROXY_PAGE}`,
      resolveScrcpyUdid(rawUrl, adbPort)
    )
  } catch {
    return null
  }
}

/**
 * Адрес scrcpy-web, куда панель проксирует `/scrcpy/*`, из серверного окружения.
 *
 * `SCRCPY_URL` задаёт его явно; иначе берётся хост emulator-agent или
 * Viber-parser (scrcpy-web живёт на том же VPS) и стандартный порт 8000.
 */
export function scrcpyUpstreamOrigin(
  env: Record<string, string | undefined> = process.env
): string | null {
  const explicit = env.SCRCPY_URL?.trim()
  if (explicit) {
    try {
      const url = new URL(explicit)
      if (url.protocol === "http:" || url.protocol === "https:") return url.origin
    } catch {
      // Некорректное значение — пробуем вывести адрес из соседних сервисов.
    }
  }

  for (const candidate of [env.EMULATOR_AGENT_URL, env.VPS_AGENT_URL, env.VIBER_PARSER_URL]) {
    const value = candidate?.trim()
    if (!value) continue
    try {
      const url = new URL(value)
      if (url.protocol !== "http:" && url.protocol !== "https:") continue
      return `http://${url.hostname}:${SCRCPY_DEFAULT_PORT}`
    } catch {
      continue
    }
  }
  return null
}
