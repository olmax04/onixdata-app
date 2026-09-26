"use client"

import { DownloadIcon } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { datasets } from "@/lib/mock-data"

export function DatasetsTable() {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[260px]">Название</TableHead>
            <TableHead className="min-w-[200px]">Источник</TableHead>
            <TableHead className="min-w-[100px] text-right">Строк</TableHead>
            <TableHead className="min-w-[90px]">Формат</TableHead>
            <TableHead className="min-w-[120px]">Создан</TableHead>
            <TableHead className="w-[140px] text-right">
              <span className="sr-only">Действие</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {datasets.map((dataset) => (
            <TableRow key={dataset.id}>
              <TableCell>
                <span className="block text-sm font-medium">
                  {dataset.name}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {dataset.size}
                </span>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {dataset.source}
              </TableCell>
              <TableCell className="text-right font-mono text-sm tabular-nums">
                {dataset.rows.toLocaleString("ru-RU")}
              </TableCell>
              <TableCell>
                <Badge
                  variant={dataset.format === "API" ? "default" : "secondary"}
                  className="font-medium"
                >
                  {dataset.format}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {dataset.createdAt}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    toast(`Скачивание: ${dataset.name}`, {
                      description: "Демо-режим: файл не формируется.",
                    })
                  }
                >
                  <DownloadIcon />
                  Скачать
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
