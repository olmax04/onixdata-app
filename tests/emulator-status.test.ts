import { describe, expect, it } from "vitest"
import {
  getAdbDetail,
  getAndroidDetail,
  getAuthDetail,
  getEmulatorStatus,
  getViberDetail,
  translateSetupStage,
  type EmulatorItem,
} from "../lib/emulator-status"

function createMockEmulator(overrides: Partial<EmulatorItem> = {}): EmulatorItem {
  return {
    id: "emu-test-1",
    name: "test-worker",
    containerName: "viber-emu-test-worker",
    status: "Up 5 minutes",
    state: "running",
    created: 1726000000,
    adbPort: 5555,
    adbSerial: "127.0.0.1:5555",
    scrcpyUrl: "http://127.0.0.1:8000/?serial=test-worker",
    bootCompleted: true,
    viberRunning: false,
    adbOnline: true,
    setupStatus: null,
    ...overrides,
  }
}

describe("translateSetupStage", () => {
  it("переводит известные этапы настройки", () => {
    expect(translateSetupStage("First boot")).toBe("Первый запуск")
    expect(translateSetupStage("Google services")).toBe("Установка Google-сервисов")
    expect(translateSetupStage("Google Play Services")).toBe("Установка Google-сервисов")
    expect(translateSetupStage("Device profile")).toBe("Настройка профиля устройства")
    expect(translateSetupStage("Root isolation")).toBe("Настройка изоляции root")
    expect(translateSetupStage("Root hide")).toBe("Настройка изоляции root")
    expect(translateSetupStage("Final cleanup")).toBe("Очистка временных файлов")
    expect(translateSetupStage("Final ADB check")).toBe("Проверка подключения ADB")
    expect(translateSetupStage("Complete")).toBe("Настройка завершена")
    expect(translateSetupStage("Audit")).toBe("Проверка системы")
  })

  it("корректно обрабатывает повторные этапы 'Prepare after ...'", () => {
    expect(translateSetupStage("Prepare after First boot")).toBe("Подготовка после: Первый запуск")
    expect(translateSetupStage("Prepare after Device profile")).toBe(
      "Подготовка после: Настройка профиля устройства"
    )
  })

  it("возвращает исходный текст для неизвестного этапа", () => {
    expect(translateSetupStage("Custom Kernel Patch")).toBe("Custom Kernel Patch")
  })

  it("обрабатывает пустые и отсутствующие значения", () => {
    expect(translateSetupStage(null)).toBe("")
    expect(translateSetupStage(undefined)).toBe("")
    expect(translateSetupStage("   ")).toBe("")
  })
})

