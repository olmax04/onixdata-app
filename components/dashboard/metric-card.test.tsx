import * as React from "react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

/*
 * Спарклайн декоративный (aria-hidden), а измерить контейнер jsdom не умеет —
 * настоящий ResponsiveContainer только сыпал бы предупреждениями о нулевом размере.
 */
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children?: React.ReactNode }) =>
    children ?? null,
  AreaChart: () => null,
  Area: () => null,
}))

import { MetricCard } from "@/components/dashboard/metric-card"
import { metrics, type Metric } from "@/lib/mock-data"

const makeMetric = (overrides: Partial<Metric> = {}): Metric => ({
  id: "mentions",
  title: "Упоминания за 24 ч",
  value: 18402,
  delta: 12.4,
  hint: "вчера за тот же период — 16 370",
  spark: [
    { i: 0, v: 420 },
    { i: 1, v: 465 },
  ],
  ...overrides,
})

/* Сравниваем текст как есть: нормализатор RTL по умолчанию съедает неразрывный пробел. */
const asIs = { normalizer: (value: string) => value }
const NBSP = " "

describe("MetricCard", () => {
  it("разделяет разряды неразрывным пробелом", () => {
    render(<MetricCard metric={makeMetric({ value: 1284903 })} />)

    expect(
      screen.getByText(`1${NBSP}284${NBSP}903`, asIs)
    ).toBeInTheDocument()
    expect(screen.queryByText("1 284 903", asIs)).toBeNull()
  })

  it("короткое число оставляет без разделителей", () => {
    render(<MetricCard metric={makeMetric({ id: "sources", value: 42 })} />)

    expect(screen.getByText("42", asIs)).toBeInTheDocument()
  })

  it("показывает дельту со знаком и подсказку", () => {
    render(<MetricCard metric={makeMetric()} />)

    expect(screen.getByText("+12,4%", asIs)).toBeInTheDocument()
    expect(
      screen.getByText("вчера за тот же период — 16 370")
    ).toBeInTheDocument()
  })

  it("падение показывает с минусом", () => {
    render(<MetricCard metric={makeMetric({ id: "speed", delta: -3.2 })} />)

    expect(screen.getByText("-3,2%", asIs)).toBeInTheDocument()
  })

  it("форматирует значения из мок-данных, а не хранит их строками", () => {
    for (const metric of metrics) {
      expect(typeof metric.value).toBe("number")
    }

    const collected = metrics.find((metric) => metric.id === "collected")
    expect(collected).toBeDefined()

    render(<MetricCard metric={collected as Metric} />)

    expect(
      screen.getByText(`1${NBSP}284${NBSP}903`, asIs)
    ).toBeInTheDocument()
  })
})
