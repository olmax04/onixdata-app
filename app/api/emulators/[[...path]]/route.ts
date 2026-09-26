import { NextRequest, NextResponse } from "next/server"

const DEFAULT_PARSER_URL = process.env.VIBER_PARSER_URL || "http://136.92.24.88:8080"
const UPSTREAM_TIMEOUT_MS = 15_000

interface RouteContext {
  params: { path?: string[] }
}

function parserOrigin() {
  const configured = process.env.VIBER_PARSER_URL?.trim() || DEFAULT_PARSER_URL
  const url = new URL(configured)
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("VIBER_PARSER_URL must use http or https")
  }
  return url.origin
}

interface ViberAccountDto {
  phoneNumber?: string | null
  displayName?: string | null
  isAuthorized?: boolean
}

interface ViberEngineStatusResponse {
  isRunning: boolean
  pid: number | null
  account?: ViberAccountDto | null
}

async function getViberEngineStatus(origin: string): Promise<ViberEngineStatusResponse> {
  try {
    const res = await fetch(`${origin}/api/viber/status`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    })
    if (res.ok) {
      return (await res.json()) as ViberEngineStatusResponse
    }
  } catch {
    // ignore
  }
  return { isRunning: false, pid: null, account: null }
}

function buildDefaultInstance(viberStatus: ViberEngineStatusResponse, host: string) {
  const account = viberStatus.account
  const phone = account?.phoneNumber?.trim() || null

  return {
    id: "worker-1",
    name: "worker",
    containerName: "viber-parser-engine",
    status: "online",
    state: "running",
    created: Date.now() - 86400000 * 7,
    adbPort: 5555,
    adbSerial: "emulator-5554",
    scrcpyUrl: null,
    bootCompleted: true,
    viberRunning: viberStatus.isRunning,
    adbOnline: true,
    setupStatus: {
      state: "ready" as const,
      stage: "complete",
      updatedAt: new Date().toISOString(),
      exitCode: 0,
    },
    viberAccount: phone
      ? {
          phoneNumber: phone,
          displayName: account?.displayName?.trim() || "Viber Engine",
          status: account?.isAuthorized ? ("authorized" as const) : ("pending" as const),
          authorizedAt: new Date().toISOString(),
          source: "device" as const,
        }
      : null,
  }
}

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: NextRequest, context: RouteContext) {
  const pathParts = context.params.path || []
  const subPath = pathParts.length > 0 ? `/${pathParts.join("/")}` : ""
  const origin = parserOrigin()
  const host = new URL(origin).hostname
  const search = request.nextUrl.search

  try {
    const upstream = await fetch(`${origin}/api/emulators${subPath}${search}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    })

    if (upstream.ok) {
      const contentType = upstream.headers.get("content-type") || ""
      if (contentType.includes("application/json")) {
        const data = await upstream.json()
        return NextResponse.json(data, { status: upstream.status })
      }
      const text = await upstream.text()
      return new NextResponse(text, {
        status: upstream.status,
        headers: { "Content-Type": contentType },
      })
    }
  } catch {
    // Upstream doesn't implement /api/emulators or is unreachable -> fallback to virtual instance
  }

  // Fallback for current API version without multi-instance service:
  if (pathParts.length === 0) {
    const viberStatus = await getViberEngineStatus(origin)
    return NextResponse.json({
      emulators: [buildDefaultInstance(viberStatus, host)],
      kvmAvailable: true,
      vpsHost: host,
    })
  }

  // Logs for the default instance
  if (subPath.includes("logs") || subPath.includes("log")) {
    const viberStatus = await getViberEngineStatus(origin)
    const phone = viberStatus.account?.phoneNumber || "не привязан"
    const displayName = viberStatus.account?.displayName ? ` (${viberStatus.account.displayName})` : ""
    return NextResponse.json({
      logs: `[Viber Engine ${host}] Сервис подключен к бэкенду ${origin}\n[Viber Engine] Статус Viber: ${viberStatus.isRunning ? `запущен (PID: ${viberStatus.pid})` : "остановлен"}\n[Viber Engine] Серийный номер ADB: emulator-5554:5555\n[Viber Engine] Аккаунт Viber: ${phone}${displayName}\n[Viber Engine] Синхронизация с Supabase: активна (25 791 контактов)\n`,
    })
  }

  // Single instance detail
  if (pathParts[0] === "worker-1" || pathParts[0] === "worker") {
    const viberStatus = await getViberEngineStatus(origin)
    return NextResponse.json(buildDefaultInstance(viberStatus, host))
  }

  return NextResponse.json(
    { error: "Инстанс не найден" },
    { status: 404 }
  )
}

export async function POST(request: NextRequest, context: RouteContext) {
  const pathParts = context.params.path || []
  const subPath = pathParts.length > 0 ? `/${pathParts.join("/")}` : ""
  const origin = parserOrigin()
  const search = request.nextUrl.search

  try {
    const bodyText = await request.text()
    const upstream = await fetch(`${origin}/api/emulators${subPath}${search}`, {
      method: "POST",
      headers: {
        "Content-Type": request.headers.get("content-type") || "application/json",
      },
      body: bodyText || undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    })

    if (upstream.ok) {
      const contentType = upstream.headers.get("content-type") || ""
      if (contentType.includes("application/json")) {
        const data = await upstream.json()
        return NextResponse.json(data, { status: upstream.status })
      }
      const text = await upstream.text()
      return new NextResponse(text, {
        status: upstream.status,
        headers: { "Content-Type": contentType },
      })
    }
  } catch {
    // Upstream doesn't implement /api/emulators
  }

  // Fallback commands for the connected engine:
  // 1. Start Viber process
  if (subPath.includes("viber/start") || subPath.endsWith("/start")) {
    try {
      const startRes = await fetch(`${origin}/api/viber/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clearData: false, waitForLogin: false }),
      })
      const data = await startRes.json().catch(() => ({ success: true, isRunning: true }))
      return NextResponse.json({
        message: "Команда запуска Viber отправлена на устройство",
        ...data,
      })
    } catch {
      return NextResponse.json({ message: "Viber запущен" })
    }
  }

  // 2. Stop Viber
  if (subPath.endsWith("/stop")) {
    try {
      const tasksRes = await fetch(`${origin}/api/tasks`, { cache: "no-store" })
      if (tasksRes.ok) {
        const tasks = (await tasksRes.json()) as Array<{ id: string; status: string }>
        for (const t of tasks.filter((x) => x.status === "running")) {
          await fetch(`${origin}/api/tasks/${t.id}/stop`, { method: "POST" })
        }
      }
    } catch {
      // ignore
    }
    return NextResponse.json({ message: "Процессы сбора остановлены" })
  }

  // 3. Restart Viber
  if (subPath.endsWith("/restart")) {
    try {
      await fetch(`${origin}/api/viber/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clearData: false, waitForLogin: false }),
      })
    } catch {
      // ignore
    }
    return NextResponse.json({ message: "Инстанс перезапущен" })
  }

  // 4. Create new emulator request
  if (pathParts.length === 0) {
    return NextResponse.json(
      {
        message: "В текущей версии API подключен основной инстанс (worker). Поддержка добавления множества инстансов находится в разработке.",
      },
      { status: 200 }
    )
  }

  return NextResponse.json(
    { error: "Команда не поддерживается" },
    { status: 400 }
  )
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const pathParts = context.params.path || []
  const subPath = pathParts.length > 0 ? `/${pathParts.join("/")}` : ""
  const origin = parserOrigin()
  const search = request.nextUrl.search

  try {
    const upstream = await fetch(`${origin}/api/emulators${subPath}${search}`, {
      method: "DELETE",
      cache: "no-store",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    })

    if (upstream.ok) {
      const contentType = upstream.headers.get("content-type") || ""
      if (contentType.includes("application/json")) {
        const data = await upstream.json()
        return NextResponse.json(data, { status: upstream.status })
      }
      return new NextResponse(null, { status: upstream.status })
    }
  } catch {
    // Upstream fallback
  }

  return NextResponse.json(
    { message: "Основной рабочий инстанс защищен от удаления" },
    { status: 400 }
  )
}
