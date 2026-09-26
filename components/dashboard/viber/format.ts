import type { TaskStatus, TaskSummaryDto, ViberGroup, ViberMember } from "@/lib/viber-parser/types"

export const PENDING_PHONE_LABEL = "Ожидает дешифровки"

export function groupLabel(group: ViberGroup): string {
  return group.name || `Чат ${group.conversationId}`
}

function safeDate(value?: string | null): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatLastSeen(lastSeen?: string | null): string {
  const date = safeDate(lastSeen)
  if (!date) return "—"
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/** Дата запуска задачи: у initializing-задач startedAt ещё нет, берём createdAt. */
export function formatTaskDate(task: Pick<TaskSummaryDto, "createdAt" | "startedAt">): string {
  const date = safeDate(task.createdAt) ?? safeDate(task.startedAt)
  if (!date) return "—"
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

export function formatDurationMs(ms: number | null | undefined): string {
  if (typeof ms !== "number" || !Number.isFinite(ms) || ms < 0) return "—"
  const totalSeconds = Math.round(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes > 0) return `${minutes} мин ${seconds} сек`
  return `${seconds} сек`
}

const ACTIVE_STATUSES: TaskStatus[] = ["initializing", "starting", "running"]

/** Длительность задачи: завершённая — по completedAt, активная — «идёт». */
export function formatTaskDuration(task: TaskSummaryDto, now = Date.now()): string {
  const start = safeDate(task.startedAt) ?? safeDate(task.createdAt)
  if (!start) return "—"
  const end = safeDate(task.completedAt)
  if (!end) {
    if (ACTIVE_STATUSES.includes(task.status)) {
      return `идёт ${formatDurationMs(Math.max(0, now - start.getTime()))}`
    }
    return "—"
  }
  return formatDurationMs(end.getTime() - start.getTime())
}

export function isDecodedMember(member: ViberMember): boolean {
  if (typeof member.isDecoded === "boolean") return member.isDecoded
  const phone = member.phoneNumber ?? ""
  return !phone.toLowerCase().startsWith("em") && phone !== PENDING_PHONE_LABEL
}

export type MemberFilter = "all" | "decoded" | "undecoded" | "admins"

export interface MemberFilterOptions {
  query?: string
  filter?: MemberFilter
  hideDuplicates?: boolean
}

function normalizedPhone(member: ViberMember): string | null {
  const raw = member.phoneNumber || member.rawNumber || ""
  if (!raw || raw.toLowerCase().startsWith("em") || raw === PENDING_PHONE_LABEL) return null
  const digits = raw.replace(/[^\d+]/g, "")
  if (!digits) return null
  return digits.startsWith("+") ? digits : `+${digits}`
}

export function filterMembers(
  members: ViberMember[],
  options: MemberFilterOptions = {}
): ViberMember[] {
  const { query = "", filter = "all", hideDuplicates = true } = options
  const needle = query.trim().toLowerCase()

  const filtered = members.filter((member) => {
    const decoded = isDecodedMember(member)
    if (filter === "decoded" && !decoded) return false
    if (filter === "undecoded" && decoded) return false
    if (filter === "admins" && member.roleLabel !== "admin" && member.roleLabel !== "superadmin") {
      return false
    }
    if (!needle) return true

    const phone = (member.phoneNumber ?? "").toLowerCase()
    const name = (member.name ?? "").toLowerCase()
    const raw = (member.rawNumber ?? "").toLowerCase()
    return phone.includes(needle) || name.includes(needle) || raw.includes(needle)
  })

  if (!hideDuplicates) return filtered

  const seenPhones = new Set<string>()
  const seenMemberIds = new Set<string>()
  const result: ViberMember[] = []

  for (const member of filtered) {
    const phone = normalizedPhone(member)
    const memberId =
      member.memberId && member.memberId.trim() && !member.memberId.startsWith("em:")
        ? member.memberId.trim()
        : null

    if (phone && seenPhones.has(phone)) continue
    if (memberId && seenMemberIds.has(memberId)) continue

    if (phone) seenPhones.add(phone)
    if (memberId) seenMemberIds.add(memberId)
    result.push(member)
  }

  return result
}

export interface MemberExportRow {
  "№": number
  Имя: string
  "Номер телефона": string
  Роль: string
  "Дата последнего визита": string
}

export function buildMemberRows(members: ViberMember[]): MemberExportRow[] {
  return members.map((member, index) => ({
    "№": index + 1,
    Имя: member.name ?? "",
    "Номер телефона": member.phoneNumber ?? member.rawNumber ?? "",
    Роль: member.roleLabel ?? "",
    "Дата последнего визита": member.isOnline
      ? "В сети"
      : member.lastSeen
        ? formatLastSeen(member.lastSeen)
        : "",
  }))
}

export function buildMembersTxt(members: ViberMember[]): string {
  const header = `${"№".padEnd(5)} ${"Имя".padEnd(25)} ${"Номер телефона".padEnd(18)} ${"Роль".padEnd(14)} Дата последнего визита`
  const separator = "─".repeat(header.length)
  const lines = members.map((member, index) => {
    const num = `${index + 1}.`
    const name = member.name ?? "—"
    const phone = member.phoneNumber || member.rawNumber || "Без номера"
    const role = member.roleLabel ?? "—"
    const lastVisit = member.isOnline
      ? "В сети"
      : member.lastSeen
        ? formatLastSeen(member.lastSeen)
        : "—"
    return `${num.padEnd(5)} ${name.padEnd(25)} ${phone.padEnd(18)} ${role.padEnd(14)} ${lastVisit}`
  })
  return [header, separator, ...lines].join("\n")
}

function escapeCsvCell(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value)
  if (/[",\n\r;]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function buildMembersCsv(members: ViberMember[]): string {
  const rows = buildMemberRows(members)
  const headers = ["№", "Имя", "Номер телефона", "Роль", "Дата последнего визита"]
  const body = rows.map((row) =>
    headers.map((header) => escapeCsvCell(row[header as keyof MemberExportRow])).join(",")
  )
  return "﻿" + [headers.map(escapeCsvCell).join(","), ...body].join("\r\n")
}

export function collectUniquePhones(members: ViberMember[]): string[] {
  return Array.from(
    new Set(
      members
        .map((member) => member.phoneNumber)
        .filter(
          (phone): phone is string =>
            !!phone && !phone.toLowerCase().startsWith("em") && phone !== PENDING_PHONE_LABEL
        )
    )
  )
}

export function downloadTextFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
