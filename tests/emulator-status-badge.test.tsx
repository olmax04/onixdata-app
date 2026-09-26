// @vitest-environment jsdom
import * as React from "react"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { EmulatorStatusBadge } from "../components/dashboard/emulator-status-badge"
import type { EmulatorStatusView } from "../lib/emulator-status"

describe("EmulatorStatusBadge", () => {
  afterEach(cleanup)

  it("рендерит успешный статус с надписью 'Настройка завершена'", () => {
    const status: EmulatorStatusView = {
      id: "setup_complete",
      label: "Настройка завершена",
      description: "Настройка завершена. Проверьте вход в Viber на экране",
      tone: "success",
      stageLabel: "Настройка завершена",
      busy: false,
      action: "open_screen",
    }

    render(<EmulatorStatusBadge status={status} />)
    const badge = screen.getByText("Настройка завершена")
    expect(badge).toBeDefined()
    expect(badge.closest("div")?.getAttribute("title")).toBe(
      "Настройка завершена. Проверьте вход в Viber на экране"
    )
    expect(screen.queryByTestId("status-busy-indicator")).toBeNull()
  })

  it("помечает старый зелёный бейдж как устаревший при isStale", () => {
    const status: EmulatorStatusView = {
      id: "setup_complete",
      label: "Настройка завершена",
      description: "Настройка завершена. Проверьте вход в Viber на экране",
      tone: "success",
      stageLabel: "Настройка завершена",
      busy: false,
      action: "open_screen",
    }

    render(<EmulatorStatusBadge status={status} isStale={true} />)
    expect(screen.getByText("Настройка завершена (устарело)")).toBeDefined()
  })

  it("рендерит индикатор busy при активной операции", () => {
    const status: EmulatorStatusView = {
      id: "setting_up",
      label: "Настройка инстанса",
      description: "Выполняется этап: Первый запуск",
      tone: "info",
      stageLabel: "Первый запуск",
      busy: true,
      action: null,
    }

    render(<EmulatorStatusBadge status={status} />)
    expect(screen.getByText("Настройка инстанса")).toBeDefined()
    expect(screen.getByTestId("status-busy-indicator")).toBeDefined()
  })

  it("рендерит статус ошибки (danger)", () => {
    const status: EmulatorStatusView = {
      id: "setup_failed",
      label: "Ошибка настройки",
      description: "Сбой на этапе «Настройка изоляции root» (код 1)",
      tone: "danger",
      stageLabel: "Настройка изоляции root",
      busy: false,
      action: "open_logs",
    }

    render(<EmulatorStatusBadge status={status} />)
    expect(screen.getByText("Ошибка настройки")).toBeDefined()
  })

  it("рендерит предупреждение (warning)", () => {
    const status: EmulatorStatusView = {
      id: "adb_offline",
      label: "Нет подключения ADB",
      description: "Инстанс запущен, но соединение с ADB не установлено",
      tone: "warning",
      stageLabel: null,
      busy: false,
      action: "open_logs",
    }

    render(<EmulatorStatusBadge status={status} />)
    expect(screen.getByText("Нет подключения ADB")).toBeDefined()
  })

  it("рендерит нейтральный статус (neutral)", () => {
    const status: EmulatorStatusView = {
      id: "stopped",
      label: "Остановлен",
      description: "Инстанс остановлен",
      tone: "neutral",
      stageLabel: null,
      busy: false,
      action: "start",
    }

    render(<EmulatorStatusBadge status={status} />)
    expect(screen.getByText("Остановлен")).toBeDefined()
  })
})
