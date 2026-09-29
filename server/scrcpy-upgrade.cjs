"use strict"

/**
 * WebSocket-часть прокси экрана: `wss://<панель>/scrcpy/…` → `ws://<VPS>:8000/…`.
 *
 * HTTP-запросы к `/scrcpy/*` проксирует middleware (lib/scrcpy-proxy.ts), но
 * WebSocket так не пройдёт: Next.js 14 при апгрейде отдаёт middleware сокет
 * вместо ответа и падает. Поэтому апгрейды `/scrcpy/*` перехватываются до Next.
 *
 * Авторизация и адрес scrcpy-web берутся у самой панели — внутренним запросом
 * к `/api/scrcpy/session` с куками пользователя. Так проверку делает тот же
 * middleware, что и для остальных API, а логика не дублируется здесь.
 */

const SCRCPY_PREFIX = "/scrcpy"
const SESSION_PATH = "/api/scrcpy/session"
const SESSION_TIMEOUT_MS = 10_000
/** Куки и токен панели на VPS не уходят: туда запрос идёт по голому HTTP. */
const STRIPPED_HEADERS = ["cookie", "authorization"]

function isScrcpyUpgrade(url) {
  if (!url) return false
  const pathname = url.split("?")[0]
  return pathname === SCRCPY_PREFIX || pathname.startsWith(`${SCRCPY_PREFIX}/`)
}

/** Путь на scrcpy-web: префикс панели срезается, query (`action=proxy-adb…`) сохраняется. */
function upstreamTarget(upstream, url) {
  const [pathname, ...rest] = url.split("?")
  const target = new URL(pathname.slice(SCRCPY_PREFIX.length) || "/", upstream)
  target.search = rest.length > 0 ? `?${rest.join("?")}` : ""
  return target.toString()
}

function reject(socket, status, reason) {
  if (!socket.destroyed) {
    socket.end(`HTTP/1.1 ${status} ${reason}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`)
  }
}

/**
 * @param {object} options
 * @param {string} options.sessionOrigin адрес самой панели изнутри контейнера
 * @param {(target: string) => { ws: Function, on: Function }} [options.createProxy]
 */
function createScrcpyUpgradeHandler({ sessionOrigin, createProxy = defaultProxy }) {
  async function loadSession(req) {
    const headers = {}
    if (req.headers.cookie) headers.cookie = req.headers.cookie
    if (req.headers.authorization) headers.authorization = req.headers.authorization
    const res = await fetch(`${sessionOrigin}${SESSION_PATH}`, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(SESSION_TIMEOUT_MS),
    })
    if (!res.ok) return { status: res.status, upstream: null }
    const body = await res.json().catch(() => null)
    return { status: res.status, upstream: typeof body?.upstream === "string" ? body.upstream : null }
  }

  return async function handleScrcpyUpgrade(req, socket, head) {
    socket.on("error", () => {})

    let session
    try {
      session = await loadSession(req)
    } catch {
      return reject(socket, 502, "Bad Gateway")
    }
    if (session.status === 401 || session.status === 403) {
      return reject(socket, 401, "Unauthorized")
    }
    if (!session.upstream) return reject(socket, 503, "Service Unavailable")

    for (const name of STRIPPED_HEADERS) delete req.headers[name]

    const proxy = createProxy(upstreamTarget(session.upstream, req.url))
    proxy.on("error", () => reject(socket, 502, "Bad Gateway"))
    proxy.ws(req, socket, head)
  }
}

function defaultProxy(target) {
  // http-proxy уже есть внутри Next.js: им же Next проксирует внешние rewrites.
  const HttpProxy = require("next/dist/compiled/http-proxy")
  return new HttpProxy({ target, ignorePath: true, changeOrigin: true, ws: true })
}

/**
 * Встраивает перехват в http-сервер, который создаст Next.js: обработчик
 * `upgrade` из Next оборачивается, `/scrcpy/*` уходит в прокси, остальное — как было.
 */
function installScrcpyUpgradeHook(http, handler) {
  const createServer = http.createServer
  http.createServer = function patchedCreateServer(...args) {
    http.createServer = createServer
    const server = createServer.apply(this, args)
    const on = server.on
    server.on = function patchedOn(event, listener) {
      if (event !== "upgrade") return on.call(this, event, listener)
      return on.call(this, event, (req, socket, head) =>
        isScrcpyUpgrade(req.url) ? handler(req, socket, head) : listener(req, socket, head)
      )
    }
    return server
  }
}

module.exports = {
  createScrcpyUpgradeHandler,
  installScrcpyUpgradeHook,
  isScrcpyUpgrade,
  upstreamTarget,
}
