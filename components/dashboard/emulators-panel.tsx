"use client"

import * as React from "react"
import {
  CheckCircle2Icon,
  CpuIcon,
  ExternalLinkIcon,
  FolderIcon,
  HardDriveIcon,
  LayoutListIcon,
  Loader2Icon,
  MoreHorizontalIcon,
  PlayIcon,
  PowerOffIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  SmartphoneIcon,
  SquareIcon,
  TerminalIcon,
  Trash2Icon,
  XCircleIcon,
  KeyRoundIcon,
  AlertCircleIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatPhoneNumber, formatViberAccount, getEmulatorStatus, type EmulatorItem } from "@/lib/emulator-status"
import { NewEmulatorDialog } from "./new-emulator-dialog"
import { EmulatorScreenDialog, ScrcpyStreamLink } from "./emulator-screen-dialog"
import { EmulatorLogsDialog } from "./emulator-logs-dialog"
import { EmulatorAuthDialog } from "./emulator-auth-dialog"
import { InstanceFolderCard } from "./instance-folder-card"
import { EmulatorStatusBadge } from "./emulator-status-badge"

export type { EmulatorItem } from "@/lib/emulator-status"

export function EmulatorsPanel() {
  const [emulators, setEmulators] = React.useState<EmulatorItem[]>([])
  const [kvm, setKvm] = React.useState<boolean | null>(null)
  const [vpsHost, setVpsHost] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [lastSuccessAt, setLastSuccessAt] = React.useState<number | null>(null)
  const [actionLoading, setActionLoading] = React.useState<string | null>(null)
  const [viewMode, setViewMode] = React.useState<"folders" | "table">("folders")
  const [expandedFolders, setExpandedFolders] = React.useState<Set<string>>(new Set())

  // Modals state
  const [screenTarget, setScreenTarget] = React.useState<{
    name: string
    url: string | null
    adbPort?: number | null
  } | null>(null)
  const [logsTarget, setLogsTarget] = React.useState<{
    id: string
    name: string
  } | null>(null)
  const [authTarget, setAuthTarget] = React.useState<EmulatorItem | null>(null)

  const isStale = Boolean(error && lastSuccessAt !== null)

  const toggleFolder = (id: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const emulatorsRef = React.useRef(emulators)
  emulatorsRef.current = emulators

  const actionLoadingRef = React.useRef(actionLoading)
  actionLoadingRef.current = actionLoading

  const fetchEmulators = React.useCallback(async (showLoading = false) => {
    if (showLoading) {
      setLoading(true)
    }
    try {
      const res = await fetch("/api/emulators", { cache: "no-store" })
      if (!res.ok) {
        throw new Error(`Ошибка сервиса (${res.status})`)
      }
      const data = await res.json()
      const list = (data.emulators || []) as EmulatorItem[]
      setEmulators(list)
      setKvm(data.kvmAvailable ?? false)
      setVpsHost(data.vpsHost || null)
      setLastSuccessAt(Date.now())
      setError(null)
      setExpandedFolders((current) => {
        if (current.size > 0) return current
        const running = list.find((e) => e.state === "running") || list[0]
        return running ? new Set([running.id]) : current
      })
    } catch (err: any) {
      setError(err.message || String(err))
      if (showLoading) {
        toast.error("Не удалось загрузить список инстансов", {
          description: err.message || String(err),
        })
      }
    } finally {
      if (showLoading) {
        setLoading(false)
      }
    }
  }, [])

  // Initial load with loading state
  React.useEffect(() => {
    void fetchEmulators(true)
  }, [fetchEmulators])

  // Periodic background polling (15s idle, 5s during action or booting)
  React.useEffect(() => {
    let timer: NodeJS.Timeout

    const poll = async () => {
      await fetchEmulators(false)
      const list = emulatorsRef.current
      const isAnyBooting = list.some((e) => e.state === "running" && !e.bootCompleted)
      const nextDelay = actionLoadingRef.current || isAnyBooting ? 5_000 : 15_000
      timer = setTimeout(() => void poll(), nextDelay)
    }

    timer = setTimeout(() => void poll(), 15_000)
    return () => clearTimeout(timer)
  }, [fetchEmulators])

  const handleAction = async (id: string, action: "start" | "stop" | "restart") => {
    setActionLoading(`${action}-${id}`)
    try {
      const res = await fetch(`/api/emulators/${encodeURIComponent(id)}/${action}`, {
        method: "POST",
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || data?.message || "Ошибка операции")
      }
      toast.success(`Команда "${action}" успешно отправлена`)
      await fetchEmulators()
    } catch (err: any) {
      toast.error(`Не удалось выполнить ${action}`, {
        description: err.message || String(err),
      })
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Вы действительно хотите удалить инстанс "${name}"?`)) {
      return
    }
    setActionLoading(`delete-${id}`)
    try {
      const res = await fetch(`/api/emulators/${encodeURIComponent(id)}?deleteData=true`, {
        method: "DELETE",
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || data?.message || "Ошибка удаления")
      }
      toast.success(`Инстанс "${name}" удален`)
      await fetchEmulators()
    } catch (err: any) {
      toast.error("Не удалось удалить инстанс", {
        description: err.message || String(err),
      })
    } finally {
      setActionLoading(null)
    }
  }

  const handleRecreate = async (id: string, name: string) => {
    if (!confirm(`Пересоздать инстанс "${name}" с оптимизированными настройками?\n\nДанные Viber (база, аккаунт) будут сохранены.`)) {
      return
    }
    setActionLoading(`recreate-${id}`)
    try {
      const res = await fetch(`/api/emulators/${encodeURIComponent(id)}/recreate`, {
        method: "POST",
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || data?.message || "Ошибка пересоздания")
      }
      toast.success(`Инстанс "${name}" успешно обновлен`)
      await fetchEmulators()
    } catch (err: any) {
      toast.error("Не удалось пересоздать инстанс", {
        description: err.message || String(err),
      })
    } finally {
      setActionLoading(null)
    }
  }

  const handleLogout = async (emulator: EmulatorItem) => {
    const account = formatViberAccount(emulator.viberAccount) || "текущий аккаунт"
    if (!confirm(`Выйти из аккаунта Viber «${account}» на инстансе «${emulator.name}»?`)) {
      return
    }

    setActionLoading(`logout-${emulator.id}`)
    try {
      const res = await fetch(`/api/emulators/${encodeURIComponent(emulator.id)}/viber/logout`, {
        method: "POST",
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || data?.message || "Ошибка выхода из Viber")
      }
      toast.success(data?.message || "Выход из Viber выполнен")
      await fetchEmulators()
    } catch (err: any) {
      toast.error("Не удалось выйти из Viber", {
        description: err.message || String(err),
      })
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Stale data warning banner */}
      {isStale && lastSuccessAt && (
        <div
          role="alert"
          className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300 flex items-center justify-between gap-3 shadow-sm"
        >
          <div className="flex items-center gap-2">
            <AlertCircleIcon className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>
              Статусы не обновлены. Время последнего успешного запроса:{" "}
              <strong className="font-mono">
                {new Date(lastSuccessAt).toLocaleTimeString("ru-RU")}
              </strong>
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void fetchEmulators(true)}
            disabled={loading}
            className="h-7 text-xs border-amber-500/40 hover:bg-amber-500/20"
          >
            Повторить
          </Button>
        </div>
      )}

      {/* Top status bar */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Производительность</CardTitle>
            <CpuIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {kvm ? (
                <>
                  <CheckCircle2Icon className="h-5 w-5 text-emerald-500" />
                  <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                    Оптимальная
                  </span>
                </>
              ) : (
                <>
                  <XCircleIcon className="h-5 w-5 text-amber-500" />
                  <span className="text-lg font-bold text-amber-600 dark:text-amber-400">
                    {kvm === null ? "Проверка..." : "Стандартная"}
                  </span>
                </>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Аппаратная оптимизация вычислений активна
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Статус сервиса</CardTitle>
            <HardDriveIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">
              Подключено
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Защищенное соединение с сервисом инстансов
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Активные инстансы</CardTitle>
            <SmartphoneIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">
              {emulators.filter((e) => e.state === "running").length} / {emulators.length} запущены
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Всего настроенных инстансов Viber
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Control bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold">Список инстансов</h3>
          <p className="text-xs text-muted-foreground">
            Управление параметрами, подключением ADB и обслуживанием изолированных инстансов.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* View mode toggle */}
          <div className="flex items-center gap-1 border rounded-lg p-0.5 bg-muted/40">
            <Button
              variant={viewMode === "folders" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("folders")}
              className="h-8 gap-1.5 text-xs"
            >
              <FolderIcon className="h-3.5 w-3.5 text-amber-500" />
              Папки
            </Button>
            <Button
              variant={viewMode === "table" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("table")}
              className="h-8 gap-1.5 text-xs"
            >
              <LayoutListIcon className="h-3.5 w-3.5" />
              Таблица
            </Button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => void fetchEmulators(true)}
            disabled={loading}
            className="gap-1.5 h-8"
          >
            <RefreshCwIcon className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Обновить
          </Button>

          <NewEmulatorDialog onCreated={() => void fetchEmulators(true)} />
        </div>
      </div>

      {viewMode === "folders" ? (
        /* Folders view */
        <div className="space-y-4">
          {emulators.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2Icon className="h-4 w-4 animate-spin" />
                  Загрузка инстансов...
                </div>
              ) : (
                <div className="space-y-3">
                  <p>Нет созданных инстансов.</p>
                  <NewEmulatorDialog onCreated={fetchEmulators} />
                </div>
              )}
            </Card>
          ) : (
            emulators.map((emu) => (
              <InstanceFolderCard
                key={emu.id}
                emulator={emu}
                isExpanded={expandedFolders.has(emu.id)}
                isStale={isStale}
                onToggleExpand={() => toggleFolder(emu.id)}
                onAction={handleAction}
                onDelete={handleDelete}
                onRecreate={handleRecreate}
                onOpenScreen={(name, url, adbPort) => setScreenTarget({ name, url, adbPort })}
                onOpenLogs={(id, name) => setLogsTarget({ id, name })}
                onOpenAuth={(item) => setAuthTarget(item)}
                onLogout={handleLogout}
                actionLoading={actionLoading}
              />
            ))
          )}
        </div>
      ) : (
        /* Compact Table view */
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Инстанс</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Аккаунт Viber</TableHead>
                <TableHead>Подключение</TableHead>
                <TableHead>Системное имя</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {emulators.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    {loading ? (
                      <div className="flex items-center justify-center gap-2">
                        <Loader2Icon className="h-4 w-4 animate-spin" />
                        Загрузка инстансов...
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p>Нет созданных инстансов.</p>
                        <NewEmulatorDialog onCreated={fetchEmulators} />
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                emulators.map((emu) => {
                  const isRunning = emu.state === "running"
                  const isWorking = Boolean(actionLoading)
                  const status = getEmulatorStatus(emu)
                  const subtitle = status.stageLabel || status.description

                  return (
                    <TableRow key={emu.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <SmartphoneIcon className="h-4 w-4 text-primary" />
                          <div>
                            <div>{emu.name}</div>
                            <div className="text-xs text-muted-foreground font-normal">
                              {emu.id.slice(0, 12)}
                            </div>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5">
                            <EmulatorStatusBadge status={status} isStale={isStale} />
                          </div>
                          {subtitle && (
                            <span
                              className="text-xs text-muted-foreground truncate max-w-[200px]"
                              title={subtitle}
                            >
                              {subtitle}
                            </span>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        {emu.viberAccount ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-sm truncate max-w-[200px]">
                              {emu.viberAccount.displayName || "Без имени"}
                            </span>
                            <span className="text-xs text-muted-foreground font-mono">
                              {formatPhoneNumber(emu.viberAccount.phoneNumber) || "номер неизвестен"}
                            </span>
                            {emu.viberAccount.status === "pending" && (
                              <span className="text-xs text-amber-600 dark:text-amber-400">
                                Ожидает код подтверждения
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-sm text-muted-foreground">—</span>
                            <span className="text-xs text-muted-foreground">Вход не выполнен</span>
                          </div>
                        )}
                      </TableCell>

                      <TableCell>
                        {emu.name ? (
                          <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono">
                            {emu.name}
                          </code>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>

                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {emu.name}
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Viber Auth button */}
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={!isRunning || isWorking}
                            onClick={() => setAuthTarget(emu)}
                            className="gap-1.5 text-purple-600 border-purple-500/30"
                          >
                            <KeyRoundIcon className="h-3.5 w-3.5" />
                            Вход
                          </Button>

                          {/* Screen button */}
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={!isRunning || isWorking}
                            onClick={() =>
                              setScreenTarget({
                                name: emu.name,
                                url: emu.scrcpyUrl ?? null,
                                adbPort: emu.adbPort,
                              })
                            }
                            className="gap-1.5"
                          >
                            <SmartphoneIcon className="h-3.5 w-3.5" />
                            Экран
                          </Button>

                          {/* Start/Stop button */}
                          {isRunning ? (
                            <Button
                              variant="outline"
                              size="icon"
                              title="Остановить"
                              disabled={isWorking}
                              onClick={() => handleAction(emu.id, "stop")}
                            >
                              <SquareIcon className="h-3.5 w-3.5" />
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="icon"
                              title="Запустить"
                              disabled={isWorking}
                              onClick={() => handleAction(emu.id, "start")}
                            >
                              <PlayIcon className="h-3.5 w-3.5" />
                            </Button>
                          )}

                          {/* More dropdown */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" disabled={isWorking}>
                                <MoreHorizontalIcon className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Управление</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setAuthTarget(emu)}
                                disabled={!isRunning}
                              >
                                <KeyRoundIcon className="h-4 w-4 mr-2 text-purple-600 dark:text-purple-400" />
                                Вход в Viber
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleAction(emu.id, "restart")}
                                disabled={!isRunning}
                              >
                                <RefreshCwIcon className="h-4 w-4 mr-2" />
                                Перезапустить
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setLogsTarget({ id: emu.id, name: emu.name })}
                              >
                                <TerminalIcon className="h-4 w-4 mr-2" />
                                Просмотр логов
                              </DropdownMenuItem>
                              {emu.scrcpyUrl && (
                                <DropdownMenuItem asChild>
                                  <ScrcpyStreamLink
                                    scrcpyUrl={emu.scrcpyUrl}
                                    adbPort={emu.adbPort}
                                    className="flex items-center"
                                  >
                                    <ExternalLinkIcon className="h-4 w-4 mr-2" />
                                    Экран в новой вкладке
                                  </ScrcpyStreamLink>
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleRecreate(emu.id, emu.name)}>
                                <RotateCcwIcon className="h-4 w-4 mr-2 text-blue-600 dark:text-blue-400" />
                                Пересоздать инстанс
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => handleDelete(emu.id, emu.name)}
                              >
                                <Trash2Icon className="h-4 w-4 mr-2" />
                                Удалить инстанс
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Screen viewer modal */}
      {screenTarget && (
        <EmulatorScreenDialog
          open={!!screenTarget}
          onOpenChange={(open) => !open && setScreenTarget(null)}
          emulatorName={screenTarget.name}
          scrcpyUrl={screenTarget.url}
          adbPort={screenTarget.adbPort}
        />
      )}

      {/* Logs modal */}
      {logsTarget && (
        <EmulatorLogsDialog
          open={!!logsTarget}
          onOpenChange={(open) => !open && setLogsTarget(null)}
          emulatorId={logsTarget.id}
          emulatorName={logsTarget.name}
        />
      )}

      {/* Viber auth modal */}
      {authTarget && (
        <EmulatorAuthDialog
          open={!!authTarget}
          onOpenChange={(open) => !open && setAuthTarget(null)}
          emulator={authTarget}
          onSuccess={fetchEmulators}
          onOpenScreen={() => {
            setScreenTarget({
              name: authTarget.name,
              url: authTarget.scrcpyUrl ?? null,
              adbPort: authTarget.adbPort,
            })
          }}
        />
      )}
    </div>
  )
}
