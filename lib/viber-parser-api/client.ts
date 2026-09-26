import type {
  ViberStartRequest,
  ViberStartResponse,
  ViberStatusResponse,
  ViberLoginRequest,
  ViberLoginResponse,
  ViberCodeRequest,
  GroupSummary,
  GroupDetail,
  ParticipantModel,
  CollectParticipantsRequest,
  QueryOnlineStatusRequest,
  OnlineStatusItem,
  TaskSummary,
  TaskDetail,
  TaskCreatedResponse,
  StopTaskResponse,
  DatabaseStats,
  SyncResult,
  DecodeRequest,
  DecodeResult,
  StartMonitorRequest,
  MonitorStatus,
  MonitoredMessage,
  CreateCampaignRequest,
  UpdateCampaignRequest,
  Campaign,
  BroadcastStatus,
  SendHistoryEntry,
  CampaignDeletedResponse,
  UsersPage,
  UsersSyncResult,
} from "./types"

export class ViberApiError extends Error {
  readonly status: number
  readonly payload?: unknown

  constructor(message: string, status: number, payload?: unknown) {
    super(message)
    this.name = "ViberApiError"
    this.status = status
    this.payload = payload
  }
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE"
  body?: unknown
  params?: Record<string, string | number | boolean | undefined>
  signal?: AbortSignal
  headers?: Record<string, string>
}

export class ViberParserApiClient {
  private readonly baseUrl: string

  /**
   * @param baseUrl URL to route through. Defaults to `/api/viber` to go through Next.js proxy,
   * avoiding browser CORS issues and centralizing timeouts.
   */
  constructor(baseUrl: string = "/api/viber") {
    this.baseUrl = baseUrl.replace(/\/+$/, "")
  }

  private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const url = new URL(`${this.baseUrl}/${path.replace(/^\/+/, "")}`, typeof window !== "undefined" ? window.location.origin : "http://localhost:3000")

    if (options.params) {
      for (const [key, val] of Object.entries(options.params)) {
        if (val !== undefined && val !== null) {
          url.searchParams.set(key, String(val))
        }
      }
    }

