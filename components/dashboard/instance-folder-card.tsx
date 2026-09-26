"use client"

import * as React from "react"
import Link from "next/link"
import {
  ArrowUpRightIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  ChevronRightIcon,
  CopyIcon,
  ExternalLinkIcon,
  FolderIcon,
  FolderOpenIcon,
  KeyRoundIcon,
  Loader2Icon,
  MessageCircleIcon,
  MoreHorizontalIcon,
  PlayIcon,
  RadioIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  SendIcon,
  Settings2Icon,
  SmartphoneIcon,
  SquareIcon,
  TerminalIcon,
  Trash2Icon,
  XCircleIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
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
  getAdbDetail,
  getAndroidDetail,
  getAuthDetail,
  getEmulatorStatus,
  getViberDetail,
  translateSetupStage,
  type EmulatorItem,
} from "@/lib/emulator-status"
import { formatScrcpyStreamUrl } from "./emulator-screen-dialog"
import { EmulatorStatusBadge } from "./emulator-status-badge"

interface InstanceFolderCardProps {
  emulator: EmulatorItem
  isExpanded: boolean
  isStale?: boolean
  onToggleExpand: () => void
  onAction: (id: string, action: "start" | "stop" | "restart") => void
  onDelete: (id: string, name: string) => void
  onRecreate: (id: string, name: string) => void
  onOpenScreen: (name: string, url: string | null, adbPort?: number | null) => void
  onOpenLogs: (id: string, name: string) => void
  onOpenAuth: (emulator: EmulatorItem) => void
  actionLoading?: string | null
}

