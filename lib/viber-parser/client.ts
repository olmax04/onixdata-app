import type {
  BroadcastCampaign,
  BroadcastSendHistory,
  BroadcastStatusDto,
  CampaignDeletedResponse,
  CodeRequest,
  CollectParticipantsRequest,
  CreateCampaignRequest,
  DatabaseStatsDto,
  DatabaseSyncResultDto,
  GroupDetail,
  LoginRequest,
  LoginResponse,
  MessageMonitorStatusDto,
  MonitoredGroupDto,
  MonitoredMessageDto,
  OnlineStatusItem,
  QueryOnlineStatusRequest,
  StopTaskResponse,
  TaskCreatedResponse,
  TaskDetailDto,
  TaskSummaryDto,
  UpdateCampaignRequest,
  UsersPage,
  UsersSyncAllResult,
  UsersSyncResult,
  UsersSyncStatus,
  ViberDecodeRequest,
  ViberDecodeResponse,
  ViberGroupsResponse,
  ViberMembersResponse,
  ViberStartRequest,
  ViberStartResponse,
  ViberStatusResponse,
} from "./types"

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

export const viberApi = {
  // --- Viber System ---
  system: {
    getStatus: () => viberJson<ViberStatusResponse>("viber/status"),
    start: (body: ViberStartRequest) =>
      viberJson<ViberStartResponse>("viber/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
  },

  // --- Auth (Phone & SMS Code) ---
  auth: {
    submitPhone: (body: LoginRequest) =>
      viberJson<LoginResponse>("auth/phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    submitCode: (body: CodeRequest) =>
      viberJson<LoginResponse>("auth/code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
  },

  // --- Database ---
  database: {
    getStats: (deviceId?: string) => {
      const q = deviceId ? `?deviceId=${encodeURIComponent(deviceId)}` : ""
      return viberJson<DatabaseStatsDto>(`database/stats${q}`)
    },
    sync: (deviceId?: string) => {
      const q = deviceId ? `?deviceId=${encodeURIComponent(deviceId)}` : ""
      return viberJson<DatabaseSyncResultDto>(`database/sync${q}`, { method: "POST" })
    },
    decode: (options?: ViberDecodeRequest & { deviceId?: string }) =>
      viberJson<ViberDecodeResponse>("database/decode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(options ?? {}),
      }),
  },

  // --- Groups ---
  groups: {
    list: (params?: { deviceId?: string; onDevice?: boolean; all?: boolean; refresh?: boolean }) => {
      const sp = new URLSearchParams()
      if (params?.deviceId) sp.set("deviceId", params.deviceId)
      if (params?.onDevice) sp.set("onDevice", "true")
      if (params?.all) sp.set("all", "true")
      if (params?.refresh) sp.set("refresh", "1")
      const query = sp.toString() ? `?${sp.toString()}` : ""
      return viberJson<ViberGroupsResponse>(`groups${query}`)
    },
    get: (id: string | number) => viberJson<GroupDetail>(`groups/${id}`),
    getParticipants: (id: string | number, deviceId?: string) => {
      const q = deviceId ? `?deviceId=${encodeURIComponent(deviceId)}` : ""
      return viberJson<ViberMembersResponse>(`groups/${id}/participants${q}`)
    },
  },

  // --- Tasks & Participants Collection ---
  tasks: {
    list: (deviceId?: string) => {
      const q = deviceId ? `?deviceId=${encodeURIComponent(deviceId)}` : ""
      return viberJson<TaskSummaryDto[]>(`tasks${q}`)
    },
    get: (id: string) => viberJson<TaskDetailDto>(`tasks/${id}`),
    getParticipants: (id: string) => viberJson<unknown>(`tasks/${id}/participants`),
    stop: (id: string) => viberJson<StopTaskResponse>(`tasks/${id}/stop`, { method: "POST" }),
  },

  participants: {
    collect: (body: CollectParticipantsRequest) =>
      viberJson<TaskCreatedResponse>("participants/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    checkOnlineStatus: (body: QueryOnlineStatusRequest) =>
      viberJson<OnlineStatusItem[]>("participants/online-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
  },

  // --- Users & Supabase Sync ---
  users: {
    list: (params?: { limit?: number; offset?: number; phone?: string; name?: string }) => {
      const sp = new URLSearchParams()
      if (params?.limit !== undefined) sp.set("limit", String(params.limit))
      if (params?.offset !== undefined) sp.set("offset", String(params.offset))
      if (params?.phone) sp.set("phone", params.phone)
      if (params?.name) sp.set("name", params.name)
      const query = sp.toString() ? `?${sp.toString()}` : ""
      return viberJson<UsersPage>(`users${query}`)
    },
    getSyncStatus: (conversationId?: number) => {
      const q = conversationId !== undefined ? `?conversationId=${conversationId}` : ""
      return viberJson<UsersSyncStatus>(`users/sync/status${q}`)
    },
    syncAll: () => viberJson<UsersSyncAllResult>("users/sync/all", { method: "POST" }),
    syncGroup: (id: string | number) => viberJson<UsersSyncResult>(`users/sync/group/${id}`, { method: "POST" }),
    syncTask: (id: string) => viberJson<UsersSyncResult>(`users/sync/task/${id}`, { method: "POST" }),
  },

  // --- Message Monitoring ---
  messages: {
    getStatus: (deviceId?: string) => {
      const q = deviceId ? `?deviceId=${encodeURIComponent(deviceId)}` : ""
      return viberJson<MessageMonitorStatusDto>(`messages/monitor/status${q}`)
    },
    startMonitor: (body?: { conversationId?: number; deviceId?: string }) =>
      viberJson<MessageMonitorStatusDto>("messages/monitor/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      }),
    stopMonitor: () => viberJson<MessageMonitorStatusDto>("messages/monitor/stop", { method: "POST" }),
    getMonitoredGroups: () => viberJson<MonitoredGroupDto[]>("messages/monitor/groups"),
    enableGroup: (id: string | number, body?: { deviceId?: string }) =>
      viberJson<MonitoredGroupDto>(`messages/monitor/groups/${id}/enable`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      }),
    disableGroup: (id: string | number) =>
      viberJson<MonitoredGroupDto>(`messages/monitor/groups/${id}/disable`, { method: "POST" }),
    listMonitored: (params?: { limit?: number; offset?: number; search?: string }) => {
      const sp = new URLSearchParams()
      if (params?.limit !== undefined) sp.set("limit", String(params.limit))
      if (params?.offset !== undefined) sp.set("offset", String(params.offset))
      if (params?.search) sp.set("search", params.search)
      const query = sp.toString() ? `?${sp.toString()}` : ""
      return viberJson<MonitoredMessageDto[]>(`messages/monitored${query}`)
    },
  },

  // --- Broadcast Campaigns ---
  broadcast: {
    getCampaigns: () => viberJson<BroadcastCampaign[]>("broadcast/campaigns"),
    createCampaign: (body: CreateCampaignRequest) =>
      viberJson<BroadcastCampaign>("broadcast/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    getCampaign: (id: string) => viberJson<BroadcastCampaign>(`broadcast/campaigns/${id}`),
    updateCampaign: (id: string, body: UpdateCampaignRequest) =>
      viberJson<BroadcastCampaign>(`broadcast/campaigns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    deleteCampaign: (id: string) =>
      viberJson<CampaignDeletedResponse>(`broadcast/campaigns/${id}`, { method: "DELETE" }),
    startCampaign: (id: string) =>
      viberJson<BroadcastCampaign>(`broadcast/campaigns/${id}/start`, { method: "POST" }),
    stopCampaign: (id: string) =>
      viberJson<BroadcastCampaign>(`broadcast/campaigns/${id}/stop`, { method: "POST" }),
    getHistory: (limit?: number) => {
      const q = limit ? `?limit=${limit}` : ""
      return viberJson<BroadcastSendHistory[]>(`broadcast/history${q}`)
    },
    getLastHistory: (campaignId?: string) => {
      const q = campaignId ? `?campaignId=${campaignId}` : ""
      return viberJson<BroadcastSendHistory | null>(`broadcast/history/last${q}`)
    },
    getStatus: () => viberJson<BroadcastStatusDto>("broadcast/status"),
  },
}
