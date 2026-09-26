"use client"

import { DatabaseIcon, KeyRoundIcon, Loader2Icon, RefreshCwIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { InlineError } from "@/components/dashboard/viber/inline-error"
import type { DatabaseStatsDto, ViberDecodeResponse } from "@/lib/viber-parser/types"

interface DatabaseTabProps {
  stats: DatabaseStatsDto | null
  statsLoading: boolean
  statsError: string | null
  onRetryStats: () => void
  groupsCount: number
  isSyncing: boolean
  isDecoding: boolean
  isTaskRunning: boolean
  lastDecodeResult: ViberDecodeResponse | null
  onSync: () => void
  onDecode: () => void
}

export function DatabaseTab({
  stats,
  statsLoading,
  statsError,
  onRetryStats,
  groupsCount,
  isSyncing,
  isDecoding,
  isTaskRunning,
  lastDecodeResult,
  onSync,
  onDecode,
}: DatabaseTabProps) {
  return (
    <>
      {statsError ? (
        <InlineError
          message={`Статистика базы не обновлена: ${statsError}`}
          onRetry={onRetryStats}
        />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="space-y-1 p-4">
          <p className="text-xs font-medium text-muted-foreground">Чаты и диалоги</p>
          <p className="text-2xl font-bold tabular-nums">
            {statsLoading && !stats ? "…" : stats?.conversationsCount ?? groupsCount}
          </p>
          <p className="text-[11px] text-muted-foreground">Бесед в таблице conversations</p>
        </Card>

        <Card className="space-y-1 p-4">
          <p className="text-xs font-medium text-muted-foreground">Всего сообщений</p>
          <p className="text-2xl font-bold tabular-nums">
            {statsLoading && !stats ? "…" : (stats?.messagesCount ?? 0).toLocaleString("ru-RU")}
          </p>
          <p className="text-[11px] text-muted-foreground">В таблице messages</p>
        </Card>

        <Card className="space-y-1 p-4">
          <p className="text-xs font-medium text-muted-foreground">Карточек участников</p>
          <p className="text-2xl font-bold tabular-nums">
            {statsLoading && !stats ? "…" : (stats?.participantsCount ?? 0).toLocaleString("ru-RU")}
          </p>
          <p className="text-[11px] text-muted-foreground">В таблице participants_info</p>
        </Card>

        <Card className="space-y-1 border-amber-500/20 bg-amber-500/5 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
              Ожидают дешифровки
            </p>
            {stats && stats.undecodedParticipantsCount > 0 ? (
              <Badge
                variant="outline"
                className="border-amber-500/30 text-[10px] text-amber-700 dark:text-amber-400"
              >
                Требуется decode
              </Badge>
            ) : null}
          </div>
          <p className="text-2xl font-bold tabular-nums text-amber-700 dark:text-amber-400">
            {statsLoading && !stats
              ? "…"
              : (stats?.undecodedParticipantsCount ?? 0).toLocaleString("ru-RU")}
          </p>
          <p className="text-[11px] text-muted-foreground">Записи с префиксом em:...</p>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <DatabaseIcon className="size-5 text-primary" />
              <CardTitle className="text-base font-semibold">
                Снимок базы данных (Snapshot)
              </CardTitle>
            </div>
            <CardDescription className="text-xs">
              Синхронизирует рабочий файл{" "}
              <code className="font-mono text-[11px]">viber_messages</code> с устройства эмулятора в
              локальную копию для чтения без задержек.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1 rounded-lg border bg-muted/30 p-3 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Статус локального снимка:</span>
                <span className="font-semibold text-foreground">
                  {stats?.isSnapshotCurrent ? "Актуален" : "Требуется обновление"}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Путь к БД на устройстве:</span>
                <span className="truncate font-mono text-[11px] text-muted-foreground">
                  /data/data/com.viber.voip/databases/viber_messages
                </span>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button
              onClick={onSync}
              disabled={isSyncing || isTaskRunning}
              className="w-full gap-2 text-xs sm:text-sm"
              variant="outline"
            >
              {isSyncing ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                <RefreshCwIcon className="size-4" />
              )}
              {isSyncing ? "Копирование снимка…" : "Синхронизировать снимок с эмулятора"}
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <KeyRoundIcon className="size-5 text-emerald-600 dark:text-emerald-400" />
              <CardTitle className="text-base font-semibold">
                Дешифровка базы данных (Decode)
              </CardTitle>
            </div>
            <CardDescription className="text-xs">
              Дешифрует зашифрованные ID участников (
              <code className="font-mono text-[11px]">em:...</code> &rarr;{" "}
              <code className="font-mono text-[11px]">member_id</code>), перезапускает Viber для
              сброса WAL и ожидает сетевого синка открытых номеров.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1 rounded-lg border bg-muted/30 p-3 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Защита профиля бота:</span>
                <span className="font-semibold text-emerald-600">Включена (ID 1 защищен)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Время ожидания синка:</span>
                <span className="font-semibold">10 секунд (автоматически)</span>
              </div>
            </div>

            {lastDecodeResult ? (
              <div className="space-y-1 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs">
                <div className="font-semibold text-emerald-700 dark:text-emerald-300">
                  Результат последней дешифровки:
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Дешифровано:{" "}
                  <span className="font-semibold text-foreground">
                    {lastDecodeResult.decodedCount ?? 0}
                  </span>{" "}
                  · Найдено недешифрованных:{" "}
                  <span className="font-semibold text-foreground">
                    {lastDecodeResult.undecodedFound ?? 0}
                  </span>{" "}
                  · Всего записей:{" "}
                  <span className="font-semibold text-foreground">
                    {lastDecodeResult.totalRows ?? 0}
                  </span>
                </div>
              </div>
            ) : null}
          </CardContent>
          <CardFooter className="flex gap-2">
            <Button
              onClick={onDecode}
              disabled={isDecoding || isTaskRunning}
              className="w-full gap-2 bg-emerald-600 text-xs text-white hover:bg-emerald-700 sm:text-sm"
            >
              {isDecoding ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                <KeyRoundIcon className="size-4" />
              )}
              {isDecoding ? "Выполняется дешифровка и перезапуск…" : "Дешифровать все записи"}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </>
  )
}
