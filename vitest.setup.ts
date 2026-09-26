import "@testing-library/jest-dom/vitest"

import { cleanup } from "@testing-library/react"
import { afterEach } from "vitest"

// jsdom не реализует ResizeObserver, а ResponsiveContainer у recharts обращается к нему
// прямо в эффекте: без заглушки любой рендер графика падает.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  } as unknown as typeof ResizeObserver
}

// Без `globals: true` RTL не регистрирует auto-cleanup сам — делаем это централизованно.
afterEach(() => {
  cleanup()
})
