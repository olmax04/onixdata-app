/**
 * TypeScript types matching the Swagger / OpenAPI specification of Viber-parser
 * (Kotlin / Ktor service located at C:\Coding\Projects\Viber-parser).
 */

// -------------------------------------------------------------
// Viber System & Device
// -------------------------------------------------------------
export interface ViberStartRequest {
  clearData?: boolean
  waitForLogin?: boolean
}

export interface ViberStartResponse {
  success: boolean
  message: string
  pid?: number | null
}

export interface ViberStatusResponse {
  isRunning: boolean
  pid?: number | null
}

// -------------------------------------------------------------
// Viber Bot / Emulator Authentication
// -------------------------------------------------------------
export interface ViberLoginRequest {
  phoneNumber?: string | null
  countryName?: string | null
  countryCode?: string | null
}

export interface ViberLoginResponse {
  success: boolean
  message: string
  data?: string | null
  step?: string | null
}

export interface ViberCodeRequest {
  code: string
}

// -------------------------------------------------------------
// Groups
// -------------------------------------------------------------
export interface GroupParticipantSample {
  id: number
  name?: string | null
  number?: string | null
  roleLabel: string
}

export interface GroupSummary {
  id: number
  type: number
  groupId?: string | null
  name?: string | null
  messageCount: number
  participantCount: number
  unreadCount: number
  lastMessageDate?: string | null
}

export interface GroupDetail extends GroupSummary {
  sampleParticipants?: GroupParticipantSample[] | null
}

// -------------------------------------------------------------
// Participants
// -------------------------------------------------------------
export interface CollectParticipantsRequest {
  group: string
  allowPartial?: boolean
  restartApp?: boolean
  idleTimeoutMs?: number
  numbersSyncTimeoutMs?: number
  syncLiveDbAfter?: boolean
  fetchOnlineStatus?: boolean
}

export interface QueryOnlineStatusRequest {
  memberIds?: string[]
  phoneNumbers?: string[]
}

export interface ParticipantModel {
  id: number
  memberId?: string | null
  number?: string | null
  name?: string | null
  contactName?: string | null
  viberName?: string | null
  groupRole?: number | null
  roleLabel: string
  active: boolean
  isSelf: boolean
  isOnline?: boolean | null
  lastSeen?: string | null
}

export interface OnlineStatusItem {
  memberId: string
  phoneNumber?: string | null
  isOnline: boolean
  lastSeen?: string | null
}

// -------------------------------------------------------------
// Tasks & Collection Pipeline
// -------------------------------------------------------------
export interface TaskStep {
  step: string
  description: string
  startedAt: string
  durationMs?: number | null
  progress?: Record<string, string> | null
}

export interface TaskSummary {
  id: string
  groupTarget: string
  groupName?: string | null
  conversationId?: number | null
  status: string
  currentStep?: TaskStep | null
  createdAt: string
  startedAt?: string | null
  completedAt?: string | null
}

export interface TaskCreatedResponse {
  taskId: string
  status: string
  group: string
  message: string
}

export interface StopTaskResponse {
  taskId: string
  status: string
  message: string
}

export interface TaskCollectionResult {
  group: string
  conversationId: number
  groupId: string
  headerTotal?: number | null
  pagesCount: number
  participantsCount: number
  participantsWithPhone: number
  savedJsonPath: string
  savedTxtPath: string
  savedCsvPath: string
}

export interface TaskDetail {
  id: string
  groupTarget: string
  groupName?: string | null
  conversationId?: number | null
  status: string
  currentStep?: TaskStep | null
  createdAt: string
  startedAt?: string | null
  completedAt?: string | null
  stepHistory?: TaskStep[]
  progress?: Record<string, string> | null
  error?: string | null
  result?: TaskCollectionResult | null
}

// -------------------------------------------------------------
// SQLite Database
// -------------------------------------------------------------
export interface DatabaseStats {
  conversationsCount: number
  participantsCount: number
  undecodedParticipantsCount: number
  messagesCount: number
}

export interface SyncResult {
  success: boolean
  message: string
  timestamp: string
  stats: DatabaseStats
}

export interface DecodeRequest {
  dryRun?: boolean
  limit?: number | null
  restartApp?: boolean
  waitForSyncSeconds?: number
}