    const headers: Record<string, string> = {
      ...(options.headers || {}),
    }

    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json"
    }

    const response = await fetch(url.toString(), {
      method: options.method ?? "GET",
      cache: "no-store",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    })

    if (response.status === 204) {
      return undefined as T
    }

    const text = await response.text()
    let payload: unknown = null
    if (text) {
      try {
        payload = JSON.parse(text)
      } catch {
        payload = { error: text }
      }
    }

    if (!response.ok) {
      const errObj = payload as { error?: string; message?: string } | null
      const msg = errObj?.error || errObj?.message || `Ошибка запроса (${response.status})`
      throw new ViberApiError(msg, response.status, payload)
    }

    return payload as T
  }

  // -------------------------------------------------------------
  // Viber System & Device
  // -------------------------------------------------------------
  readonly viber = {
    getStatus: (signal?: AbortSignal) =>
      this.request<ViberStatusResponse>("viber/status", { signal }),

    startApp: (body: ViberStartRequest = {}, signal?: AbortSignal) =>
      this.request<ViberStartResponse>("viber/start", { method: "POST", body, signal }),

    restartApp: (signal?: AbortSignal) =>
      this.viber.startApp({ clearData: false, waitForLogin: false }, signal),
  }

  // -------------------------------------------------------------
  // Viber Bot Authentication (Phone / Code)
  // -------------------------------------------------------------
  readonly auth = {
    loginPhone: (body: ViberLoginRequest, signal?: AbortSignal) =>
      this.request<ViberLoginResponse>("auth/phone", { method: "POST", body, signal }),

    enterCode: (body: ViberCodeRequest, signal?: AbortSignal) =>
      this.request<ViberLoginResponse>("auth/code", { method: "POST", body, signal }),
  }

  // -------------------------------------------------------------
  // Groups
  // -------------------------------------------------------------
  readonly groups = {
    list: (signal?: AbortSignal) =>
      this.request<GroupSummary[]>("groups", { signal }),

    getById: (id: string | number, signal?: AbortSignal) =>
      this.request<GroupDetail>(`groups/${id}`, { signal }),

    getParticipants: (id: string | number, signal?: AbortSignal) =>
      this.request<ParticipantModel[]>(`groups/${id}/participants`, { signal }),
  }

  // -------------------------------------------------------------
  // Participants & Collection
  // -------------------------------------------------------------
  readonly participants = {
    collect: (body: CollectParticipantsRequest, signal?: AbortSignal) =>
      this.request<TaskCreatedResponse>("participants/collect", { method: "POST", body, signal }),

    checkOnlineStatus: (body: QueryOnlineStatusRequest, signal?: AbortSignal) =>
      this.request<OnlineStatusItem[]>("participants/online-status", { method: "POST", body, signal }),
  }

  // -------------------------------------------------------------
  // Tasks
  // -------------------------------------------------------------
  readonly tasks = {
    list: (signal?: AbortSignal) =>
      this.request<TaskSummary[]>("tasks", { signal }),

    getById: (id: string, signal?: AbortSignal) =>
      this.request<TaskDetail>(`tasks/${id}`, { signal }),

    getParticipants: (id: string, signal?: AbortSignal) =>
      this.request<ParticipantModel[]>(`tasks/${id}/participants`, { signal }),

    stop: (id: string, signal?: AbortSignal) =>
      this.request<StopTaskResponse>(`tasks/${id}/stop`, { method: "POST", signal }),
  }

  // -------------------------------------------------------------
  // Database
  // -------------------------------------------------------------
  readonly database = {
    getStats: (signal?: AbortSignal) =>
      this.request<DatabaseStats>("database/stats", { signal }),

    sync: (signal?: AbortSignal) =>
      this.request<SyncResult>("database/sync", { method: "POST", signal }),

    decode: (body: DecodeRequest = {}, signal?: AbortSignal) =>
      this.request<DecodeResult>("database/decode", { method: "POST", body, signal }),
  }

  // -------------------------------------------------------------
  // Messages & Monitoring
  // -------------------------------------------------------------
  readonly messages = {
    startMonitor: (body: StartMonitorRequest = {}, signal?: AbortSignal) =>
      this.request<{ message: string }>("messages/monitor/start", { method: "POST", body, signal }),

    stopMonitor: (signal?: AbortSignal) =>
      this.request<{ message: string }>("messages/monitor/stop", { method: "POST", signal }),

    getMonitorStatus: (signal?: AbortSignal) =>
      this.request<MonitorStatus>("messages/monitor/status", { signal }),

    getMonitored: (params?: { limit?: number; offset?: number; search?: string }, signal?: AbortSignal) =>
      this.request<MonitoredMessage[]>("messages/monitored", { params, signal }),

    exportMonitored: (format: "json" | "csv" = "json", signal?: AbortSignal) =>
      this.request<Blob | string>(`messages/monitored/export?format=${format}`, { signal }),
  }

  // -------------------------------------------------------------
  // Broadcast / Campaigns
  // -------------------------------------------------------------
  readonly broadcast = {
    getStatus: (signal?: AbortSignal) =>
      this.request<BroadcastStatus>("broadcast/status", { signal }),

    getCampaigns: (signal?: AbortSignal) =>
      this.request<Campaign[]>("broadcast/campaigns", { signal }),

    getCampaignById: (id: string, signal?: AbortSignal) =>
      this.request<Campaign>(`broadcast/campaigns/${id}`, { signal }),

    createCampaign: (body: CreateCampaignRequest, signal?: AbortSignal) =>
      this.request<Campaign>("broadcast/campaigns", { method: "POST", body, signal }),

    updateCampaign: (id: string, body: UpdateCampaignRequest, signal?: AbortSignal) =>
      this.request<Campaign>(`broadcast/campaigns/${id}`, { method: "PATCH", body, signal }),

    deleteCampaign: (id: string, signal?: AbortSignal) =>
      this.request<CampaignDeletedResponse>(`broadcast/campaigns/${id}`, { method: "DELETE", signal }),

    startCampaign: (id: string, signal?: AbortSignal) =>
      this.request<Campaign>(`broadcast/campaigns/${id}/start`, { method: "POST", signal }),

    stopCampaign: (id: string, signal?: AbortSignal) =>
      this.request<Campaign>(`broadcast/campaigns/${id}/stop`, { method: "POST", signal }),

    getHistory: (params?: { limit?: number; campaignId?: string }, signal?: AbortSignal) =>
      this.request<SendHistoryEntry[]>("broadcast/history", { params, signal }),
  }

  // -------------------------------------------------------------
  // Supabase Users Sync
  // -------------------------------------------------------------
  readonly users = {
    list: (params?: { limit?: number; offset?: number; search?: string; phone?: string }, signal?: AbortSignal) =>
      this.request<UsersPage>("users", { params, signal }),

    syncGroup: (groupId: string | number, signal?: AbortSignal) =>
      this.request<UsersSyncResult>(`users/sync/group/${groupId}`, { method: "POST", signal }),

    syncTask: (taskId: string, signal?: AbortSignal) =>
      this.request<UsersSyncResult>(`users/sync/task/${taskId}`, { method: "POST", signal }),
  }
}

/** Singleton instance configured for Next.js frontend calls */
export const viberParserApi = new ViberParserApiClient()
