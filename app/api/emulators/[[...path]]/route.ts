import { NextRequest, NextResponse } from "next/server"

const DEFAULT_PARSER_URL = "http://127.0.0.1:8080"
const UPSTREAM_TIMEOUT_MS = 60_000

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

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: NextRequest, context: RouteContext) {
  const pathParts = context.params.path || []
  const subPath = pathParts.length > 0 ? `/${pathParts.join("/")}` : ""
  const origin = parserOrigin()
  const search = request.nextUrl.search

  try {
    const upstream = await fetch(`${origin}/api/emulators${subPath}${search}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    })

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
  } catch (error: unknown) {
    return NextResponse.json(
      { error: "Не удалось связаться с сервисом управления" },
      { status: 502 }
    )
  }
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
  } catch (error: unknown) {
    return NextResponse.json(
      { error: "Не удалось выполнить команду для инстанса" },
      { status: 502 }
    )
  }
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
  } catch (error: unknown) {
    return NextResponse.json(
      { error: "Не удалось удалить инстанс" },
      { status: 502 }
    )
  }
}
