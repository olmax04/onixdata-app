import { describe, expect, it } from "vitest"

import { formatDelta, formatNumber } from "@/lib/format"

/** Разделитель разрядов в ru-RU — неразрывный пробел; сверяем без привязки к коду символа. */
const normalize = (value: string) => value.replace(/\s/g, " ")

describe("formatNumber", () => {
  it("разбивает разряды по-русски", () => {
    expect(normalize(formatNumber(1284903))).toBe("1 284 903")
    expect(normalize(formatNumber(1640))).toBe("1 640")
  })

  it("не трогает короткие числа", () => {
    expect(formatNumber(42)).toBe("42")
    expect(formatNumber(0)).toBe("0")
  })

  it("использует запятую в дробной части", () => {
    expect(formatNumber(12.4)).toBe("12,4")
  })

  it("принимает числовые строки и возвращает нечисловые как есть", () => {
    expect(normalize(formatNumber("1640"))).toBe("1 640")
    expect(formatNumber("н/д")).toBe("н/д")
  })

  it("не превращает пустую и пробельную строку в ноль", () => {
    expect(formatNumber("")).toBe("")
    expect(formatNumber("  ")).toBe("  ")
    expect(formatNumber("\n\t")).toBe("\n\t")
  })

  it("возвращает как есть нечисловые значения-числа", () => {
    expect(formatNumber(Number.NaN)).toBe("NaN")
    expect(formatNumber(Number.POSITIVE_INFINITY)).toBe("Infinity")
  })
})

describe("formatDelta", () => {
  it("ставит плюс у роста", () => {
    expect(normalize(formatDelta(12.4))).toBe("+12,4%")
    expect(normalize(formatDelta(0))).toBe("+0%")
  })

  it("ставит минус у падения", () => {
    expect(normalize(formatDelta(-3.2))).toBe("-3,2%")
  })
})
