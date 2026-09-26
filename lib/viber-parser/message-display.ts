import type { MonitoredMessageDto } from "@/lib/viber-parser/types"

const MEDIA_URI_RE = /^(content|file|android\.resource):\/\//i
const HTTP_IMAGE_RE = /^https?:\/\/\S+\.(?:jpg|jpeg|png|gif|webp)(?:\?|$)/i

export function isMediaUri(value: string | null | undefined): boolean {
  const trimmed = value?.trim() ?? ""
  if (!trimmed) return false
  return MEDIA_URI_RE.test(trimmed) || HTTP_IMAGE_RE.test(trimmed)
}

export function messageHasMedia(
  msg: Pick<MonitoredMessageDto, "body" | "hasMedia" | "mediaUris">
): boolean {
  if (msg.hasMedia === true) return true
  if ((msg.mediaUris ?? []).some((uri) => isMediaUri(uri))) return true
  return isMediaUri(msg.body)
}

export function messagePreviewText(
  msg: Pick<MonitoredMessageDto, "body" | "hasMedia" | "mediaUris">
): string {
  const body = msg.body?.trim() ?? ""
  if (!body || isMediaUri(body)) return ""
  return body
}