export function InstanceFolderCard({
  emulator,
  isExpanded,
  isStale,
  onToggleExpand,
  onAction,
  onDelete,
  onRecreate,
  onOpenScreen,
  onOpenLogs,
  onOpenAuth,
  actionLoading,
}: InstanceFolderCardProps) {
  const isRunning = emulator.state === "running"
  const isWorking = actionLoading?.includes(emulator.id)

  const status = getEmulatorStatus(emulator)
  const adbDetail = getAdbDetail(emulator.adbOnline)
  const androidDetail = getAndroidDetail(emulator.bootCompleted)
  const viberDetail = getViberDetail(emulator.viberRunning)
  const authDetail = getAuthDetail(emulator.viberAccount)

  const secondLineText = status.stageLabel || status.description
  const updatedAtTime = emulator.setupStatus?.updatedAt
    ? new Date(emulator.setupStatus.updatedAt).toLocaleTimeString("ru-RU")
    : null

  const copyText = (text: string, label: string) => {
    try {
      void navigator.clipboard.writeText(text)
      toast.success(`${label} скопирован в буфер обмена`)
    } catch {
      toast.error(`Не удалось скопировать ${label}`)
    }
  }

  return (
    <Card className="overflow-hidden border transition-all duration-200 shadow-sm hover:shadow-md">
      {/* Folder Header */}
      <CardHeader className="bg-muted/30 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onToggleExpand}
            className="flex items-center gap-2.5 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-lg p-1 -m-1 hover:bg-muted/80 transition-colors"
          >
            <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
              {isExpanded ? (
                <FolderOpenIcon className="h-5 w-5 text-amber-500" />
              ) : (
                <FolderIcon className="h-5 w-5 text-amber-500" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-base tracking-tight truncate">
                  {emulator.name}
                </span>
                <EmulatorStatusBadge status={status} isStale={isStale} />
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 font-mono">
                <span>ID: {emulator.id.slice(0, 12)}</span>
                {secondLineText && (
                  <>
                    <span>·</span>
                    <span
                      className="text-muted-foreground/80 truncate max-w-[280px] font-sans"
                      title={secondLineText}
                    >
                      {secondLineText}
                    </span>
                  </>
                )}
                {updatedAtTime && (
                  <>
                    <span>·</span>
                    <span
                      className="text-muted-foreground/60 font-sans font-mono text-[11px] shrink-0"
                      title="Время смены этапа"
                    >
                      {updatedAtTime}
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="ml-1 text-muted-foreground shrink-0">
              {isExpanded ? (
                <ChevronDownIcon className="h-4 w-4" />
              ) : (
                <ChevronRightIcon className="h-4 w-4" />
              )}
            </div>
          </button>
        </div>

        {/* Quick Actions in Header */}
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          {/* Viber Auth Button */}
          <Button
            variant="outline"
            size="sm"
            disabled={!isRunning || isWorking}
            onClick={() => onOpenAuth(emulator)}
            className="gap-1.5 border-purple-500/30 text-purple-600 hover:bg-purple-500/10 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300"
            title="Авторизовать аккаунт Viber на этом инстансе"
          >
            <KeyRoundIcon className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Вход в Viber</span>
          </Button>

          {/* Screen Button */}
          <Button
            variant="secondary"
            size="sm"
            disabled={!isRunning || isWorking}
            onClick={() => onOpenScreen(emulator.name, emulator.scrcpyUrl ?? null, emulator.adbPort)}
            className="gap-1.5"
            title="Просмотр экрана устройства"
          >
            <SmartphoneIcon className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Экран</span>
          </Button>

          {/* Power toggle */}
          {isRunning ? (
            <Button
              variant="outline"
              size="sm"
              disabled={isWorking}
              onClick={() => onAction(emulator.id, "stop")}
              className="gap-1.5 text-muted-foreground hover:text-destructive"
              title="Остановить инстанс"
            >
              {isWorking ? (
                <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <SquareIcon className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">Стоп</span>
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              disabled={isWorking}
              onClick={() => onAction(emulator.id, "start")}
              className="gap-1.5 text-emerald-600 hover:text-emerald-700"
              title="Запустить инстанс"
            >
              {isWorking ? (
                <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <PlayIcon className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">Пуск</span>
            </Button>
          )}

          {/* More actions menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" disabled={isWorking}>
                <MoreHorizontalIcon className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Управление инстансом</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onOpenAuth(emulator)} disabled={!isRunning}>
                <KeyRoundIcon className="h-4 w-4 mr-2 text-purple-600" />
                Вход в Viber
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAction(emulator.id, "restart")} disabled={!isRunning}>
                <RefreshCwIcon className="h-4 w-4 mr-2" />
                Перезапустить
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onOpenLogs(emulator.id, emulator.name)}>
                <TerminalIcon className="h-4 w-4 mr-2" />
                Системные логи
              </DropdownMenuItem>
              {emulator.scrcpyUrl && (
                <DropdownMenuItem asChild>
                  <a
                    href={formatScrcpyStreamUrl(emulator.scrcpyUrl, emulator.adbPort) || emulator.scrcpyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLinkIcon className="h-4 w-4 mr-2" />
                    Экран в новой вкладке
                  </a>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onRecreate(emulator.id, emulator.name)}>
                <RotateCcwIcon className="h-4 w-4 mr-2 text-blue-600 dark:text-blue-400" />
                Пересоздать инстанс
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => onDelete(emulator.id, emulator.name)}
              >
                <Trash2Icon className="h-4 w-4 mr-2" />
                Удалить инстанс
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      {/* Expanded Instance Configuration & Settings Content */}
      {isExpanded && (
        <CardContent className="p-4 sm:p-6 space-y-6">
          {/* Section 1: Parameters & Network Config */}
          <div className="rounded-xl border bg-card p-4 sm:p-5 space-y-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
              <div className="flex items-center gap-2">
                <Settings2Icon className="h-4 w-4 text-primary" />
                <h4 className="font-semibold text-sm">Параметры и конфигурация инстанса</h4>
              </div>
              <div className="flex items-center gap-2 text-xs flex-wrap">
                <Badge
                  variant="outline"
                  className={
                    adbDetail.variant === "success"
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-xs"
                      : adbDetail.variant === "danger"
                        ? "bg-destructive/10 text-destructive border-destructive/30 text-xs"
                        : "text-muted-foreground text-xs"
                  }
                >
                  ADB: {adbDetail.text}
                </Badge>
                <Badge
                  variant="outline"
                  className={
                    androidDetail.variant === "success"
                      ? "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/30 text-xs"
                      : androidDetail.variant === "warning"
                        ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 text-xs"
                        : "text-muted-foreground text-xs"
                  }
                >
                  Android: {androidDetail.text}
                </Badge>
                <Badge
                  variant="outline"
                  className={
                    viberDetail.variant === "success"
                      ? "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30 text-xs"
                      : viberDetail.variant === "warning"
                        ? "bg-muted text-muted-foreground border-border text-xs"
                        : "text-muted-foreground text-xs"
                  }
                >
                  Viber: {viberDetail.text}
                </Badge>
                <Badge
                  variant="outline"
                  className={
                    authDetail.variant === "success"
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-xs"
                      : authDetail.variant === "warning"
                        ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 text-xs"
                        : "text-muted-foreground border-border text-xs"
                  }
                  title={authDetail.text}
                >
                  {authDetail.text}
                </Badge>
              </div>
            </div>

            {/* Setup result alerts */}
            {status.id === "setup_complete" && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2Icon className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span>Настройка завершена. Проверьте вход в Viber на экране.</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenScreen(emulator.name, emulator.scrcpyUrl ?? null, emulator.adbPort)}
                  className="h-7 text-xs border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 shrink-0"
                >
                  Открыть экран
                </Button>
              </div>
            )}

            {status.id === "setup_failed" && emulator.setupStatus && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <XCircleIcon className="h-4 w-4 shrink-0" />
                  <div>
                    <div className="font-semibold">Ошибка настройки</div>
                    <div>
                      {status.stageLabel ? `Этап: ${status.stageLabel}` : ""}{" "}
                      (код завершения: {emulator.setupStatus.exitCode})
                    </div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenLogs(emulator.id, emulator.name)}
                  className="h-7 text-xs border-destructive/40 text-destructive hover:bg-destructive/20 shrink-0"
                >
                  Открыть логи
                </Button>
              </div>
            )}

            {!isRunning && emulator.setupStatus && (
              <div className="rounded-lg border bg-muted/40 p-2.5 text-xs text-muted-foreground flex items-center justify-between gap-2">
                <span>
                  Предыдущий результат настройки:{" "}
                  <strong className="text-foreground">
                    {emulator.setupStatus.state === "ready"
                      ? "Настройка завершена"
                      : emulator.setupStatus.state === "failed"
                        ? "Сбой настройки"
                        : "В процессе"}
                  </strong>
                  {emulator.setupStatus.stage && ` (${translateSetupStage(emulator.setupStatus.stage)})`}
                </span>
                {emulator.setupStatus.updatedAt && (
                  <span className="font-mono text-[11px]">
                    {new Date(emulator.setupStatus.updatedAt).toLocaleString("ru-RU")}
                  </span>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              <div className="space-y-1">
                <span className="text-muted-foreground">Имя инстанса:</span>
                <div className="font-medium text-foreground">{emulator.name}</div>
              </div>

              <div className="space-y-1">
                <span className="text-muted-foreground">ID контейнера:</span>
                <div className="flex items-center gap-1.5 font-mono">
                  <code className="bg-muted px-1.5 py-0.5 rounded text-[11px] truncate max-w-[180px]">
                    {emulator.id}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 text-muted-foreground hover:text-foreground"
                    onClick={() => copyText(emulator.id, "ID инстанса")}
                    title="Копировать ID"
                  >
                    <CopyIcon className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-muted-foreground">Состояние контейнера:</span>
                <div className="font-medium text-foreground">
                  {emulator.state === "running" ? "Работает (running)" : "Остановлен (exited)"}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-muted-foreground">ADB подключение (Serial):</span>
                <div className="flex items-center gap-1.5 font-mono">
                  <code className="bg-muted px-1.5 py-0.5 rounded text-[11px]">
                    {emulator.adbSerial || "Не назначен"}
                  </code>
                  {emulator.adbSerial && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 text-muted-foreground hover:text-foreground"
                      onClick={() => copyText(emulator.adbSerial!, "ADB Serial")}
                      title="Копировать ADB Serial"
                    >
                      <CopyIcon className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-muted-foreground">Порт ADB:</span>
                <div className="font-mono text-foreground">
                  {emulator.adbPort ? `${emulator.adbPort}` : "5555"}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-muted-foreground">Дата создания:</span>
                <div className="text-foreground">
                  {emulator.created
                    ? new Date(emulator.created * 1000).toLocaleString("ru-RU", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "—"}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-muted-foreground">Этап настройки:</span>
                <div className="text-foreground">
                  {emulator.setupStatus?.stage ? (
                    <span className="flex items-center gap-1.5 flex-wrap">
                      <span>{translateSetupStage(emulator.setupStatus.stage)}</span>
                      {emulator.setupStatus.updatedAt && (
                        <span className="text-muted-foreground text-[11px] font-mono">
                          ({new Date(emulator.setupStatus.updatedAt).toLocaleTimeString("ru-RU")})
                        </span>
                      )}
                    </span>
                  ) : (
                    emulator.status || "—"
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-muted-foreground">Экран (Scrcpy Web):</span>
                <div>
                  {emulator.scrcpyUrl ? (
                    <a
                      href={formatScrcpyStreamUrl(emulator.scrcpyUrl, emulator.adbPort) || emulator.scrcpyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-1 font-mono text-[11px]"
                    >
                      <span>Открыть стрим</span>
                      <ExternalLinkIcon className="h-3 w-3" />
                    </a>
                  ) : (
                    <span className="text-muted-foreground">Не настроен</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Management & Maintenance Actions */}
          <div className="rounded-xl border bg-card p-4 sm:p-5 space-y-3 shadow-sm">
            <h4 className="font-semibold text-sm">Управление и обслуживание</h4>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!isRunning || isWorking}
                onClick={() => onOpenAuth(emulator)}
                className="gap-2 border-purple-500/30 text-purple-600 hover:bg-purple-500/10 hover:text-purple-700 dark:text-purple-400"
              >
                <KeyRoundIcon className="h-4 w-4" />
                Вход в Viber
              </Button>

              <Button
                variant="outline"
                size="sm"
                disabled={!isRunning || isWorking}
                onClick={() => onOpenScreen(emulator.name, emulator.scrcpyUrl ?? null, emulator.adbPort)}
                className="gap-2"
              >
                <SmartphoneIcon className="h-4 w-4 text-blue-500" />
                Экран устройства
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenLogs(emulator.id, emulator.name)}
                className="gap-2"
              >
                <TerminalIcon className="h-4 w-4 text-emerald-500" />
                Системные логи
              </Button>

              <Button
                variant="outline"
                size="sm"
                disabled={!isRunning || isWorking}
                onClick={() => onAction(emulator.id, "restart")}
                className="gap-2"
              >
                <RefreshCwIcon className="h-4 w-4 text-amber-500" />
                Перезапустить
              </Button>

              <Button
                variant="outline"
                size="sm"
                disabled={isWorking}
                onClick={() => onRecreate(emulator.id, emulator.name)}
                className="gap-2 text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                <RotateCcwIcon className="h-4 w-4" />
                Пересоздать инстанс
              </Button>

              <Button
                variant="destructive"
                size="sm"
                disabled={isWorking}
                onClick={() => onDelete(emulator.id, emulator.name)}
                className="gap-2 sm:ml-auto"
              >
                <Trash2Icon className="h-4 w-4" />
                Удалить инстанс
              </Button>
            </div>
          </div>

          {/* Section 3: Navigation Links to dedicated workspaces */}
          <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                Модули сбора и работы с данными
              </h4>
              <span className="text-[11px] text-muted-foreground">
                Окружение: {emulator.name}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Link
                href={`/dashboard/viber?instance=${encodeURIComponent(emulator.name)}`}
                className="flex items-center justify-between p-3 rounded-lg border bg-background hover:bg-muted/50 transition-colors group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 rounded-md bg-purple-500/10 text-purple-600 shrink-0">
                    <MessageCircleIcon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold group-hover:text-primary transition-colors truncate">
                      Группы и участники
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      Сбор и база участников
                    </div>
                  </div>
                </div>
                <ArrowUpRightIcon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0 ml-2" />
              </Link>

              <Link
                href={`/dashboard/stream?instance=${encodeURIComponent(emulator.name)}`}
                className="flex items-center justify-between p-3 rounded-lg border bg-background hover:bg-muted/50 transition-colors group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 rounded-md bg-cyan-500/10 text-cyan-600 shrink-0">
                    <RadioIcon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold group-hover:text-primary transition-colors truncate">
                      Мониторинг
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      Перехват потока сообщений
                    </div>
                  </div>
                </div>
                <ArrowUpRightIcon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0 ml-2" />
              </Link>

              <Link
                href={`/dashboard/broadcast?instance=${encodeURIComponent(emulator.name)}`}
                className="flex items-center justify-between p-3 rounded-lg border bg-background hover:bg-muted/50 transition-colors group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 rounded-md bg-emerald-500/10 text-emerald-600 shrink-0">
                    <SendIcon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold group-hover:text-primary transition-colors truncate">
                      Рассылка
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      Отправка сообщений
                    </div>
                  </div>
                </div>
                <ArrowUpRightIcon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0 ml-2" />
              </Link>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  )
}
