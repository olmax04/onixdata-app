"use client"

import { TrendingDownIcon, TrendingUpIcon } from "lucide-react"
import { Area, AreaChart, ResponsiveContainer } from "recharts"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Metric } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

export function MetricCard({ metric }: { metric: Metric }) {
  const positive = metric.delta >= 0
  const TrendIcon = positive ? TrendingUpIcon : TrendingDownIcon
  const gradientId = `spark-${metric.id}`

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {metric.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div className="space-y-1">
            <p className="text-2xl font-semibold tabular-nums tracking-tight">
              {metric.value}
            </p>
            <p
              className={cn(
                "flex items-center gap-1 text-xs font-medium",
                positive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <TrendIcon className="size-3.5" aria-hidden="true" />
              {positive ? "+" : ""}
              {metric.delta.toLocaleString("ru-RU")}%
            </p>
          </div>

          <div className="h-12 w-24 shrink-0" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={metric.spark}
                margin={{ top: 2, right: 0, bottom: 0, left: 0 }}
              >
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor="hsl(var(--chart-1))"
                      stopOpacity={0.4}
                    />
                    <stop
                      offset="100%"
                      stopColor="hsl(var(--chart-1))"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke="hsl(var(--chart-1))"
                  strokeWidth={1.5}
                  fill={`url(#${gradientId})`}
                  isAnimationActive={false}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">{metric.hint}</p>
      </CardContent>
    </Card>
  )
}
