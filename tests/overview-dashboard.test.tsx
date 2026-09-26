// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

// Mock recharts ResponsiveContainer to avoid 0-dimension warnings in jsdom
vi.mock("recharts", async () => {
  const actual = await vi.importActual<any>("recharts")
  return {
    ...actual,
    ResponsiveContainer: ({ children }: any) => (
      <div data-testid="responsive-container" style={{ width: 500, height: 200 }}>
        {children}
      </div>
    ),
  }
})

// Mock emulators context
const mockRefreshEmulators = vi.fn()
vi.mock("@/lib/emulators-context", () => ({
  useEmulators: () => ({
    emulators: [
      {
        id: "worker-1",
        name: "worker",
        containerName: "viber-worker-1",
        status: "online",
        state: "running",
        created: Date.now(),
        adbSerial: "emulator-5554",
        adbPort: 5555,
        viberRunning: true,
        bootCompleted: true,
      },
    ],
    loading: false,
    error: null,
    kvmAvailable: true,
    vpsHost: null,
    refresh: mockRefreshEmulators,
  }),
}))

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

import { OverviewDashboard } from "@/components/dashboard/overview-dashboard"

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

const STATS_PAYLOAD = {
  conversationsCount: 29,
  participantsCount: 1972,
  undecodedParticipantsCount: 50,
  messagesCount: 4520,
  isSnapshotCurrent: true,
}

const GROUPS_PAYLOAD = {
  count: 2,
  groups: [
    {
      conversationId: 26,
      groupId: 26,
      name: "АVTOTRAL🚨",
      conversationType: 1,
      memberCount: 840,
      messageCount: 1200,
    },
    {
      conversationId: 42,
      groupId: 42,
      name: "Грузоперевозки UA",
      conversationType: 1,
      memberCount: 430,
      messageCount: 890,
    },
  ],
}

const TASKS_PAYLOAD = [
  {
    id: "task_1",
    groupTarget: "26",
    groupName: "АVTOTRAL🚨",
    status: "running",
    currentStep: {
      step: "paging_participants",
      description: "Сбор участников",
      startedAt: new Date().toISOString(),
    },
    createdAt: new Date().toISOString(),
  },
  {
    id: "task_2",
    groupTarget: "42",
    groupName: "Грузоперевозки UA",
    status: "ready",
    createdAt: new Date().toISOString(),
  },
]

const MESSAGES_PAYLOAD = [
  {
    id: 101,
    conversationId: 26,
    conversationName: "АVTOTRAL🚨",
    date: new Date().toISOString(),
    body: "Нужен эвакуатор срочно, звоните +380501234567",
    senderName: "Иван Петров",
    attachedPhone: "+380501234567",
    phoneSource: "message_text",
    outgoing: false,
    hasPhoneInText: true,
    hasMedia: false,
  },
]

const MONITOR_PAYLOAD = {
  isRunning: true,
  pollIntervalMs: 2000,
  lastProcessedMessageId: 101,
  processedMessagesCount: 50,
  phonesFromTextCount: 12,
  phonesFromViberCount: 8,
}

describe("OverviewDashboard component", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Global fetch mock
    global.fetch = vi.fn((url: RequestInfo | URL, init?: RequestInit) => {
      const urlStr = url.toString()

      if (urlStr.includes("database/stats")) {
        return Promise.resolve(jsonResponse(STATS_PAYLOAD))
      }

      if (urlStr.includes("database/sync")) {
        return Promise.resolve(
          jsonResponse({ success: true, message: "Синхронизировано" })
        )
      }

      if (urlStr.includes("/api/viber/groups")) {
        return Promise.resolve(jsonResponse(GROUPS_PAYLOAD))
      }

      if (urlStr.includes("tasks")) {
        return Promise.resolve(jsonResponse(TASKS_PAYLOAD))
      }

      if (urlStr.includes("messages/monitored")) {
        return Promise.resolve(jsonResponse(MESSAGES_PAYLOAD))
      }

      if (urlStr.includes("messages/monitor/status")) {
        return Promise.resolve(jsonResponse(MONITOR_PAYLOAD))
      }

      return Promise.resolve(jsonResponse({}))
    }) as any
  })

  afterEach(() => {
    cleanup()
  })

  it("renders the dashboard title and system status bar", async () => {
    render(<OverviewDashboard />)

    expect(screen.getByText("Панель управления Viber Bot")).toBeDefined()

    await waitFor(() => {
      expect(screen.getByText("API онлайн")).toBeDefined()
    })
  })

  it("renders KPI metrics correctly from connected data", async () => {
    render(<OverviewDashboard />)

    await waitFor(() => {
      // Participants: 1972
      expect(screen.getByText(/1[\s,]972/)).toBeDefined()
      // Conversations: 29
      expect(screen.getByText("29")).toBeDefined()
      // Messages: 4520
      expect(screen.getByText(/4[\s,]520/)).toBeDefined()
      // Emulator running: 1 / 1
      expect(screen.getByText("1 / 1")).toBeDefined()
    })
  })

  it("renders active running task banner", async () => {
    render(<OverviewDashboard />)

    await waitFor(() => {
      expect(screen.getByText("Идёт сбор участников")).toBeDefined()
      expect(screen.getByText("Сбор участников")).toBeDefined()
    })
  })

  it("renders top Viber groups and recent messages", async () => {
    render(<OverviewDashboard />)

    await waitFor(() => {
      // Top group name
      expect(screen.getAllByText("АVTOTRAL🚨").length).toBeGreaterThan(0)
      // Message body
      expect(screen.getByText(/Нужен эвакуатор срочно/)).toBeDefined()
      // Extracted phone button
      expect(screen.getByText("+380501234567")).toBeDefined()
    })
  })

  it("allows clicking sync database button", async () => {
    render(<OverviewDashboard />)

    const syncBtn = screen.getByRole("button", { name: /Синхронизировать БД/i })
    expect(syncBtn).toBeDefined()

    fireEvent.click(syncBtn)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("database/sync"),
        expect.objectContaining({ method: "POST" })
      )
    })
  })
})

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

