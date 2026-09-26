export class ViberApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "ViberApiError"
    this.status = status
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return "Неизвестная ошибка"
}

export interface ViberRequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE"
  body?: unknown
  signal?: AbortSignal
}

/** Единая точка обращения к прокси /api/viber/*: ошибки всегда в поле error. */
export async function viberRequest<T>(
  path: string,
  options: ViberRequestOptions = {}
): Promise<T> {
  const response = await fetch(`/api/viber/${path}`, {
    method: options.method ?? "GET",
    cache: "no-store",
    headers: options.body === undefined ? undefined : { "Content-Type": "application/json" },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
  })

  if (response.status === 204) {
    return undefined as T
  }

  const text = await response.text()
  let payload: unknown = null
  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = { error: text }
    }
  }

  if (!response.ok) {
    const apiError = payload as { error?: string; message?: string } | null
    throw new ViberApiError(
      apiError?.error || apiError?.message || `Ошибка запроса (${response.status})`,
      response.status
    )
  }

  return payload as T
}
