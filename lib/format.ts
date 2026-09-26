/**
 * Единые форматтеры чисел. Интерфейс русский, поэтому локаль всегда "ru-RU":
 * неразрывный пробел в разрядах и запятая в дробной части.
 */

const numberFormatter = new Intl.NumberFormat("ru-RU")

/**
 * 1284903 → «1 284 903». Нечисловое значение возвращается как есть —
 * пустая и пробельная строка тоже, хотя Number() и превращает их в 0.
 */
export function formatNumber(value: number | string): string {
  if (typeof value === "string") {
    /* Number("") и Number(" ") дают 0 — пустую строку числом не считаем. */
    if (value.trim() === "") {
      return value
    }
    const numeric = Number(value)
    return Number.isFinite(numeric) ? numberFormatter.format(numeric) : value
  }

  return Number.isFinite(value) ? numberFormatter.format(value) : String(value)
}

const deltaFormatter = new Intl.NumberFormat("ru-RU", { signDisplay: "always" })

/** 12.4 → «+12,4%», -3.2 → «-3,2%». Знак ставит сам Intl. */
export function formatDelta(value: number): string {
  return `${deltaFormatter.format(value)}%`
}
