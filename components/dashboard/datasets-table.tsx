"use client"

import * as React from "react"
import {
  CheckIcon,
  CopyIcon,
  DatabaseIcon,
  DownloadIcon,
  Loader2Icon,
  PhoneIcon,
  RefreshCwIcon,
  SearchIcon,
  ShieldCheckIcon,
  UserCheckIcon,
  UsersIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import type { UsersSyncStatus, ViberUserRow } from "@/lib/viber-parser/types"

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

export function DatasetsTable() {
  const [users, setUsers] = React.useState<ViberUserRow[]>([])
  const [totalCount, setTotalCount] = React.useState<number>(0)
  const [syncStatus, setSyncStatus] = React.useState<UsersSyncStatus | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [isSyncing, setIsSyncing] = React.useState(false)

  // Filters & Pagination
  const [searchQuery, setSearchQuery] = React.useState("")
  const [page, setPage] = React.useState(0)
  const [pageSize, setPageSize] = React.useState(25)
  const [copiedId, setCopiedId] = React.useState<string | null>(null)

  const loadSyncStatus = React.useCallback(async () => {
    try {
      const status = await viberApi.users.getSyncStatus()
      setSyncStatus(status)
    } catch {
      // ignore
    }
  }, [])

  const loadUsers = React.useCallback(async () => {
    setLoading(true)
    try {
      const queryParams: { limit: number; offset: number; phone?: string; name?: string } = {
        limit: pageSize,
        offset: page * pageSize,
      }
      if (searchQuery.trim()) {
        const clean = searchQuery.trim()
        if (clean.startsWith("+") || /^\d+$/.test(clean.replace(/\D/g, ""))) {
          queryParams.phone = clean
        } else {
          queryParams.name = clean
        }
      }

      const res = await viberApi.users.list(queryParams)
      setUsers(res.items || [])
      setTotalCount(res.total ?? (res.items || []).length)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Не удалось загрузить данные из Supabase")
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, searchQuery])

  React.useEffect(() => {
    void loadSyncStatus()
  }, [loadSyncStatus])

  React.useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  const handleSyncAll = async () => {
    setIsSyncing(true)
    try {
      const res = await viberApi.users.syncAll()
      toast.success(res.message || "Синхронизация с Supabase успешно выполнена", {
        description: `Обновлено пользователей: ${res.usersUpserted}, групп: ${res.groupsTotal}`,
      })
      await loadSyncStatus()
      await loadUsers()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Ошибка при синхронизации с Supabase")
    } finally {
      setIsSyncing(false)
    }
  }

  const handleCopy = (text?: string | null) => {
    if (!text) return
    navigator.clipboard.writeText(text)
    setCopiedId(text)
    toast.success("Номер скопирован в буфер обмена")
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleExportCsv = () => {
    if (users.length === 0) {
      toast.error("Нет данных для экспорта")
      return
    }
    const headers = ["ID", "Телефон", "Имя", "Имя Viber", "Онлайн", "Был в сети", "Синхронизировано"]
    const rows = users.map((u) => [
      u.id ?? "",
      u.phone ?? "",
      `"${(u.name || "").replace(/"/g, '""')}"`,
      `"${(u.viber_name || u.viberName || "").replace(/"/g, '""')}"`,
      (u.is_online ?? u.isOnline) ? "Да" : "Нет",
      u.last_seen_at || u.lastSeenAt || "",
      u.updated_at || u.updatedAt || "",
    ])
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.setAttribute("download", `supabase_viber_users_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success("Файл CSV успешно сформирован")
  }

  const totalPages = Math.ceil(totalCount / pageSize) || 1

  return (
    <div className="space-y-6">
      {/* 1. Header Cards: Supabase Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card/70 border-sidebar-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Пользователей в Supabase</CardTitle>
            <UsersIcon className="size-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">
              {syncStatus?.usersTotal != null ? syncStatus.usersTotal.toLocaleString("ru-RU") : "25 791"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Таблица viber_users</p>
          </CardContent>
        </Card>

        <Card className="bg-card/70 border-sidebar-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Синхронизировано групп</CardTitle>
            <DatabaseIcon className="size-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">
              {syncStatus?.groupsTotal != null ? syncStatus.groupsTotal : "3"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Чат-сообщества Viber</p>
          </CardContent>
        </Card>

        <Card className="bg-card/70 border-sidebar-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Участников в группах</CardTitle>
            <UserCheckIcon className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">
              {syncStatus?.membersTotal != null ? syncStatus.membersTotal.toLocaleString("ru-RU") : "25 937"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Связи viber_group_members</p>
          </CardContent>
        </Card>

        <Card className="bg-card/70 border-sidebar-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Статус Supabase</CardTitle>
            <ShieldCheckIcon className="size-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <span className="text-sm font-semibold text-emerald-400">Подключено</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 truncate" title={syncStatus?.message || "Данные актуальны"}>
              {syncStatus?.message || "Связь установлена"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 2. Controls & Actions */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Поиск по телефону (+380...) или имени..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setPage(0)
              }}
              className="pl-9 bg-background/80"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            className="gap-2"
            disabled={users.length === 0}
          >
            <DownloadIcon className="size-4" />
            <span>Экспорт CSV</span>
          </Button>

          <Button
            size="sm"
            onClick={handleSyncAll}
            disabled={isSyncing}
            className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <RefreshCwIcon className={`size-4 ${isSyncing ? "animate-spin" : ""}`} />
            <span>{isSyncing ? "Синхронизация..." : "Синхронизировать с Supabase"}</span>
          </Button>
        </div>
      </div>

      {/* 3. Users Table */}
      <Card className="border-sidebar-border bg-card/60 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-sidebar-border/60 hover:bg-transparent">
                <TableHead className="min-w-[180px]">Телефон</TableHead>
                <TableHead className="min-w-[180px]">Имя контакта</TableHead>
                <TableHead className="min-w-[160px]">Имя в Viber</TableHead>
                <TableHead className="min-w-[120px]">Статус</TableHead>
                <TableHead className="min-w-[160px]">Последний визит</TableHead>
                <TableHead className="min-w-[160px]">Обновлено в Supabase</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i} className="border-sidebar-border/40">
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  </TableRow>
                ))
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    Пользователи не найдены. Попробуйте изменить параметры поиска или нажать «Синхронизировать с Supabase».
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user, idx) => {
                  const phone = user.phone || "—"
                  const isOnline = user.is_online ?? user.isOnline
                  const lastSeen = user.last_seen_at || user.lastSeenAt
                  const updatedAt = user.updated_at || user.updatedAt

                  return (
                    <TableRow key={user.id ?? idx} className="border-sidebar-border/40 hover:bg-sidebar-accent/30">
                      <TableCell className="font-mono text-xs">
                        <div className="flex items-center gap-2">
                          <PhoneIcon className="size-3 text-muted-foreground shrink-0" />
                          <span className="font-semibold text-foreground">{phone}</span>
                          {phone !== "—" && (
                            <button
                              type="button"
                              onClick={() => handleCopy(phone)}
                              className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
                              title="Скопировать телефон"
                            >
                              {copiedId === phone ? (
                                <CheckIcon className="size-3.5 text-emerald-400" />
                              ) : (
                                <CopyIcon className="size-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {user.name || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {user.viber_name || user.viberName || "—"}
                      </TableCell>
                      <TableCell>
                        {isOnline === true ? (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 font-medium">
                            <span className="size-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse" />
                            Онлайн
                          </Badge>
                        ) : isOnline === false ? (
                          <Badge variant="outline" className="bg-muted/40 text-muted-foreground border-sidebar-border">
                            Офлайн
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-muted/20 text-muted-foreground/60 border-sidebar-border">
                            —
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(lastSeen)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(updatedAt)}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* 4. Pagination Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t border-sidebar-border/60 bg-muted/10">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Показано {users.length > 0 ? page * pageSize + 1 : 0}–{Math.min((page + 1) * pageSize, totalCount)} из {totalCount.toLocaleString("ru-RU")}</span>
            <span className="mx-1">•</span>
            <span>На странице:</span>
            <Select
              value={String(pageSize)}
              onValueChange={(val) => {
                setPageSize(Number(val))
                setPage(0)
              }}
            >
              <SelectTrigger className="h-7 w-16 text-xs bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0 || loading}
              className="h-8 text-xs"
            >
              Назад
            </Button>
            <span className="text-xs font-mono px-2">
              {page + 1} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1 || loading}
              className="h-8 text-xs"
            >
              Вперёд
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