export interface DecodedItem {
  id: number
  name?: string | null
  oldMemberId?: string | null
  newMemberId: string
}

export interface DecodeResult {
  success: boolean
  message: string
  dryRun: boolean
  totalRows: number
  undecodedFound: number
  decodedFound: number
  errorsCount: number
  sampleDecoded?: DecodedItem[] | null
  restartedApp?: boolean | null
}

// -------------------------------------------------------------
// Monitoring
// -------------------------------------------------------------
export interface MonitoredGroup {
  conversationId: number
  name?: string | null
  enabled: boolean
  lastMessageId: number
}

export interface StartMonitorRequest {
  conversationId?: number | null
  pollIntervalMs?: number
  fromLatest?: boolean | null
  startFromId?: number | null
}

export interface EnableMonitorGroupRequest {
  fromLatest?: boolean | null
}

export interface MonitorStatus {
  isRunning: boolean
  conversationId?: number | null
  groups: MonitoredGroup[]
  liveWatch: boolean
  pollIntervalMs: number
  lastPollAt?: string | null
  lastProcessedMessageId: number
  processedMessagesCount: number
  phonesFromTextCount: number
  phonesFromViberCount: number
}

export interface MonitoredMessage {
  id: number
  conversationId: number
  senderNumber?: string | null
  senderName?: string | null
  text: string
  timestamp: string
  extractedPhones?: string[]
}

// -------------------------------------------------------------
// Broadcast / Campaigns
// -------------------------------------------------------------
export interface CreateCampaignRequest {
  name?: string | null
  conversationIds: number[]
  messages: string[]
  intervalMs: number
  minIntervalPerChatMs?: number | null
  rotation?: string | null
  loop?: boolean | null
  activeFrom?: string | null
  activeTo?: string | null
}

export interface UpdateCampaignRequest {
  name?: string | null
  conversationIds?: number[] | null
  messages?: string[] | null
  intervalMs?: number | null
  minIntervalPerChatMs?: number | null
  rotation?: string | null
  loop?: boolean | null
  activeFrom?: string | null
  activeTo?: string | null
}

export interface ChatRotationState {
  conversationId: number
  sendCount: number
  lastMessageIndex?: number | null
}

export interface CampaignGroup {
  conversationId: number
  name?: string | null
}

export interface Campaign {
  id: string
  name: string
  groups: CampaignGroup[]
  messages: string[]
  intervalMs: number
  minIntervalPerChatMs: number
  rotation: string
  loop: boolean
  activeFrom?: string | null
  activeTo?: string | null
  status: string
  nextGroupIndex: number
  rotationState: ChatRotationState[]
  sentCount: number
  failedCount: number
  lastError?: string | null
  createdAt: string
  updatedAt: string
  startedAt?: string | null
  stoppedAt?: string | null
}

export interface BroadcastStatus {
  isRunning: boolean
  campaign?: Campaign | null
}

export interface SendHistoryEntry {
  id: string
  campaignId: string
  conversationId: number
  conversationName?: string | null
  messageIndex: number
  text: string
  status: "sent" | "failed" | string
  error?: string | null
  sentAt: string
}

export interface CampaignDeletedResponse {
  deleted: boolean
}

// -------------------------------------------------------------
// Supabase Users Sync
// -------------------------------------------------------------
export interface ViberUserRow {
  id?: number | null
  identityKey: string
  memberId?: string | null
  phone?: string | null
  name?: string | null
  viberName?: string | null
  isOnline?: boolean | null
  lastSeenAt?: string | null
  firstSeenAt?: string | null
  updatedAt?: string | null
}

export interface ViberGroupRow {
  id?: number | null
  groupKey: string
  viberGroupId?: string | null
  conversationId?: number | null
  name?: string | null
  participantCount: number
  lastSyncedAt?: string | null
  updatedAt?: string | null
}

export interface ViberGroupMemberRow {
  groupId: number
  userId: number
  role?: number | null
  active: boolean
  syncedAt: string
}

export interface UsersSyncResult {
  success: boolean
  message: string
  group?: string | null
  conversationId?: number | null
  groupId?: string | null
  received: number
  usersUpserted: number
  skipped: number
  deactivated: number
  syncedAt: string
}

export interface UsersPage {
  total?: number | null
  limit: number
  offset: number
  items: ViberUserRow[]
}
