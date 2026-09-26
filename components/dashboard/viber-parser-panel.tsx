"use client"

import * as React from "react"
import { DatabaseIcon, HistoryIcon, RadioIcon, UsersIcon } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CollectCard } from "@/components/dashboard/viber/collect-card"
import { DatabaseTab } from "@/components/dashboard/viber/database-tab"
import {
  buildMemberRows,
  buildMembersCsv,
  buildMembersTxt,
  collectUniquePhones,
  downloadTextFile,
  filterMembers,
  groupLabel,
  type MemberFilter,
} from "@/components/dashboard/viber/format"
import { HistoryTab } from "@/components/dashboard/viber/history-tab"
import { MembersCard } from "@/components/dashboard/viber/members-card"
import { MonitorTab, type MonitorGroupRow } from "@/components/dashboard/viber/monitor-tab"
import { ParserHeader } from "@/components/dashboard/viber/parser-header"
import { PipelineCard } from "@/components/dashboard/viber/pipeline-card"
import { STEP_LABELS } from "@/components/dashboard/viber/pipeline"
import { terminalToastOf } from "@/components/dashboard/viber/task-status"
import { errorMessage, viberRequest } from "@/lib/viber-parser/client"
import type { TerminalTaskInfo } from "@/lib/viber-parser/parser-sync"
import { usePollLoop } from "@/lib/viber-parser/use-poll-loop"
import { useViberParserSync } from "@/lib/viber-parser/use-parser-sync"
import { useViberResource } from "@/lib/viber-parser/use-resource"
import type {
  DatabaseStatsDto,
  MessageMonitorStatusDto,
  MonitoredMessageDto,
  TaskDetailDto,
  ViberDecodeResponse,
  ViberGroupsResponse,
  ViberMembersResponse,
} from "@/lib/viber-parser/types"

const MONITOR_POLL_MS = 3000

type PanelTab = "collect" | "database" | "history" | "monitor"

interface MonitorSnapshot {
  status: MessageMonitorStatusDto
  messages: MonitoredMessageDto[]
}

