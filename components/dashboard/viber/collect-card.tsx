"use client"

import { Loader2Icon, SparklesIcon, SquareIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { InlineError } from "@/components/dashboard/viber/inline-error"
import { groupLabel } from "@/components/dashboard/viber/format"
import type { ViberGroup } from "@/lib/viber-parser/types"

interface CollectCardProps {
  groups: ViberGroup[]
  groupsLoading: boolean
  groupsError: string | null
  onRetryGroups: () => void
  selectedGroupId: string | null
  onSelectGroup: (value: string) => void
  selectedGroup: ViberGroup | null
  restartApp: boolean
  onRestartAppChange: (value: boolean) => void
  isTaskRunning: boolean
  isStarting: boolean
  isStopping: boolean
  onStart: () => void
  onStop: () => void
}

export function CollectCard({
  groups,
  groupsLoading,
  groupsError,
  onRetryGroups,
  selectedGroupId,
  onSelectGroup,
  selectedGroup,
  restartApp,
  onRestartAppChange,
  isTaskRunning,
  isStarting,
  isStopping,
  onStart,
  onStop,
}: CollectCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base font-semibold">Сбор участников</CardTitle>
            <CardDescription className="text-xs">
              Выберите сообщество Viber — полный обход всех участников через Frida и UI автоматизацию
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {groupsError ? (
          <InlineError
            message={`Список групп не обновлён: ${groupsError}`}
            onRetry={onRetryGroups}
          />
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="select-group" className="text-xs">
              Группа / Сообщество
            </Label>
            <Select
              value={selectedGroupId ?? ""}
              onValueChange={onSelectGroup}
              disabled={groupsLoading || groups.length === 0 || isTaskRunning}
            >
              <SelectTrigger id="select-group" className="text-xs">
                <SelectValue placeholder="Выберите группу" />
              </SelectTrigger>
              <SelectContent>
                {groups.map((group) => (
                  <SelectItem key={group.conversationId} value={String(group.conversationId)}>
                    <div className="flex w-full items-center justify-between gap-2">
                      <span className="max-w-[200px] truncate font-medium">
                        {groupLabel(group)}
                      </span>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        ({(group.memberCount ?? 0).toLocaleString("ru-RU")} уч.)
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col justify-end">
            <div className="flex items-center space-x-2 py-2">
              <Switch
                id="restart-app"
                checked={restartApp}
                onCheckedChange={onRestartAppChange}
                disabled={isTaskRunning}
              />
              <Label htmlFor="restart-app" className="cursor-pointer text-xs">
                Перезапуск Viber для сетевого синка телефонов
              </Label>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-2">
          <div className="flex items-center gap-2">
            <Button
              onClick={onStart}
              disabled={!selectedGroup || isTaskRunning || isStarting}
              className="gap-2 bg-indigo-600 text-xs font-medium text-white shadow-sm hover:bg-indigo-700 sm:text-sm"
            >
              {isStarting ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                <SparklesIcon className="size-4" />
              )}
              {isStarting ? "Инициализация…" : "Запустить сбор участников"}
            </Button>

            {isTaskRunning ? (
              <Button
                variant="destructive"
                onClick={onStop}
                disabled={isStopping}
                className="gap-1.5 text-xs sm:text-sm"
              >
                <SquareIcon className="size-4" />
                Остановить сбор
              </Button>
            ) : null}
          </div>

          {selectedGroup ? (
            <div className="text-xs text-muted-foreground">
              Выбрано:{" "}
              <span className="font-semibold text-foreground">{groupLabel(selectedGroup)}</span> (ID{" "}
              {selectedGroup.conversationId})
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
