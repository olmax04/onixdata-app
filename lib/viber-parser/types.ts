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
  groupName?: string | null
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
  dbParticipantCount?: number
  emulatorParticipantCount?: number
  lastSyncedAt?: string | null
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
  source?: "supabase" | "emulator"
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

// ==================== Swagger API Models ====================

export interface ViberStartRequest {
  clearData: boolean
  waitForLogin: boolean
}

export interface ViberStartResponse {
  isRunning: boolean
  pid: number | null
  message?: string
  success?: boolean
}

export interface ViberStatusResponse {
  isRunning: boolean
  pid: number | null
}

export interface LoginRequest {
  phoneNumber?: string | null
  countryCode?: string | null
  countryName?: string | null
}

export interface LoginResponse {
  success: boolean
  message: string
  step?: string | null
  data?: string | null
}

export interface CodeRequest {
  code: string
}

export interface ViberUserRow {
  id?: number | null
  identityKey?: string
  identity_key?: string
  memberId?: string | null
  member_id?: string | null
  phone?: string | null
  name?: string | null
  viberName?: string | null
  viber_name?: string | null
  isOnline?: boolean | null
  is_online?: boolean | null
  lastSeenAt?: string | null
  last_seen_at?: string | null
  firstSeenAt?: string | null
  first_seen_at?: string | null
  updatedAt?: string | null
  updated_at?: string | null
}

export interface UsersPage {
  total: number | null
  limit: number
  offset: number
  items: ViberUserRow[]
}

export interface GroupSyncStatus {
  id: string
  instanceId: string
  groupKey: string
  conversationId: number
  name: string
  participantCount?: number | null
  activeMembers?: number | null
  inactiveMembers?: number | null
  lastSyncedAt?: string | null
}

export interface GroupDeleteResult {
  success: boolean
  id: string
  instanceId: string
  groupKey: string
  conversationId?: number | null
  name?: string | null
  message: string
}

export interface UsersSyncStatus {
  configured: boolean
  reachable: boolean
  message: string
  usersTotal: number | null
  groupsTotal: number | null
  membersTotal: number | null
  lastSyncedAt: string | null
  checkedAt: string
  groups: GroupSyncStatus[]
}

export interface UsersSyncResult {
  groupKey?: string
  conversationId?: number
  group?: string | null
  groupName?: string
  usersUpserted: number
  usersInDatabase?: number | null
  syncedAt: string
  success: boolean
  message?: string
  error?: string | null
}

export interface UsersSyncAllResult {
  success: boolean
  message: string
  groupsTotal: number
  usersUpserted: number
  usersInDatabase?: number | null
  syncedAt: string
  failed: number
  groups: UsersSyncResult[]
}

export interface QueryOnlineStatusRequest {
  memberIds: string[]
  phoneNumbers: string[]
}

export interface OnlineStatusItem {
  memberId: string
  phoneNumber?: string | null
  isOnline: boolean
  lastSeen?: string | null
}

export interface CollectParticipantsRequest {
  group: string
  pageLimit?: number
  scrollPages?: number
  allowPartial?: boolean
  restartApp?: boolean
  forceRefresh?: boolean
  deviceId?: string
}

export interface TaskCreatedResponse {
  taskId: string
  message: string
}

export interface StopTaskResponse {
  id: string
  status: string
  message?: string
}

export interface CreateCampaignRequest {
  name: string
  groups: { conversationId: number; name?: string | null }[]
  messages: string[]
  intervalMs?: number
  minIntervalPerChatMs?: number
  rotation?: BroadcastRotation
  loop?: boolean
  activeFrom?: string | null
  activeTo?: string | null
}

export interface UpdateCampaignRequest {
  name?: string
  groups?: { conversationId: number; name?: string | null }[]
  messages?: string[]
  intervalMs?: number
  minIntervalPerChatMs?: number
  rotation?: BroadcastRotation
  loop?: boolean
  activeFrom?: string | null
  activeTo?: string | null
}

export interface CampaignDeletedResponse {
  id: string
  deleted: boolean
}

export interface GroupParticipantSample {
  id: number
  contactName?: string | null
  isSelf: boolean
  memberId?: string | null
  name?: string | null
  number?: string | null
  roleLabel: string
  viberName?: string | null
}

export interface GroupDetail {
  id: number
  groupId?: string | null
  name?: string | null
  type: number
  participantCount: number
  messageCount: number
  unreadCount: number
  lastMessageDate?: string | null
  sampleParticipants?: GroupParticipantSample[] | null
}