describe("getEmulatorStatus - приоритеты и правила", () => {
  it("контейнер dead -> container_error с кнопкой открытия логов", () => {
    const emu = createMockEmulator({ state: "dead" })
    const status = getEmulatorStatus(emu)
    expect(status.id).toBe("container_error")
    expect(status.label).toBe("Ошибка контейнера")
    expect(status.tone).toBe("danger")
    expect(status.action).toBe("open_logs")
    expect(status.busy).toBe(false)
  })

  it("контейнер removing -> container_error с надписью Удаление и признаком busy", () => {
    const emu = createMockEmulator({ state: "removing" })
    const status = getEmulatorStatus(emu)
    expect(status.id).toBe("container_error")
    expect(status.label).toBe("Удаление")
    expect(status.busy).toBe(true)
    expect(status.action).toBeNull()
  })

  it("контейнер paused -> paused без предложения запуска", () => {
    const emu = createMockEmulator({ state: "paused" })
    const status = getEmulatorStatus(emu)
    expect(status.id).toBe("paused")
    expect(status.label).toBe("Приостановлен")
    expect(status.tone).toBe("neutral")
    expect(status.action).toBeNull()
    expect(status.busy).toBe(false)
  })

  it("контейнер exited -> stopped с кнопкой Запустить", () => {
    const emu = createMockEmulator({ state: "exited" })
    const status = getEmulatorStatus(emu)
    expect(status.id).toBe("stopped")
    expect(status.label).toBe("Остановлен")
    expect(status.tone).toBe("neutral")
    expect(status.action).toBe("start")
    expect(status.busy).toBe(false)
  })

  it("остановленный инстанс с прошлым setupStatus=ready всё равно имеет статус stopped", () => {
    const emu = createMockEmulator({
      state: "exited",
      setupStatus: {
        state: "ready",
        stage: "Complete",
        updatedAt: "2026-09-13T00:00:00Z",
        exitCode: 0,
      },
    })
    const status = getEmulatorStatus(emu)
    expect(status.id).toBe("stopped")
    expect(status.label).toBe("Остановлен")
  })

  it("контейнер created или restarting -> starting", () => {
    for (const state of ["created", "restarting"]) {
      const emu = createMockEmulator({ state })
      const status = getEmulatorStatus(emu)
      expect(status.id).toBe("starting")
      expect(status.label).toBe("Запуск эмулятора")
      expect(status.busy).toBe(true)
    }
  })

  it("неизвестное состояние контейнера -> unknown 'Статус неизвестен'", () => {
    const emu = createMockEmulator({ state: "unrecognized_state" })
    const status = getEmulatorStatus(emu)
    expect(status.id).toBe("unknown")
    expect(status.label).toBe("Статус неизвестен")
    expect(status.tone).toBe("neutral")
  })

  it("сбой настройки (failed) имеет приоритет над временной недоступностью ADB", () => {
    const emu = createMockEmulator({
      state: "running",
      adbOnline: false,
      setupStatus: {
        state: "failed",
        stage: "Root hide",
        updatedAt: "2026-09-13T00:00:00Z",
        exitCode: 1,
      },
    })
    const status = getEmulatorStatus(emu)
    expect(status.id).toBe("setup_failed")
    expect(status.label).toBe("Ошибка настройки")
    expect(status.tone).toBe("danger")
    expect(status.stageLabel).toBe("Настройка изоляции root")
    expect(status.description).toContain("Настройка изоляции root")
    expect(status.description).toContain("код 1")
    expect(status.action).toBe("open_logs")
    expect(status.busy).toBe(false)
  })

  it("настройка в процессе (running) с временным offline ADB показывает пояснение о возможном переподключении", () => {
    const emu = createMockEmulator({
      state: "running",
      adbOnline: false,
      setupStatus: {
        state: "running",
        stage: "First boot",
        updatedAt: "2026-09-13T00:00:00Z",
        exitCode: 0,
      },
    })
    const status = getEmulatorStatus(emu)
    expect(status.id).toBe("setting_up")
    expect(status.label).toBe("Настройка инстанса")
    expect(status.tone).toBe("info")
    expect(status.busy).toBe(true)
    expect(status.description).toBe(
      "ADB временно недоступен; возможно переподключение после перезагрузки"
    )
  })

  it("настройка в процессе (running) с доступным ADB показывает текущий этап", () => {
    const emu = createMockEmulator({
      state: "running",
      adbOnline: true,
      setupStatus: {
        state: "running",
        stage: "Device profile",
        updatedAt: "2026-09-13T00:00:00Z",
        exitCode: 0,
      },
    })
    const status = getEmulatorStatus(emu)
    expect(status.id).toBe("setting_up")
    expect(status.label).toBe("Настройка инстанса")
    expect(status.tone).toBe("info")
    expect(status.description).toBe("Выполняется этап: Настройка профиля устройства")
    expect(status.busy).toBe(true)
  })

  it("настройка не идёт, adbOnline === false -> adb_offline с кнопкой логов", () => {
    const emu = createMockEmulator({
      state: "running",
      adbOnline: false,
      setupStatus: null,
    })
    const status = getEmulatorStatus(emu)
    expect(status.id).toBe("adb_offline")
    expect(status.label).toBe("Нет подключения ADB")
    expect(status.tone).toBe("warning")
    expect(status.action).toBe("open_logs")
    expect(status.busy).toBe(false)
  })

  it("ready не перекрывает текущую недоступность ADB", () => {
    const emu = createMockEmulator({
      state: "running",
      adbOnline: false,
      setupStatus: {
        state: "ready",
        stage: "Complete",
        updatedAt: "2026-09-13T00:00:00Z",
        exitCode: 0,
      },
    })
    const status = getEmulatorStatus(emu)
    expect(status.id).toBe("adb_offline")
    expect(status.label).toBe("Нет подключения ADB")
  })

  it("adbOnline не задан (null/undefined) -> Проверка подключения", () => {
    const emu = createMockEmulator({
      state: "running",
      adbOnline: undefined,
      setupStatus: null,
    })
    const status = getEmulatorStatus(emu)
    expect(status.id).toBe("unknown")
    expect(status.label).toBe("Проверка подключения")
    expect(status.tone).toBe("neutral")
    expect(status.busy).toBe(true)
  })

  it("ADB доступен, bootCompleted === false -> Загрузка Android", () => {
    const emu = createMockEmulator({
      state: "running",
      adbOnline: true,
      bootCompleted: false,
      setupStatus: null,
    })
    const status = getEmulatorStatus(emu)
    expect(status.id).toBe("booting")
    expect(status.label).toBe("Загрузка Android")
    expect(status.tone).toBe("info")
    expect(status.busy).toBe(true)
  })

  it("ready не перекрывает незавершённую загрузку Android", () => {
    const emu = createMockEmulator({
      state: "running",
      adbOnline: true,
      bootCompleted: false,
      setupStatus: {
        state: "ready",
        stage: "Complete",
        updatedAt: "2026-09-13T00:00:00Z",
        exitCode: 0,
      },
    })
    const status = getEmulatorStatus(emu)
    expect(status.id).toBe("booting")
    expect(status.label).toBe("Загрузка Android")
  })

  it("ADB доступен, bootCompleted не задан -> Проверка Android", () => {
    const emu = createMockEmulator({
      state: "running",
      adbOnline: true,
      bootCompleted: undefined,
      setupStatus: null,
    })
    const status = getEmulatorStatus(emu)
    expect(status.id).toBe("unknown")
    expect(status.label).toBe("Проверка Android")
    expect(status.tone).toBe("neutral")
    expect(status.busy).toBe(true)
  })

  it("ADB доступен, Android загружен, setupStatus=ready -> setup_complete", () => {
    const emu = createMockEmulator({
      state: "running",
      adbOnline: true,
      bootCompleted: true,
      setupStatus: {
        state: "ready",
        stage: "Complete",
        updatedAt: "2026-09-13T00:00:00Z",
        exitCode: 0,
      },
    })
    const status = getEmulatorStatus(emu)
    expect(status.id).toBe("setup_complete")
    expect(status.label).toBe("Настройка завершена")
    expect(status.description).toBe(
      "Настройка завершена. Проверьте вход в Viber на экране"
    )
    expect(status.tone).toBe("success")
    expect(status.busy).toBe(false)
    expect(status.action).toBe("open_screen")
  })

  it("ADB доступен, Android загружен, результата настройки нет -> android_ready", () => {
    const emu = createMockEmulator({
      state: "running",
      adbOnline: true,
      bootCompleted: true,
      setupStatus: null,
    })
    const status = getEmulatorStatus(emu)
    expect(status.id).toBe("android_ready")
    expect(status.label).toBe("Android загружен")
    expect(status.tone).toBe("info")
    expect(status.busy).toBe(false)
  })
})

