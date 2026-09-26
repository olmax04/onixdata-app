export type ViberParserState = "IDLE" | "INITIALIZING" | "RUNNING" | "ERROR"

export type TaskStatus =
  | "initializing"
  | "starting"
  | "running"
  | "stopped"
  | "error"
  | "ready"

export type TaskStepName =
  | "initializing"
  | "resolving_group"
  | "attaching_frida"
  | "navigating_viber"
  | "paging_participants"
  | "syncing_live_db"
  | "restarting_viber"
  | "waiting_numbers_sync"
  | "deduplicating_and_finalizing"
  | "fetching_online_activity"
  | "exporting_results"

/**
 * Ключи прогресса соответствуют тому, что реально пишет бэкенд
 * (participants-collector.flow.ts -> task.updateProgress).
 */
export interface TaskProgress {
  // resolving_group
  groupName?: string
  conversationId?: number
  groupId?: string
  // navigating_viber / paging_participants
  headerTotal?: number | null
  pagesCount?: number
  currentOffset?: number
  pageSize?: number
  lastPage?: boolean
  // waiting_numbers_sync
  syncedPhoneNumbers?: number
  stable?: boolean
  // fetching_online_activity
  total?: number
  completed?: number
  onlineChecked?: number
  onlineTotal?: number
  [key: string]: unknown
}

export interface TaskStepDto {
  step: TaskStepName | string
  description?: string
  startedAt: string
  durationMs?: number | null
  progress?: TaskProgress | null
}

export interface TaskCollectionResultDto {
  group: string
  conversationId: number
  groupId?: string
  headerTotal?: number | null
  pagesCount: number
  participantsCount: number
  participantsWithPhone: number
  savedJsonPath: string
  savedTxtPath: string
  savedCsvPath?: string
}

export interface TaskSummaryDto {
  id: string
  groupTarget: string
  groupName?: string | null
  conversationId?: number | null
  status: TaskStatus
  /** Бэкенд всегда отдаёт объект шага (или null), строкой он не бывает. */
  currentStep?: TaskStepDto | null
  createdAt: string
  startedAt?: string | null
  completedAt?: string | null
}

export interface TaskDetailDto extends TaskSummaryDto {
  stepHistory: TaskStepDto[]
  progress?: TaskProgress | null
  /** Текст ошибки приходит только в detail, в списке задач его нет. */
  error?: string | null
  result?: TaskCollectionResultDto | null
}

/** Полезная нагрузка SSE-события задачи: GET /api/tasks/:id/events. */
export interface TaskEvent {
  taskId: string
  status: TaskStatus
  step?: TaskStepDto
  progress?: TaskProgress
  error?: string
  timestamp: string
}

/** Консолидированный ответ GET /api/viber/status. */
export interface ViberParserStatus {
  state: ViberParserState
  isDriverActive: boolean
  taskId: string | null
  task: TaskDetailDto | null
  tasks: TaskSummaryDto[]
  currentStep: string | null
  progress: TaskProgress | null
  groupName: string | null
  fetchedAt: string
}

export type ParserConnectionState = "online" | "reconnecting" | "offline"

export interface ViberActionResponse {
  message: string
}

export interface ViberErrorResponse {
  error?: string
  message?: string
}

export interface ViberGroup {
  conversationId: number
  groupId: number
  name: string | null
  conversationType: number
  memberCount: number
  messageCount?: number
  lastMessageDate?: string | null
  unreadCount?: number
}

export interface ViberGroupsResponse {
  count: number
  groups: ViberGroup[]
}

export interface ParticipantDto {
  id: number
  memberId: string | null
  number: string | null
  name: string | null
  contactName: string | null
  viberName: string | null
  groupRole: number | null
  roleLabel: "superadmin" | "admin" | "member" | "unknown"
  active: boolean
  isSelf: boolean
  isOnline?: boolean
  lastSeen?: string | null
}

export interface ViberMember {
  participantId?: number
  memberId?: string | null
  encryptedMemberId?: string | null
  phoneNumber: string
  name: string | null
  isDecoded?: boolean
  rawNumber?: string | null
  roleLabel?: string
  isSelf?: boolean
  isOnline?: boolean
  lastSeen?: string | null
}

export interface ViberMembersResponse {
  conversationId: number
  count: number
  members: ViberMember[]
}

export interface DatabaseStatsDto {
  conversationsCount: number
  messagesCount: number
  participantsCount: number
  undecodedParticipantsCount: number
  isSnapshotCurrent: boolean
}

export interface DatabaseSyncResultDto {
  snapshotPath: string
  fileSize: number
  conversationsCount: number
  messagesCount: number
  participantsCount: number
  isCurrent: boolean
}

/** Поля строго по DecodeRequestDto бэкенда: любое лишнее поле даёт 400. */
export interface ViberDecodeRequest {
  dryRun?: boolean
  limit?: number
  restartApp?: boolean
  waitForSyncSeconds?: number
}

export interface DecodedParticipantItem {
  id: number
  name: string | null
  oldMemberId: string | null
  newMemberId: string
}

export interface ViberDecodeResponse {
  success: boolean
  message: string
  dryRun: boolean
  totalRows: number
  undecodedFound: number
  decodedCount: number
  errorsCount: number
  sampleDecoded?: DecodedParticipantItem[]
  restartedApp?: boolean
}

export interface MonitoredGroupDto {
  conversationId: number
  name: string | null
  enabled: boolean
  lastMessageId: number
}

export interface MessageMonitorStatusDto {
  isRunning: boolean
  conversationId?: number | null
  groups?: MonitoredGroupDto[]
  liveWatch?: boolean
  pollIntervalMs: number
  lastPollAt?: string | null
  lastProcessedMessageId: number
  processedMessagesCount: number
  phonesFromTextCount: number
  phonesFromViberCount: number
}

export interface MonitoredMessageDto {
  id: number
  conversationId: number
  conversationName?: string | null
  token: string | null
  date: string
  body: string | null
  senderId?: number | null
  senderName?: string | null
  senderMemberId?: string | null
  outgoing: boolean
  hasPhoneInText: boolean
  attachedPhone?: string | null
  phoneSource: "message_text" | "viber_profile" | "none"
  allFoundPhones?: string[]
  hasMedia?: boolean
  mediaUris?: string[]
  mergedMessageIds?: number[]
}

export type BroadcastRotation = "round-robin" | "random" | "shuffle-cycle"

export type BroadcastCampaignStatus = "idle" | "running" | "stopped" | "error"

export interface BroadcastCampaignGroup {
  conversationId: number
  name: string | null
}

export interface BroadcastRotationState {
  conversationId: number
  sendCount: number
  lastMessageIndex: number | null
}

export interface BroadcastCampaign {
  id: string
  name: string
  groups: BroadcastCampaignGroup[]
  messages: string[]
  intervalMs: number
  minIntervalPerChatMs: number
  rotation: BroadcastRotation
  loop: boolean
  activeFrom: string | null
  activeTo: string | null
  status: BroadcastCampaignStatus
  nextGroupIndex: number
  rotationState: BroadcastRotationState[]
  sentCount: number
  failedCount: number
  lastError: string | null
  createdAt: string
  updatedAt: string
  startedAt: string | null
  stoppedAt: string | null
}

export interface BroadcastSendHistory {
  id: string
  campaignId: string
  conversationId: number
  conversationName: string | null
  messageIndex: number
  text: string
  status: "sent" | "failed"
  error: string | null
  sentAt: string
}

export interface BroadcastStatusDto {
  isRunning: boolean
  campaign: BroadcastCampaign | null
}
