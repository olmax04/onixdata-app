"use client"

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { mentionsByHour } from "@/lib/mock-data"

const chartConfig = {
  mentions: {
    label: "Упоминания",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig

export function MentionsChart() {
  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-[280px] w-full">
      <AreaChart
        data={mentionsByHour}
        margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
      >
        <defs>
          <linearGradient id="fillMentions" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="5%"
              stopColor="var(--color-mentions)"
              stopOpacity={0.35}
            />
            <stop
              offset="95%"
              stopColor="var(--color-mentions)"
              stopOpacity={0.02}
            />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="hour"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
        />
        <YAxis tickLine={false} axisLine={false} tickMargin={8} width={44} />
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent indicator="line" />}
        />
        <Area
          dataKey="mentions"
          type="monotone"
          stroke="var(--color-mentions)"
          strokeWidth={2}
          fill="url(#fillMentions)"
        />
      </AreaChart>
    </ChartContainer>
  )
}