describe("Вспомогательные признаки (ADB, Android, Viber, Авторизация)", () => {
  it("getAdbDetail корректно возвращает состояния", () => {
    expect(getAdbDetail(true)).toEqual({ text: "подключён", variant: "success" })
    expect(getAdbDetail(false)).toEqual({ text: "недоступен", variant: "danger" })
    expect(getAdbDetail(undefined)).toEqual({ text: "неизвестно", variant: "muted" })
    expect(getAdbDetail(null)).toEqual({ text: "неизвестно", variant: "muted" })
  })

  it("getAndroidDetail корректно возвращает состояния", () => {
    expect(getAndroidDetail(true)).toEqual({ text: "загружен", variant: "success" })
    expect(getAndroidDetail(false)).toEqual({ text: "загружается", variant: "warning" })
    expect(getAndroidDetail(undefined)).toEqual({ text: "неизвестно", variant: "muted" })
    expect(getAndroidDetail(null)).toEqual({ text: "неизвестно", variant: "muted" })
  })

  it("getViberDetail корректно возвращает состояния", () => {
    expect(getViberDetail(true)).toEqual({ text: "запущен", variant: "success" })
    expect(getViberDetail(false)).toEqual({ text: "не запущен", variant: "warning" })
    expect(getViberDetail(undefined)).toEqual({ text: "неизвестно", variant: "muted" })
    expect(getViberDetail(null)).toEqual({ text: "неизвестно", variant: "muted" })
  })

  it("getAuthDetail без аккаунта сообщает, что вход не выполнен", () => {
    expect(getAuthDetail()).toEqual({ text: "Вход не выполнен", variant: "muted" })
  })
})
