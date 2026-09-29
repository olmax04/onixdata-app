import { NextResponse, type NextRequest } from "next/server"

import { SCRCPY_PROXY_PAGE, SCRCPY_PROXY_PATH, scrcpyUpstreamOrigin } from "./scrcpy"

/**
 * Заголовки, которые не уходят в scrcpy-web: там они не нужны, а до VPS
 * запрос идёт по голому HTTP — сессию Supabase туда отдавать нельзя.
 */
const STRIPPED_REQUEST_HEADERS = ["cookie", "authorization"]

export function isScrcpyProxyPath(pathname: string): boolean {
  return pathname === SCRCPY_PROXY_PATH || pathname.startsWith(`${SCRCPY_PROXY_PATH}/`)
}

/**
 * Проксирование `/scrcpy/*` панели в scrcpy-web на VPS.
 *
 * Панель открыта по HTTPS, а scrcpy-web слушает голый HTTP — браузер не даёт
 * встроить такую страницу в iframe (Mixed Content). Через rewrite страница,
 * статика и WebSocket (`?action=proxy-adb`) отдаются с домена панели: Next.js
 * проксирует и HTTP, и upgrade-запросы на внешний адрес rewrite.
 */
export function scrcpyProxyResponse(
  request: NextRequest,
  upstream: string | null = scrcpyUpstreamOrigin()
): NextResponse {
  const { pathname, search } = request.nextUrl

  // ws-scrcpy грузит bundle.js, avc.wasm и воркеры относительными путями:
  // со страницы `/scrcpy` они ушли бы в корень панели, а не в /scrcpy/.
  // `/scrcpy/` сюда тоже приходит как `/scrcpy` — слеш срезает сам Next.js.
  // Фрагмент `#!action=stream…` браузер сохраняет при редиректе сам.
  if (pathname === SCRCPY_PROXY_PATH) {
    return NextResponse.redirect(new URL(`${SCRCPY_PROXY_PAGE}${search}`, request.url), 308)
  }

  if (!upstream) {
    return NextResponse.json(
      { error: "Трансляция экрана не настроена: задайте SCRCPY_URL" },
      { status: 503 }
    )
  }

  const target = new URL(pathname.slice(SCRCPY_PROXY_PATH.length) || "/", upstream)
  target.search = search

  const headers = new Headers(request.headers)
  for (const name of STRIPPED_REQUEST_HEADERS) headers.delete(name)

  return NextResponse.rewrite(target, { request: { headers } })
}