export function ViberParserPanel() {
  const [activeTab, setActiveTab] = React.useState<PanelTab>("collect")
  const [selectedGroupId, setSelectedGroupId] = React.useState<string | null>(null)
  const [restartAppAfterCollect, setRestartAppAfterCollect] = React.useState(true)
  const [isStartingCollect, setIsStartingCollect] = React.useState(false)
  const [isStoppingTask, setIsStoppingTask] = React.useState(false)
  const [isSyncingDb, setIsSyncingDb] = React.useState(false)
  const [isDecodingDb, setIsDecodingDb] = React.useState(false)
  const [lastDecodeResult, setLastDecodeResult] = React.useState<ViberDecodeResponse | null>(null)
  const [memberSearchQuery, setMemberSearchQuery] = React.useState("")
  const [memberFilter, setMemberFilter] = React.useState<MemberFilter>("all")
  const [hideDuplicates, setHideDuplicates] = React.useState(true)
  const [monitorToggling, setMonitorToggling] = React.useState(false)
  const [togglingMonitorGroupId, setTogglingMonitorGroupId] = React.useState<number | null>(null)

  const groupsResource = useViberResource<ViberGroupsResponse>(
    (signal) => viberRequest<ViberGroupsResponse>("groups", { signal }),
    { key: "groups" }
  )

  const membersResource = useViberResource<ViberMembersResponse>(
    (signal) =>
      viberRequest<ViberMembersResponse>(`groups/${selectedGroupId}/members`, { signal }),
    { key: selectedGroupId, enabled: !!selectedGroupId }
  )

  const dbStatsResource = useViberResource<DatabaseStatsDto>(
    (signal) => viberRequest<DatabaseStatsDto>("database/stats", { signal }),
    { key: "database-stats" }
  )

  const monitorResource = useViberResource<MonitorSnapshot>(
    async (signal) => {
      const [status, list] = await Promise.all([
        viberRequest<MessageMonitorStatusDto>("messages/monitor/status", { signal }),
        viberRequest<MonitoredMessageDto[]>("messages/monitored?limit=15", { signal }),
      ])
      return {
        status: { ...status, groups: status.groups ?? [], liveWatch: status.liveWatch ?? false },
        messages: Array.isArray(list) ? list : [],
      }
    },
    { key: "monitor" }
  )

  const groups = React.useMemo(() => groupsResource.data?.groups ?? [], [groupsResource.data])
  const members = membersResource.data
  const monitorStatus = monitorResource.data?.status ?? null
  const monitoredMessages = React.useMemo(
    () => monitorResource.data?.messages ?? [],
    [monitorResource.data]
  )

  const reloadGroups = groupsResource.reload
  const reloadMembers = membersResource.reload
  const reloadDbStats = dbStatsResource.reload
  const reloadMonitor = monitorResource.reload

  const handleTerminal = React.useCallback(
    (info: TerminalTaskInfo) => {
      const { kind, title, description } = terminalToastOf(info)
      const options = description ? { description } : undefined
      if (kind === "success") toast.success(title, options)
      else if (kind === "info") toast.info(title, options)
      else toast.error(title, options)

      void reloadGroups()
      void reloadMembers()
      void reloadDbStats()
    },
    [reloadGroups, reloadMembers, reloadDbStats]
  )

  // Задачи живут в памяти бэкенда: после его перезапуска и задача, и история исчезают.
  const handleTaskLost = React.useCallback(() => {
    toast.warning("Бэкенд перезапущен: активная задача и история потеряны", {
      description: "Карточка ниже — последнее известное состояние, обновляться она уже не будет.",
    })
  }, [])

  const {
    status,
    task,
    tasks,
    connection,
    isTaskRunning,
    isTaskLost,
    consecutiveFailures,
    lastError,
    initialLoadDone,
    refresh,
    startCollect,
    stopTask,
    dismissTask,
  } = useViberParserSync({ onTerminal: handleTerminal, onTaskLost: handleTaskLost })

  // Первая доступная группа выбирается автоматически, ручной выбор сохраняется.
  React.useEffect(() => {
    if (groups.length === 0) return
    setSelectedGroupId((current) => {
      if (current && groups.some((group) => String(group.conversationId) === current)) {
        return current
      }
      return String(groups[0]!.conversationId)
    })
  }, [groups])

  // Вкладка «Монитор» опрашивается, только пока она открыта и страница видима.
  // Следующий запрос стартует после ответа предыдущего: медленный бэкенд не должен
  // отменять сам себя и оставлять спиннер висеть.
  usePollLoop({
    enabled: activeTab === "monitor",
    intervalMs: MONITOR_POLL_MS,
    onTick: reloadMonitor,
  })

  const selectedGroup = React.useMemo(
    () => groups.find((group) => String(group.conversationId) === selectedGroupId) ?? null,
    [groups, selectedGroupId]
  )

  const filteredMembers = React.useMemo(
    () =>
      filterMembers(members?.members ?? [], {
        query: memberSearchQuery,
        filter: memberFilter,
        hideDuplicates,
      }),
    [members, memberSearchQuery, memberFilter, hideDuplicates]
  )

  const monitorGroupRows = React.useMemo<MonitorGroupRow[]>(() => {
    const monitoredById = new Map(
      (monitorStatus?.groups ?? []).map((item) => [item.conversationId, item])
    )
    const rows: MonitorGroupRow[] = groups
      .filter((group) => group.conversationType !== 0)
      .map((group) => ({
        conversationId: group.conversationId,
        name: groupLabel(group),
        enabled: monitoredById.get(group.conversationId)?.enabled ?? false,
      }))

    const seen = new Set(rows.map((row) => row.conversationId))
    for (const item of monitorStatus?.groups ?? []) {
      if (seen.has(item.conversationId)) continue
      rows.push({
        conversationId: item.conversationId,
        name: item.name || `Группа ${item.conversationId}`,
        enabled: item.enabled,
      })
    }

    return rows.sort(
      (a, b) => Number(b.enabled) - Number(a.enabled) || a.name.localeCompare(b.name, "ru")
    )
  }, [groups, monitorStatus?.groups])

  const currentStepKey = task?.currentStep?.step ?? status?.currentStep ?? ""
  const currentStepLabel =
    STEP_LABELS[currentStepKey]?.title ||
    task?.currentStep?.description ||
    currentStepKey ||
    "Выполняется"

  const handleStartCollect = async () => {
    if (!selectedGroup) {
      toast.error("Выберите группу для сбора участников")
      return
    }

    setIsStartingCollect(true)
    try {
      const target = selectedGroup.name || String(selectedGroup.conversationId)
      const { taskId } = await startCollect({
        group: target,
        restartApp: restartAppAfterCollect,
        allowPartial: true,
      })
      toast.success("Сбор запущен", {
        description: taskId
          ? `Задача ${taskId} зарегистрирована. Наблюдайте прогресс на шагах ниже.`
          : "Наблюдайте прогресс на шагах ниже.",
      })
    } catch (error) {
      toast.error("Не удалось запустить сбор", { description: errorMessage(error) })
    } finally {
      setIsStartingCollect(false)
    }
  }

  const handleStopTask = async () => {
    setIsStoppingTask(true)
    try {
      await stopTask()
      toast.info("Сигнал остановки отправлен")
    } catch (error) {
      toast.error("Не удалось остановить задачу", { description: errorMessage(error) })
    } finally {
      setIsStoppingTask(false)
    }
  }

  const handleSyncDatabase = async () => {
    setIsSyncingDb(true)
    try {
      const result = await viberRequest<{ message: string }>("database/sync", { method: "POST" })
      toast.success("База синхронизирована с эмулятором", { description: result?.message })
      void reloadDbStats()
      void reloadGroups()
      void reloadMembers()
    } catch (error) {
      toast.error("Ошибка синхронизации базы", { description: errorMessage(error) })
    } finally {
      setIsSyncingDb(false)
    }
  }

  const handleDecodeDatabase = async () => {
    setIsDecodingDb(true)
    try {
      const result = await viberRequest<ViberDecodeResponse>("database/decode", {
        method: "POST",
        body: { restartApp: true, waitForSyncSeconds: 10 },
      })
      setLastDecodeResult(result)
      toast.success("Дешифровка завершена успешно!", {
        description: `Дешифровано ${result?.decodedCount ?? 0} записей. Найдено недешифрованных: ${
          result?.undecodedFound ?? 0
        }.`,
      })
      void reloadDbStats()
      void reloadGroups()
      void reloadMembers()
    } catch (error) {
      toast.error("Ошибка дешифровки", { description: errorMessage(error) })
    } finally {
      setIsDecodingDb(false)
    }
  }

  const handleToggleMonitor = async () => {
    setMonitorToggling(true)
    try {
      if (monitorStatus?.isRunning) {
        await viberRequest("messages/monitor/stop", { method: "POST" })
        toast.info("Опрос остановлен. Курсоры групп сохранены.")
      } else {
        await viberRequest("messages/monitor/start", { method: "POST", body: {} })
        toast.success("Мониторинг сообщений запущен")
      }
      void reloadMonitor()
    } catch (error) {
      toast.error("Ошибка управления монитором", { description: errorMessage(error) })
    } finally {
      setMonitorToggling(false)
    }
  }

  const handleToggleMonitorGroup = async (conversationId: number, enabled: boolean) => {
    setTogglingMonitorGroupId(conversationId)
    try {
      const path = enabled
        ? `messages/monitor/groups/${conversationId}/enable`
        : `messages/monitor/groups/${conversationId}/disable`
      await viberRequest(path, { method: "POST", body: {} })
      toast.success(enabled ? "Группа включена в мониторинг" : "Группа снята с мониторинга")
      void reloadMonitor()
    } catch (error) {
      toast.error("Не удалось изменить мониторинг группы", { description: errorMessage(error) })
    } finally {
      setTogglingMonitorGroupId(null)
    }
  }

  const handleOpenTaskDetail = React.useCallback(async (taskId: string) => {
    try {
      return await viberRequest<TaskDetailDto>(`tasks/${taskId}`)
    } catch (error) {
      toast.error("Не удалось загрузить детали задачи", { description: errorMessage(error) })
      return null
    }
  }, [])

  const exportBaseName = `participants-${selectedGroupId ?? "group"}`

  const handleExportJson = () => {
    if (!filteredMembers.length) return
    downloadTextFile(
      JSON.stringify(buildMemberRows(filteredMembers), null, 2),
      `${exportBaseName}.json`,
      "application/json"
    )
    toast.success(`Файл JSON сохранен (${filteredMembers.length} записей)`)
  }

  const handleExportTxt = () => {
    if (!filteredMembers.length) return
    downloadTextFile(
      buildMembersTxt(filteredMembers),
      `${exportBaseName}.txt`,
      "text/plain;charset=utf-8"
    )
    toast.success(`Файл TXT сохранен (${filteredMembers.length} записей)`)
  }

  const handleExportCsv = () => {
    if (!filteredMembers.length) return
    downloadTextFile(
      buildMembersCsv(filteredMembers),
      `${exportBaseName}.csv`,
      "text/csv;charset=utf-8"
    )
    toast.success(`Файл CSV сохранен (${filteredMembers.length} записей)`)
  }

  const handleCopyPhones = () => {
    if (!filteredMembers.length) return
    const phones = collectUniquePhones(filteredMembers)
    if (!phones.length) {
      toast.warning("Нет открытых номеров для копирования")
      return
    }
    void navigator.clipboard.writeText(phones.join("\n"))
    toast.success(`Скопировано ${phones.length} уникальных номеров в буфер обмена`)
  }

  // Промис отдаём наружу: кнопка «Обновить» крутится, пока идут все запросы.
  const handleRefreshAll = async () => {
    await Promise.all([refresh(), reloadGroups(), reloadDbStats(), reloadMembers()])
  }

  return (
    <div className="space-y-6">
      <ParserHeader
        connection={connection}
        initialLoadDone={initialLoadDone}
        consecutiveFailures={consecutiveFailures}
        lastError={lastError}
        isTaskRunning={isTaskRunning}
        currentStepLabel={currentStepLabel}
        isStopping={isStoppingTask}
        isRefreshing={!initialLoadDone}
        onStop={() => void handleStopTask()}
        onRefresh={handleRefreshAll}
      />

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as PanelTab)}
        className="space-y-4"
      >
        <TabsList className="grid h-auto w-full grid-cols-2 bg-muted/60 p-1 md:grid-cols-4">
          <TabsTrigger value="collect" className="gap-2 py-2 text-xs font-medium sm:text-sm">
            <UsersIcon className="size-4" />
            <span>Сбор участников</span>
            {isTaskRunning ? (
              <span className="size-2 animate-ping rounded-full bg-indigo-500" />
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="database" className="gap-2 py-2 text-xs font-medium sm:text-sm">
            <DatabaseIcon className="size-4" />
            <span>База данных</span>
            {dbStatsResource.data && dbStatsResource.data.undecodedParticipantsCount > 0 ? (
              <Badge
                variant="secondary"
                className="bg-amber-500/15 px-1.5 py-0 text-[10px] text-amber-700 dark:text-amber-300"
              >
                {dbStatsResource.data.undecodedParticipantsCount}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2 py-2 text-xs font-medium sm:text-sm">
            <HistoryIcon className="size-4" />
            <span>История задач</span>
            {tasks.length > 0 ? (
              <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                {tasks.length}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="monitor" className="gap-2 py-2 text-xs font-medium sm:text-sm">
            <RadioIcon className="size-4" />
            <span>Монитор сообщений</span>
            {monitorStatus?.isRunning ? (
              <span className="size-2 animate-pulse rounded-full bg-emerald-500" />
            ) : null}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="collect" className="space-y-4">
          <CollectCard
            groups={groups}
            groupsLoading={groupsResource.loading && !groupsResource.data}
            groupsError={groupsResource.error}
            onRetryGroups={reloadGroups}
            selectedGroupId={selectedGroupId}
            onSelectGroup={setSelectedGroupId}
            selectedGroup={selectedGroup}
            restartApp={restartAppAfterCollect}
            onRestartAppChange={setRestartAppAfterCollect}
            isTaskRunning={isTaskRunning}
            isStarting={isStartingCollect}
            isStopping={isStoppingTask}
            onStart={() => void handleStartCollect()}
            onStop={() => void handleStopTask()}
          />

          {task ? (
            <PipelineCard
              task={task}
              isTaskRunning={isTaskRunning}
              isTaskLost={isTaskLost}
              connection={connection}
              onDismiss={dismissTask}
              onExportTxt={handleExportTxt}
              onExportCsv={handleExportCsv}
              onExportJson={handleExportJson}
              onCopyPhones={handleCopyPhones}
            />
          ) : null}

          <MembersCard
            selectedGroup={selectedGroup}
            members={members}
            filteredMembers={filteredMembers}
            loading={membersResource.loading}
            error={membersResource.error}
            onRetry={reloadMembers}
            searchQuery={memberSearchQuery}
            onSearchQueryChange={setMemberSearchQuery}
            filter={memberFilter}
            onFilterChange={setMemberFilter}
            hideDuplicates={hideDuplicates}
            onHideDuplicatesChange={setHideDuplicates}
            onExportTxt={handleExportTxt}
            onExportCsv={handleExportCsv}
            onExportJson={handleExportJson}
            onCopyPhones={handleCopyPhones}
          />
        </TabsContent>

        <TabsContent value="database" className="space-y-4">
          <DatabaseTab
            stats={dbStatsResource.data}
            statsLoading={dbStatsResource.loading}
            statsError={dbStatsResource.error}
            onRetryStats={reloadDbStats}
            groupsCount={groups.length}
            isSyncing={isSyncingDb}
            isDecoding={isDecodingDb}
            isTaskRunning={isTaskRunning}
            lastDecodeResult={lastDecodeResult}
            onSync={() => void handleSyncDatabase()}
            onDecode={() => void handleDecodeDatabase()}
          />
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <HistoryTab
            tasks={tasks}
            loading={!initialLoadDone}
            onRefresh={refresh}
            onOpenDetail={handleOpenTaskDetail}
          />
        </TabsContent>

        <TabsContent value="monitor" className="space-y-4">
          <MonitorTab
            status={monitorStatus}
            messages={monitoredMessages}
            groupRows={monitorGroupRows}
            loading={monitorResource.loading && !monitorResource.data}
            error={monitorResource.error}
            onRetry={reloadMonitor}
            toggling={monitorToggling}
            togglingGroupId={togglingMonitorGroupId}
            onToggleMonitor={() => void handleToggleMonitor()}
            onToggleGroup={(conversationId, enabled) =>
              void handleToggleMonitorGroup(conversationId, enabled)
            }
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
