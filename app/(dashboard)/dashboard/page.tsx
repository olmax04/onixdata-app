import type { Metadata } from "next"

import { SentimentBadge, StatusDot } from "@/components/dashboard/badges"
import { MentionsChart } from "@/components/dashboard/mentions-chart"
import { MetricCard } from "@/components/dashboard/metric-card"
import { Topbar } from "@/components/dashboard/topbar"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatNumber } from "@/lib/format"
import {
  metrics,
  sourceStatusLabels,
  sources,
  streamMessages,
  topKeywords,
} from "@/lib/mock-data"

export const metadata: Metadata = {
  title: "Обзор",
}

export default function OverviewPage() {
  const recent = streamMessages.slice(0, 8)

  return (
    <>
      <Topbar title="Обзор" />

      <main className="flex-1 space-y-6 p-4 sm:p-6">
        <section
          aria-label="Ключевые метрики"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          {metrics.map((metric) => (
            <MetricCard key={metric.id} metric={metric} />
          ))}
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Упоминания по часам</CardTitle>
              <CardDescription>
                Демо-данные за последние 24 часа по всем активным источникам.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MentionsChart />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Топ ключевых слов</CardTitle>
              <CardDescription>
                Частота в собранных сообщениях за сутки.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-wrap gap-2">
                {topKeywords.map((keyword) => (
                  <li key={keyword.word}>
                    <Badge
                      variant="secondary"
                      className="gap-1.5 py-1 font-normal"
                    >
                      {keyword.word}
                      <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                        {formatNumber(keyword.count)}
                      </span>
                    </Badge>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Последние сообщения</CardTitle>
              <CardDescription>
                Свежая выборка из общего потока.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[92px]">Время</TableHead>
                      <TableHead className="min-w-[160px]">Источник</TableHead>
                      <TableHead className="min-w-[120px]">Автор</TableHead>
                      <TableHead className="min-w-[280px]">Текст</TableHead>
                      <TableHead className="w-[124px]">Тональность</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recent.map((message) => (
                      <TableRow key={message.id}>
                        <TableCell className="font-mono text-xs tabular-nums text-muted-foreground">
                          {message.time}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {message.source}
                        </TableCell>
                        <TableCell className="text-sm">
                          {message.author}
                        </TableCell>
                        <TableCell className="max-w-[420px] truncate text-sm">
                          {message.text}
                        </TableCell>
                        <TableCell>
                          <SentimentBadge sentiment={message.sentiment} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Статус источников</CardTitle>
              <CardDescription>
                {sources.filter((s) => s.status === "active").length} из{" "}
                {sources.length} собирают данные прямо сейчас.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                {sources.map((source) => (
                  <li
                    key={source.id}
                    className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                  >
                    <StatusDot status={source.status} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {source.name}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {source.platform} · {source.updatedAt}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {sourceStatusLabels[source.status]}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>
      </main>
    </>
  )
}