// Skeleton рендерится как пустой div с классами `animate-pulse rounded-md`;
// остальные пульсирующие элементы страницы содержат текст или иконку.
function skeletonCount(): number {
  return Array.from(document.querySelectorAll("div.animate-pulse.rounded-md")).filter(
    (el) => el.childElementCount === 0 && el.textContent === ""
  ).length
}

describe("OverviewDashboard progressive loading", () => {
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it("renders fast sections before slow stats/groups requests settle", async () => {
    vi.clearAllMocks()

    const statsGate = deferred<Response>()
    const groupsGate = deferred<Response>()

    global.fetch = vi.fn((url: RequestInfo | URL) => {
      const urlStr = url.toString()
      if (urlStr.includes("database/stats")) return statsGate.promise
      if (urlStr.includes("/api/viber/groups")) return groupsGate.promise
      if (urlStr.includes("tasks")) return Promise.resolve(jsonResponse(TASKS_PAYLOAD))
      if (urlStr.includes("messages/monitored")) {
        return Promise.resolve(jsonResponse(MESSAGES_PAYLOAD))
      }
      if (urlStr.includes("messages/monitor/status")) {
        return Promise.resolve(jsonResponse(MONITOR_PAYLOAD))
      }
      return Promise.resolve(jsonResponse({}))
    }) as any

    render(<OverviewDashboard />)

    // Быстрые секции (задачи и сообщения) появляются, не дожидаясь stats/groups
    await waitFor(() => {
      expect(screen.getByText("Идёт сбор участников")).toBeDefined()
      expect(screen.getByText(/Нужен эвакуатор срочно/)).toBeDefined()
    })

    // Секции статистики и групп всё ещё в состоянии скелетона
    expect(screen.queryByText(/1[\s,]972/)).toBeNull()
    expect(screen.queryByText(/4[\s,]520/)).toBeNull()
    expect(screen.queryByTestId("responsive-container")).toBeNull()
    expect(screen.queryByText(/Группы еще не загружены/)).toBeNull()
    expect(skeletonCount()).toBeGreaterThan(0)

    statsGate.resolve(jsonResponse(STATS_PAYLOAD))
    groupsGate.resolve(jsonResponse(GROUPS_PAYLOAD))

    await waitFor(() => {
      expect(screen.getByText(/1[\s,]972/)).toBeDefined()
      expect(screen.getByText(/4[\s,]520/)).toBeDefined()
      expect(screen.getByTestId("responsive-container")).toBeDefined()
      expect(screen.getByText("840")).toBeDefined()
    })

    expect(skeletonCount()).toBe(0)
  })

  it("keeps previously loaded groups when a background refresh fails", async () => {
    vi.clearAllMocks()
    // Подменяем только интервал опроса, чтобы прокрутить фоновое обновление;
    // setTimeout остаётся настоящим — на нём держится ожидание промисов.
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] })

    let groupsShouldFail = false
    let groupsCalls = 0

    global.fetch = vi.fn((url: RequestInfo | URL) => {
      const urlStr = url.toString()
      if (urlStr.includes("database/stats")) {
        return Promise.resolve(jsonResponse(STATS_PAYLOAD))
      }
      if (urlStr.includes("/api/viber/groups")) {
        groupsCalls += 1
        return groupsShouldFail
          ? Promise.resolve(jsonResponse({ message: "ADB недоступен" }, 500))
          : Promise.resolve(jsonResponse(GROUPS_PAYLOAD))
      }
      if (urlStr.includes("tasks")) return Promise.resolve(jsonResponse(TASKS_PAYLOAD))
      if (urlStr.includes("messages/monitored")) {
        return Promise.resolve(jsonResponse(MESSAGES_PAYLOAD))
      }
      if (urlStr.includes("messages/monitor/status")) {
        return Promise.resolve(jsonResponse(MONITOR_PAYLOAD))
      }
      return Promise.resolve(jsonResponse({}))
    }) as any

    const flush = async (times = 6) => {
      for (let i = 0; i < times; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 0))
        })
      }
    }

    render(<OverviewDashboard />)
    await flush()

    expect(groupsCalls).toBe(1)
    expect(screen.getByText("840")).toBeDefined()
    expect(screen.getByTestId("responsive-container")).toBeDefined()

    groupsShouldFail = true
    act(() => {
      vi.advanceTimersByTime(25_000)
    })
    await flush()

    expect(groupsCalls).toBe(2)
    // Данные предыдущей успешной загрузки остаются на экране
    expect(screen.getByText("840")).toBeDefined()
    expect(screen.getByTestId("responsive-container")).toBeDefined()
    expect(screen.queryByText(/Группы еще не загружены/)).toBeNull()
    expect(skeletonCount()).toBe(0)
    expect(screen.getByText("API онлайн")).toBeDefined()
  })
})
