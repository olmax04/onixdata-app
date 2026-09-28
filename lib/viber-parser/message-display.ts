import type { MonitoredMessageDto } from "@/lib/viber-parser/types"

const MEDIA_URI_RE = /^(content|file|android\.resource):\/\//i
const HTTP_IMAGE_RE = /^https?:\/\/\S+\.(?:jpg|jpeg|png|gif|webp)(?:\?|$)/i

export function isMediaUri(value: string | null | undefined): boolean {
  const trimmed = value?.trim() ?? ""
  if (!trimmed) return false
  return MEDIA_URI_RE.test(trimmed) || HTTP_IMAGE_RE.test(trimmed)
}

function parseRichMedia(body: string | null | undefined): { text: string | null; hasMedia: boolean } | null {
  const trimmed = body?.trim() ?? ""
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) return null
  try {
    const parsed = JSON.parse(trimmed)
    if (!Array.isArray(parsed) || parsed.length === 0) return null
    const texts: string[] = []
    let hasMedia = false
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue
      if (item.Type === "img" || isMediaUri(item.ImageUrl) || isMediaUri(item.MediaUrl)) {
        hasMedia = true
      }
      const text = typeof item.Text === "string" ? item.Text.trim() : ""
      if (text) {
        texts.push(text)
      } else if (typeof item.PushText === "string" && item.PushText.trim() && texts.length === 0) {
        texts.push(item.PushText.trim())
      }
    }
    const uniqueTexts = Array.from(new Set(texts))
    return {
      text: uniqueTexts.length > 0 ? uniqueTexts.join("\n\n") : null,
      hasMedia,
    }
  } catch {
    return null
  }
}

export function messageHasMedia(
  msg: Pick<MonitoredMessageDto, "body" | "hasMedia" | "mediaUris">
): boolean {
  if (msg.hasMedia === true) return true
  if ((msg.mediaUris ?? []).some((uri) => isMediaUri(uri))) return true
  if (isMediaUri(msg.body)) return true
  const rich = parseRichMedia(msg.body)
  if (rich?.hasMedia) return true
  return false
}

export function messagePreviewText(
  msg: Pick<MonitoredMessageDto, "body" | "hasMedia" | "mediaUris">
): string {
  const body = msg.body?.trim() ?? ""
  if (!body || isMediaUri(body)) return ""
  const rich = parseRichMedia(body)
  if (rich) return rich.text ?? ""
  return body
}
