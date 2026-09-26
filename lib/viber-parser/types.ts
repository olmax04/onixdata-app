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
  | "loading_from_db"
  | "attaching_frida"
  | "navigating_viber"
  | "paging_participants"
  | "syncing_live_db"
  | "restarting_viber"
  | "waiting_numbers_sync"
  | "deduplicating_and_finalizing"
  | "fetching_online_activity"
  | "exporting_results"

export interface TaskProgress {
  pagesCount?: number
  currentOffset?: number
  headerTotal?: number
  savedCount?: number
  participantsWithPhone?: number
  participantsCount?: number
  onlineChecked?: number
  onlineTotal?: number
  [key: string]: unknown
}

export interface TaskStepDto {
  step: string
  description?: string | null
  startedAt: string
  completedAt?: string | null
  durationMs?: number | null
  progress?: TaskProgress | null
}

export interface TaskCollectionResultDto {
  group: string
  conversationId: number
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
  currentStep?: string | TaskStepDto | null
  error?: string | null
  startedAt: string
  completedAt?: string | null
  participantsCollected?: number | null
}

export interface TaskDetailDto extends TaskSummaryDto {
  progress?: TaskProgress | null
  stepHistory: TaskStepDto[]
  result?: TaskCollectionResultDto | null
}

export interface ViberParserStatus {
  state: ViberParserState
  /**
   * Сервис сбора ответил и готов работать.
   * Обрыв связи или таймаут — это НЕ false, а ошибка запроса:
   * прокси в таком случае отвечает 502/504 и статус вообще не обновляется.
   */
  isDriverActive: boolean
  taskId?: string | null
  latestTaskStatus?: TaskStatus | null
  currentStep?: string | null
  progress?: TaskProgress | null
  groupName?: string | null
  /** Причина, по которой сервис ответил, но работать не может. */
  error?: string | null
}

export interface ViberActionResponse {
  message: string
}

export interface ViberErrorResponse {
  error?: string
  message?: string
}

export interface ViberGroup {
  conversationId: number
  /** Глобальный ключ группы Viber. У беседы без conversations.group_id его нет. */
  groupId: string | number | null
  name: string | null
  conversationType: number
  memberCount: number
  messageCount?: number
  lastMessageDate?: string | null
  unreadCount?: number
  /** Группа открыта на выбранном инстансе, а не только в базе/архиве. */
  onDevice?: boolean
  hasStoredData?: boolean
  storedParticipantCount?: number
  storedPhoneCount?: number
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
  conversationId: number | string
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

export interface ViberDecodeRequest {
  dryRun?: boolean
  includeSelf?: boolean
  limit?: number
  restartApp?: boolean
  waitForSyncSeconds?: number
}

export interface DecodedParticipantItem {
  infoId: number
  name: string | null
  newMemberId: string
  memberIdChanged: boolean
  participantType: number
  safeContact: number
  previousMemberId: string | null
  previousNumber: string | null
  previousParticipantType: number | null
}

export interface ViberDecodeResponse {
  dryRun: boolean
  read: number
  decodedCount: number
  updated: number
  changedRows: number | null
  skippedCount: number
  invalidCount: number
  backupPath: string | null
  decoded: DecodedParticipantItem[]
}

export interface MonitoredGroupDto {
  /** Инстанс эмулятора, на котором стоит группа. Старый API его не присылает. */
  deviceId?: string
  /** Резолвнутый ADB-серийник инстанса. */
  serial?: string
  conversationId: number
  /** Глобальный ключ группы Viber (conversations.group_id). */
  groupKey?: string | null
  name: string | null
  enabled: boolean
  lastMessageId: number
}

export interface MessageMonitorStatusDto {
  isRunning: boolean
  /** Инстанс, по которому отфильтрован ответ. */
  deviceId?: string | null
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
  /** Инстанс, с которого прочитано сообщение. */
  deviceId?: string
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
