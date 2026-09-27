"use client"

import * as React from "react"
import Link from "next/link"
import {
  ArrowRightIcon,
  CheckCircle2Icon,
  DatabaseIcon,
  FolderKanbanIcon,
  Loader2Icon,
  MessageCircleIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
  UsersIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { viberApi } from "@/lib/viber-parser/client"
import type { GroupSyncStatus, UsersSyncStatus } from "@/lib/viber-parser/types"

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "—"
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return String(dateStr)
    return d.toLocaleString("ru-RU", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return String(dateStr)
  }
}

export function SourcesTable() {
  const [syncStatus, setSyncStatus] = React.useState<UsersSyncStatus | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [syncingGroupId, setSyncingGroupId] = React.useState<number | null>(null)
  const [isSyncingAll, setIsSyncingAll] = React.useState(false)

  const loadData = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await viberApi.users.getSyncStatus()
      setSyncStatus(res)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Не удалось получить статус синхронизации")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void loadData()
  }, [loadData])

  const handleSyncGroup = async (conversationId: number, groupName: string) => {
    setSyncingGroupId(conversationId)
    try {
      const res = await viberApi.users.syncGroup(conversationId)
      toast.success(`Группа «${groupName}» успешно синхронизирована`, {
        description: `Обновлено пользователей: ${res.usersUpserted}`,
      })
      await loadData()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : `Ошибка синхронизации группы ${groupName}`)
    } finally {
      setSyncingGroupId(null)
    }
  }

  const handleSyncAll = async () => {
    setIsSyncingAll(true)
    try {
      const res = await viberApi.users.syncAll()
      toast.success("Все группы успешно синхронизированы с Supabase", {
        description: `Обновлено ${res.usersUpserted} пользователей в ${res.groupsTotal} группах`,
      })
      await loadData()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Ошибка при синхронизации")
    } finally {
      setIsSyncingAll(false)
    }
  }

  const groups: GroupSyncStatus[] = syncStatus?.groups || []

  return (
    <div className="space-y-6">
      {/* 1. Header Overview Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card/70 border-sidebar-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Подключено групп</CardTitle>
            <FolderKanbanIcon className="size-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">
              {syncStatus?.groupsTotal != null ? syncStatus.groupsTotal : groups.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Чат-сообщества в Supabase</p>
          </CardContent>
        </Card>

        <Card className="bg-card/70 border-sidebar-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Всего участников</CardTitle>
            <UsersIcon className="size-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">
              {syncStatus?.membersTotal != null ? syncStatus.membersTotal.toLocaleString("ru-RU") : "—"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Суммарно по всем группам</p>
          </CardContent>
        </Card>

        <Card className="bg-card/70 border-sidebar-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Пользователей в базе</CardTitle>
            <DatabaseIcon className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">
              {syncStatus?.usersTotal != null ? syncStatus.usersTotal.toLocaleString("ru-RU") : "—"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Уникальных контактов</p>
          </CardContent>
        </Card>

        <Card className="bg-card/70 border-sidebar-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Статус связи</CardTitle>
            <ShieldCheckIcon className="size-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-sm font-semibold text-emerald-400">Активно</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 truncate">
              {syncStatus?.message || "База данных доступна"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 2. Actions bar */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Список синхронизированных групп</h3>
          <p className="text-xs text-muted-foreground">Группы Viber, сохранённые в таблице viber_groups</p>
        </div>

        <Button
          size="sm"
          onClick={handleSyncAll}
          disabled={isSyncingAll}
          className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          <RefreshCwIcon className={`size-4 ${isSyncingAll ? "animate-spin" : ""}`} />
          <span>{isSyncingAll ? "Синхронизация..." : "Синхронизировать все"}</span>
        </Button>
      </div>

      {/* 3. Groups Table */}
      <Card className="border-sidebar-border bg-card/60 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-sidebar-border/60 hover:bg-transparent">
                <TableHead className="min-w-[240px]">Название группы</TableHead>
                <TableHead className="min-w-[140px]">ID беседы</TableHead>
                <TableHead className="min-w-[200px]">Ключ группы (groupKey)</TableHead>
                <TableHead className="min-w-[140px] text-right">Участников</TableHead>
                <TableHead className="min-w-[120px] text-right">Активных</TableHead>
                <TableHead className="min-w-[180px]">Последняя синхронизация</TableHead>
                <TableHead className="min-w-[160px] text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i} className="border-sidebar-border/40">
                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : groups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                    Группы пока не синхронизированы в Supabase. Запустите сбор в панели Viber или нажмите «Синхронизировать все».
                  </TableCell>
                </TableRow>
              ) : (
                groups.map((group) => {
                  const isThisSyncing = syncingGroupId === group.conversationId

                  return (
                    <TableRow key={group.conversationId} className="border-sidebar-border/40 hover:bg-sidebar-accent/30">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <MessageCircleIcon className="size-4 text-primary shrink-0" />
                          <span className="font-semibold text-sm">{group.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        #{group.conversationId}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground truncate max-w-[200px]" title={group.groupKey}>
                        {group.groupKey}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-semibold">
                        {group.participantCount != null
                          ? group.participantCount.toLocaleString("ru-RU")
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-emerald-400">
                        {group.activeMembers != null
                          ? group.activeMembers.toLocaleString("ru-RU")
                          : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(group.lastSyncedAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSyncGroup(group.conversationId, group.name)}
                            disabled={isThisSyncing}
                            className="h-8 text-xs gap-1.5"
                          >
                            <RefreshCwIcon className={`size-3.5 ${isThisSyncing ? "animate-spin" : ""}`} />
                            <span>{isThisSyncing ? "..." : "Синхронизировать"}</span>
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                            className="h-8 text-xs gap-1 text-muted-foreground hover:text-foreground"
                          >
                            <Link href={`/dashboard/viber?group=${encodeURIComponent(group.name)}`}>
                              <span>Сбор</span>
                              <ArrowRightIcon className="size-3.5" />
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  )
}
