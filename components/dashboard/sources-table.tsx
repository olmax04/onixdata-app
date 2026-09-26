"use client"

import {
  DownloadIcon,
  MoreHorizontalIcon,
  PauseIcon,
  PlayIcon,
  Trash2Icon,
} from "lucide-react"
import { toast } from "sonner"

import { StatusBadge } from "@/components/dashboard/badges"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { sources, type Source } from "@/lib/mock-data"

function RowActions({ source }: { source: Source }) {
  const notify = (action: string) =>
    toast(`${action}: ${source.name}`, {
      description: "Демо-режим: изменения не сохраняются.",
    })

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Действия для источника ${source.name}`}
        >
          <MoreHorizontalIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>Действия</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {source.status === "active" ? (
          <DropdownMenuItem onSelect={() => notify("Пауза")}>
            <PauseIcon />
            Пауза
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={() => notify("Возобновление")}>
            <PlayIcon />
            Возобновить
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => notify("Экспорт")}>
          <DownloadIcon />
          Экспорт
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onSelect={() => notify("Удаление")}
        >
          <Trash2Icon />
          Удалить
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function SourcesTable() {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[220px]">Источник</TableHead>
            <TableHead className="min-w-[110px]">Платформа</TableHead>
            <TableHead className="min-w-[160px]">Тип</TableHead>
            <TableHead className="min-w-[110px] text-right">
              Сообщений
            </TableHead>
            <TableHead className="min-w-[120px]">Обновлено</TableHead>
            <TableHead className="min-w-[120px]">Статус</TableHead>
            <TableHead className="w-[56px] text-right">
              <span className="sr-only">Действия</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sources.map((source) => (
            <TableRow key={source.id}>
              <TableCell>
                <span className="block text-sm font-medium">{source.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {source.handle}
                </span>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="font-normal">
                  {source.platform}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {source.kind}
              </TableCell>
              <TableCell className="text-right font-mono text-sm tabular-nums">
                {source.messages.toLocaleString("ru-RU")}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {source.updatedAt}
              </TableCell>
              <TableCell>
                <StatusBadge status={source.status} />
              </TableCell>
              <TableCell className="text-right">
                <RowActions source={source} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
