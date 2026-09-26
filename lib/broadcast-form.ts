import type {
  BroadcastCampaign,
  BroadcastCampaignStatus,
  BroadcastRotation,
} from "@/lib/viber-parser/types"

/** Минимальная пауза, которую принимает API рассылки. */
export const MIN_INTERVAL_MS = 5_000

export const ROTATION_LABELS: Record<BroadcastRotation, string> = {
  "round-robin": "По кругу",
  random: "Случайно",
  "shuffle-cycle": "Перемешанный цикл",
}

export const STATUS_LABELS: Record<BroadcastCampaignStatus, string> = {
  idle: "Черновик",
  running: "Идёт рассылка",
  stopped: "Остановлена",
  error: "Ошибка",
}

export function formatBroadcastTime(iso: string | null | undefined): string {
  if (!iso) return "—"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function variantCountLabel(count: number): string {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return `${count} вариант`
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} варианта`
  return `${count} вариантов`
}

export function hoursLabel(from: string | null | undefined, to: string | null | undefined): string {
  if (!from || !to) return "круглосуточно"
  return `${from}–${to}`
}

export function isNowWithinHours(
  from: string | null | undefined,
  to: string | null | undefined
): boolean {
  if (!from || !to || from === to) return true
  const parse = (value: string): number => {
    const [hours, minutes] = value.split(":").map(Number)
    return (hours ?? 0) * 60 + (minutes ?? 0)
  }
  const start = parse(from)
  const end = parse(to)
  const now = new Date()
  const current = now.getHours() * 60 + now.getMinutes()
  return start < end ? current >= start && current < end : current >= start || current < end
}

export interface CampaignFormState {
  name: string
  conversationIds: number[]
  messages: string[]
  intervalMinutes: string
  cooldownMinutes: string
  activeFrom: string
  activeTo: string
  rotation: BroadcastRotation
  loop: boolean
}

export interface CampaignPayload {
  name?: string
  conversationIds: number[]
  groupNames: Record<string, string>
  messages: string[]
  intervalMs: number
  minIntervalPerChatMs: number
  rotation: BroadcastRotation
  loop: boolean
  activeFrom: string | null
  activeTo: string | null
}

export type CampaignPatch = Partial<CampaignPayload>

export function emptyCampaignForm(): CampaignFormState {
  return {
    name: "",
    conversationIds: [],
    messages: [""],
    intervalMinutes: "2",
    cooldownMinutes: "30",
    activeFrom: "09:00",
    activeTo: "21:00",
    rotation: "shuffle-cycle",
    loop: true,
  }
}

/** Переносы строк внутри поля — часть одного текста, делить их нельзя. */
export function cleanMessages(messages: string[]): string[] {
  return messages.map((text) => text.trim()).filter((text) => text !== "")
}

export function minutesToMs(minutes: string): number {
  const value = Number(minutes.trim())
  if (minutes.trim() === "" || !Number.isFinite(value)) return Number.NaN
  return Math.round(value * 60_000)
}

/** Без округления: minutesToMs(msToMinutes(ms)) обязан вернуть исходные миллисекунды. */
export function msToMinutes(ms: number): string {
  if (!Number.isFinite(ms)) return ""
  return String(ms / 60_000)
}

function toClock(value: string): string {
  return value.trim().slice(0, 5)
}

export function campaignToFormState(campaign: BroadcastCampaign): CampaignFormState {
  return {
    name: campaign.name,
    conversationIds: campaign.groups.map((group) => group.conversationId),
    messages: campaign.messages.length ? [...campaign.messages] : [""],
    intervalMinutes: msToMinutes(campaign.intervalMs),
    cooldownMinutes: msToMinutes(campaign.minIntervalPerChatMs),
    activeFrom: campaign.activeFrom ?? "",
    activeTo: campaign.activeTo ?? "",
    rotation: campaign.rotation,
    loop: campaign.loop,
  }
}

/** Возвращает текст ошибки для тоста или null, если форму можно отправлять. */
export function validateCampaignForm(state: CampaignFormState): string | null {
  if (state.conversationIds.length === 0) {
    return "Выберите хотя бы одну группу"
  }
  if (cleanMessages(state.messages).length === 0) {
    return "Добавьте хотя бы один текст сообщения"
  }

  const intervalMs = minutesToMs(state.intervalMinutes)
  if (!Number.isFinite(intervalMs) || intervalMs < MIN_INTERVAL_MS) {
    return "Пауза между отправками должна быть не меньше 1 минуты"
  }

  const cooldownMs = minutesToMs(state.cooldownMinutes)
  if (!Number.isFinite(cooldownMs) || cooldownMs < MIN_INTERVAL_MS) {
    return "Пауза для одного чата должна быть не меньше 1 минуты"
  }

  const from = toClock(state.activeFrom)
  const to = toClock(state.activeTo)
  if (Boolean(from) !== Boolean(to)) {
    return "Укажите рабочие часы с … по … или очистите оба поля"
  }

  return null
}

function selectedGroupNames(
  conversationIds: number[],
  knownNames: ReadonlyMap<number, string>
): Record<string, string> {
  const names: Record<string, string> = {}
  for (const conversationId of conversationIds) {
    const name = knownNames.get(conversationId)?.trim()
    if (name) names[String(conversationId)] = name
  }
  return names
}

export function formStateToPayload(
  state: CampaignFormState,
  knownNames: ReadonlyMap<number, string>
): CampaignPayload {
  const from = toClock(state.activeFrom)
  const to = toClock(state.activeTo)
  const payload: CampaignPayload = {
    conversationIds: [...state.conversationIds],
    groupNames: selectedGroupNames(state.conversationIds, knownNames),
    messages: cleanMessages(state.messages),
    intervalMs: minutesToMs(state.intervalMinutes),
    minIntervalPerChatMs: minutesToMs(state.cooldownMinutes),
    rotation: state.rotation,
    loop: state.loop,
    activeFrom: from || null,
    activeTo: to || null,
  }
  const name = state.name.trim()
  if (name) payload.name = name
  return payload
}

function sameIds(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false
  const left = [...a].sort((x, y) => x - y)
  const right = [...b].sort((x, y) => x - y)
  return left.every((value, index) => value === right[index])
}

/** Тело PATCH только из полей, которые пользователь действительно изменил. */
export function formStateToPatch(
  state: CampaignFormState,
  campaign: BroadcastCampaign,
  knownNames: ReadonlyMap<number, string>
): CampaignPatch {
  const next = formStateToPayload(state, knownNames)
  const patch: CampaignPatch = {}

  if (next.name !== undefined && next.name !== campaign.name) patch.name = next.name
  if (!sameIds(next.conversationIds, campaign.groups.map((group) => group.conversationId))) {
    patch.conversationIds = next.conversationIds
    patch.groupNames = next.groupNames
  }
  if (
    next.messages.length !== campaign.messages.length ||
    next.messages.some((text, index) => text !== campaign.messages[index])
  ) {
    patch.messages = next.messages
  }
  if (next.intervalMs !== campaign.intervalMs) patch.intervalMs = next.intervalMs
  if (next.minIntervalPerChatMs !== campaign.minIntervalPerChatMs) {
    patch.minIntervalPerChatMs = next.minIntervalPerChatMs
  }
  if (next.rotation !== campaign.rotation) patch.rotation = next.rotation
  if (next.loop !== campaign.loop) patch.loop = next.loop
  if (next.activeFrom !== campaign.activeFrom || next.activeTo !== campaign.activeTo) {
    patch.activeFrom = next.activeFrom
    patch.activeTo = next.activeTo
  }

  return patch
}
