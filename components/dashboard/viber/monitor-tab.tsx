"use client"

import Link from "next/link"
import {
  ExternalLinkIcon,
  ImageIcon,
  Loader2Icon,
  PlayIcon,
  RadioIcon,
  SquareIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { InlineError } from "@/components/dashboard/viber/inline-error"
import { messageHasMedia, messagePreviewText } from "@/lib/viber-parser/message-display"
import type { MessageMonitorStatusDto, MonitoredMessageDto } from "@/lib/viber-parser/types"

export interface MonitorGroupRow {
  conversationId: number
  name: string
  enabled: boolean
}

interface MonitorTabProps {
  status: MessageMonitorStatusDto | null
  messages: MonitoredMessageDto[]
  groupRows: MonitorGroupRow[]
  loading: boolean
  error: string | null
  onRetry: () => void
  toggling: boolean
  togglingGroupId: number | null
  onToggleMonitor: () => void
  onToggleGroup: (conversationId: number, enabled: boolean) => void
}

export function MonitorTab({
  status,
  messages,
  groupRows,
  loading,
  error,
  onRetry,
  toggling,
  togglingGroupId,
  onToggleMonitor,
  onToggleGroup,
}: MonitorTabProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <RadioIcon className="size-5 text-indigo-600 dark:text-indigo-400" />
              <CardTitle className="text-base font-semibold">Мониторинг сообщений</CardTitle>
              {status?.liveWatch ? (
                <Badge className="gap-1.5 bg-emerald-600 font-normal text-white hover:bg-emerald-600">
                  <span className="inline-block size-2 animate-pulse rounded-full bg-white" />
                  Live SQLite
                </Badge>
              ) : null}
              {status?.isRunning ? (
                <Badge variant="outline" className="font-normal">
                  Опрос активен
                </Badge>
              ) : (
                <Badge variant="secondary" className="font-normal">
                  Опрос остановлен
                </Badge>
              )}
            </div>
            <CardDescription className="mt-0.5 text-xs">
              Включайте нужные группы. Новые сообщения ловятся в момент записи в Viber; после
              рестарта эмулятора догоняем с сохранённого курсора.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={onToggleMonitor}
              disabled={toggling}
              variant={status?.isRunning ? "destructive" : "default"}
              className="gap-2 text-xs sm:text-sm"
            >
              {toggling ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : status?.isRunning ? (
                <SquareIcon className="size-4" />
              ) : (
                <PlayIcon className="size-4" />
              )}
              {status?.isRunning ? "Остановить опрос" : "Запустить опрос"}
            </Button>

            <Button asChild variant="outline" size="sm" className="h-9 gap-1.5 text-xs">
              <Link href="/dashboard/stream">
                <ExternalLinkIcon className="size-3.5" />
                <span>Мониторинг Viber</span>
              </Link>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <InlineError message={`Данные монитора не обновлены: ${error}`} onRetry={onRetry} />
        ) : null}

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border bg-card/60 p-3.5">
            <span className="block text-xs font-medium text-muted-foreground">
              Обработано сообщений
            </span>
            <p className="mt-1 font-mono text-2xl font-bold tabular-nums">
              {status?.processedMessagesCount ?? 0}
            </p>
            <span className="text-[11px] text-muted-foreground">Новых входящих в БД</span>
          </div>

          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3.5">
            <span className="block text-xs font-medium text-emerald-700 dark:text-emerald-400">
              Номера из текста сообщений
            </span>
            <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              {status?.phonesFromTextCount ?? 0}
            </p>
            <span className="text-[11px] text-muted-foreground">Парсинг профиля не требовался</span>
          </div>

          <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3.5">
            <span className="block text-xs font-medium text-blue-700 dark:text-blue-400">
              Номера из профилей Viber
            </span>
            <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-blue-600 dark:text-blue-400">
              {status?.phonesFromViberCount ?? 0}
            </p>
            <span className="text-[11px] text-muted-foreground">Подтянуты из базы данных</span>
          </div>
        </div>

        <div className="space-y-2">
          <span className="text-xs font-medium">Группы</span>
          <div className="max-h-56 overflow-y-auto rounded-lg border">
            {groupRows.length === 0 ? (
              <p className="p-3 text-xs text-muted-foreground">
                {loading ? "Загрузка групп…" : "Нет групп в снимке базы Viber."}
              </p>
            ) : (
              <ul className="divide-y">
                {groupRows.map((row) => (
                  <li
                    key={row.conversationId}
                    className="flex min-h-11 items-center gap-3 px-3 py-1"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{row.name}</span>
                    {togglingGroupId === row.conversationId ? (
                      <Loader2Icon className="size-4 shrink-0 animate-spin text-muted-foreground" />
                    ) : null}
                    <Switch
                      checked={row.enabled}
                      disabled={togglingGroupId === row.conversationId}
                      onCheckedChange={(checked) => onToggleGroup(row.conversationId, checked)}
                      aria-label={`${row.enabled ? "Выключить" : "Включить"} мониторинг ${row.name}`}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-medium">
            <span>Недавние сообщения</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs text-muted-foreground"
              onClick={onRetry}
            >
              Обновить
            </Button>
          </div>

          {messages.length === 0 ? (
            <div className="rounded-lg border py-8 text-center text-xs text-muted-foreground">
              Пока нет сообщений. Включите группу, чтобы начать мониторинг.
            </div>
          ) : (
            <div className="max-h-[400px] space-y-2 overflow-y-auto">
              {messages.slice(0, 8).map((message) => (
                <div key={message.id} className="space-y-1.5 rounded-lg border bg-card p-3 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-foreground">
                      {message.conversationName || `Чат ${message.conversationId}`}
                    </span>
                    <div className="flex items-center gap-2">
                      {messageHasMedia(message) ? (
                        <Badge variant="outline" className="gap-1 text-[10px]">
                          <ImageIcon className="size-3" />
                          Фото
                        </Badge>
                      ) : null}
                      {message.attachedPhone ? (
                        <Badge
                          variant="outline"
                          className={`font-mono text-[10px] ${
                            message.phoneSource === "message_text"
                              ? "border-emerald-500/40 bg-emerald-500/10 font-bold text-emerald-700 dark:text-emerald-400"
                              : "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-400"
                          }`}
                        >
                          {message.attachedPhone} (
                          {message.phoneSource === "message_text" ? "текст" : "профиль"})
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">
                          Без номера
                        </Badge>
                      )}
                      <span className="text-[10px] tabular-nums text-muted-foreground">
                        {new Date(message.date).toLocaleTimeString("ru-RU")}
                      </span>
                    </div>
                  </div>
                  <p className="line-clamp-2 whitespace-pre-wrap text-[11px] text-muted-foreground">
                    {messagePreviewText(message) || (messageHasMedia(message) ? "Фото" : "—")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
