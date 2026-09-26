"use client"

import {
  ClockIcon,
  CopyIcon,
  DownloadIcon,
  RefreshCwIcon,
  SearchIcon,
  ShieldIcon,
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { InlineError } from "@/components/dashboard/viber/inline-error"
import { formatLastSeen, isDecodedMember, type MemberFilter } from "@/components/dashboard/viber/format"
import type { ViberGroup, ViberMember, ViberMembersResponse } from "@/lib/viber-parser/types"

interface MembersCardProps {
  selectedGroup: ViberGroup | null
  members: ViberMembersResponse | null
  filteredMembers: ViberMember[]
  loading: boolean
  error: string | null
  onRetry: () => void
  searchQuery: string
  onSearchQueryChange: (value: string) => void
  filter: MemberFilter
  onFilterChange: (value: MemberFilter) => void
  hideDuplicates: boolean
  onHideDuplicatesChange: (value: boolean) => void
  onExportTxt: () => void
  onExportCsv: () => void
  onExportJson: () => void
  onCopyPhones: () => void
}

export function MembersCard({
  selectedGroup,
  members,
  filteredMembers,
  loading,
  error,
  onRetry,
  searchQuery,
  onSearchQueryChange,
  filter,
  onFilterChange,
  hideDuplicates,
  onHideDuplicatesChange,
  onExportTxt,
  onExportCsv,
  onExportJson,
  onCopyPhones,
}: MembersCardProps) {
  const total = members?.count ?? 0
  const hasMembers = (members?.members.length ?? 0) > 0

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base font-semibold">Участники группы</CardTitle>
            <CardDescription className="text-xs">
              {selectedGroup ? (
                <>
                  Всего в базе: {total.toLocaleString("ru-RU")}
                  {filteredMembers.length !== (members?.members.length ?? 0) && (
                    <span className="ml-1.5 font-medium text-primary">
                      (отобрано: {filteredMembers.length.toLocaleString("ru-RU")})
                    </span>
                  )}
                </>
              ) : (
                "Выберите группу для просмотра"
              )}
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-40 sm:w-56">
              <SearchIcon className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Поиск по имени/номеру…"
                value={searchQuery}
                onChange={(event) => onSearchQueryChange(event.target.value)}
                className="h-8 pl-8 text-xs"
                aria-label="Поиск участников"
              />
            </div>

            <Select value={filter} onValueChange={(value) => onFilterChange(value as MemberFilter)}>
              <SelectTrigger className="h-8 w-36 text-xs" aria-label="Фильтр участников">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все ({total})</SelectItem>
                <SelectItem value="decoded">Дешифрованные</SelectItem>
                <SelectItem value="undecoded">Ожидают декодирования</SelectItem>
                <SelectItem value="admins">Администраторы</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex h-8 items-center gap-1.5 rounded-md border border-border/60 bg-muted/40 px-2.5 text-xs">
              <Switch
                id="hide-duplicates"
                checked={hideDuplicates}
                onCheckedChange={onHideDuplicatesChange}
                className="scale-75 data-[state=checked]:bg-emerald-600"
              />
              <Label
                htmlFor="hide-duplicates"
                className="cursor-pointer select-none text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                Без дубликатов
              </Label>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1 text-xs"
              onClick={onExportTxt}
              disabled={!hasMembers}
            >
              <DownloadIcon className="size-3" />
              TXT
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1 text-xs"
              onClick={onExportCsv}
              disabled={!hasMembers}
            >
              <DownloadIcon className="size-3" />
              CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1 text-xs"
              onClick={onExportJson}
              disabled={!hasMembers}
            >
              <DownloadIcon className="size-3" />
              JSON
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1 text-xs"
              onClick={onCopyPhones}
              disabled={!hasMembers}
            >
              <CopyIcon className="size-3" />
              Копировать
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={onRetry}
              disabled={loading}
              aria-label="Обновить участников"
            >
              <RefreshCwIcon className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {error ? (
          <InlineError
            message={`Список участников не обновлён: ${error}`}
            onRetry={onRetry}
          />
        ) : null}

        {loading && !members ? (
          <div className="space-y-2 py-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            {!hasMembers
              ? "Участники для этой группы пока не собраны. Нажмите «Запустить сбор участников» выше."
              : "Ничего не найдено по выбранным фильтрам."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">№</TableHead>
                  <TableHead className="w-[180px]">Телефон / Номер</TableHead>
                  <TableHead className="w-[120px]">Статус</TableHead>
                  <TableHead className="w-[140px]">Активность</TableHead>
                  <TableHead>Имя контакта</TableHead>
                  <TableHead className="w-[120px]">Роль в группе</TableHead>
                  <TableHead className="w-[80px] text-right">Тип</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMembers.map((member, index) => {
                  const decoded = isDecodedMember(member)
                  return (
                    <TableRow key={member.participantId ?? `m-${index}`}>
                      <TableCell className="font-mono text-xs tabular-nums text-muted-foreground">
                        {index + 1}
                      </TableCell>
                      <TableCell className="font-mono text-xs tabular-nums">
                        {decoded ? (
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                            {member.phoneNumber}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                            <ClockIcon className="size-3" />
                            {member.rawNumber && member.rawNumber.length > 8
                              ? `${member.rawNumber.slice(0, 13)}…`
                              : "Ожидает дешифровки"}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {decoded ? (
                          <Badge
                            variant="outline"
                            className="border-emerald-500/30 bg-emerald-500/5 text-[10px] font-normal text-emerald-600"
                          >
                            Дешифрован
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-amber-500/30 bg-amber-500/5 text-[10px] font-normal text-amber-600"
                          >
                            Зашифрован
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {member.isOnline ? (
                          <Badge className="gap-1 border-emerald-500/30 bg-emerald-500/15 text-[10px] font-normal text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400">
                            <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
                            В сети
                          </Badge>
                        ) : member.lastSeen ? (
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {formatLastSeen(member.lastSeen)}
                          </span>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {member.name ? (
                          <span className="font-medium text-foreground">{member.name}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {member.roleLabel === "superadmin" ? (
                          <Badge
                            variant="secondary"
                            className="border-purple-500/20 bg-purple-500/10 text-[10px] text-purple-700 dark:text-purple-300"
                          >
                            Суперадмин
                          </Badge>
                        ) : member.roleLabel === "admin" ? (
                          <Badge
                            variant="secondary"
                            className="border-blue-500/20 bg-blue-500/10 text-[10px] text-blue-700 dark:text-blue-300"
                          >
                            Админ
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">
                            Участник
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {member.isSelf ? (
                          <Badge className="gap-1 bg-emerald-600 text-[10px] text-white">
                            <ShieldIcon className="size-2.5" />
                            Бот
                          </Badge>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
