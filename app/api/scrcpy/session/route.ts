import { NextResponse } from "next/server"

import { scrcpyUpstreamOrigin } from "@/lib/scrcpy"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * Проверка перед WebSocket-трансляцией экрана (см. `server/scrcpy-upgrade.cjs`).
 *
 * Авторизацию проверяет middleware, как у остальных `/api/*`: досюда доходит
 * только вошедший пользователь. В ответе — адрес scrcpy-web, чтобы он
 * вычислялся в одном месте, а не дублировался в обработчике апгрейдов.
 */
export function GET() {
  const upstream = scrcpyUpstreamOrigin()
  if (!upstream) {
    return NextResponse.json(
      { error: "Трансляция экрана не настроена: задайте SCRCPY_URL" },
      { status: 503 }
    )
  }
  return NextResponse.json({ upstream }, { headers: { "Cache-Control": "no-store" } })
}
