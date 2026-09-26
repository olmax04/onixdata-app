/** Запрос к API парсера Viber через прокси Next. Бросает Error с текстом сервиса. */
export async function viberJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/viber/${path}`, { cache: "no-store", ...init })
  if (res.status === 204) return undefined as T
  const text = await res.text()
  let payload: { error?: string; message?: string } | T | null = null
  if (text) {
    try {
      payload = JSON.parse(text) as T
    } catch {
      payload = null
    }
  }
  if (!res.ok) {
    const err = payload as { error?: string; message?: string } | null
    throw new Error(err?.message || err?.error || `Ошибка запроса (${res.status})`)
  }
  return payload as T
}
