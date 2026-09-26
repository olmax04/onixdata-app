import { describe, expect, it } from "vitest"

import {
  QR_POLL_INTERVAL_MS,
  describeQrStatus,
  isQrSessionLive,
  qrImageSource,
  type QrAuthStatus,
} from "@/lib/viber-qr"

describe("describeQrStatus", () => {
  it("names every state the API can report, in Russian", () => {
    const states: QrAuthStatus["state"][] = [
      "idle",
      "starting",
      "qr_ready",
      "scanned",
      "finishing",
      "ready",
      "error",
      "unknown_screen",
    ]
    for (const state of states) {
      const described = describeQrStatus({ state })
      expect(described.label.length).toBeGreaterThan(0)
      expect(described.label).toMatch(/[А-Яа-яЁё]/)
    }
  })

  it("distinguishes waiting for a scan from the work that follows it", () => {
    expect(describeQrStatus({ state: "qr_ready" }).label).toMatch(/скан/i)
    expect(describeQrStatus({ state: "scanned" }).label).toMatch(/подтвержда/i)
    expect(describeQrStatus({ state: "finishing" }).label).toMatch(/настраива|заверша/i)
    expect(describeQrStatus({ state: "ready" }).label).toMatch(/готов/i)
  })

  it("shows the server's own error text when there is one", () => {
    expect(describeQrStatus({ state: "error", error: "Устройство занято" }).label).toBe(
      "Устройство занято",
    )
    expect(describeQrStatus({ state: "error" }).label).toMatch(/ошибк/i)
  })

  it("marks only the finished states as done, and only failures as failures", () => {
    expect(describeQrStatus({ state: "ready" }).tone).toBe("success")
    expect(describeQrStatus({ state: "error" }).tone).toBe("danger")
    expect(describeQrStatus({ state: "unknown_screen" }).tone).toBe("warning")
    expect(describeQrStatus({ state: "qr_ready" }).tone).toBe("info")
  })

  it("says whether the dashboard should still show a spinner", () => {
    expect(describeQrStatus({ state: "starting" }).busy).toBe(true)
    expect(describeQrStatus({ state: "scanned" }).busy).toBe(true)
    expect(describeQrStatus({ state: "finishing" }).busy).toBe(true)
    expect(describeQrStatus({ state: "qr_ready" }).busy).toBe(false)
    expect(describeQrStatus({ state: "ready" }).busy).toBe(false)
    expect(describeQrStatus({ state: "error" }).busy).toBe(false)
  })
})

describe("isQrSessionLive", () => {
  it("keeps polling until the session has finished one way or the other", () => {
    expect(isQrSessionLive("starting")).toBe(true)
    expect(isQrSessionLive("qr_ready")).toBe(true)
    expect(isQrSessionLive("scanned")).toBe(true)
    expect(isQrSessionLive("finishing")).toBe(true)
    expect(isQrSessionLive("unknown_screen")).toBe(true)
    expect(isQrSessionLive("ready")).toBe(false)
    expect(isQrSessionLive("error")).toBe(false)
    expect(isQrSessionLive("idle")).toBe(false)
  })
})

describe("qrImageSource", () => {
  it("prefers the vector code, which stays crisp at any size", () => {
    const source = qrImageSource({ svg: "<svg/>", pngBase64: "AAA", capturedAt: "now" })
    expect(source).toEqual({ kind: "svg", markup: "<svg/>" })
  })

  it("falls back to the cropped screenshot when nothing could be decoded", () => {
    const source = qrImageSource({ pngBase64: "AAA", capturedAt: "now" })
    expect(source).toEqual({ kind: "png", src: "data:image/png;base64,AAA" })
  })

  it("has nothing to show when there is no code at all", () => {
    expect(qrImageSource(undefined)).toBeNull()
    expect(qrImageSource({ capturedAt: "now" })).toBeNull()
  })
})

describe("QR_POLL_INTERVAL_MS", () => {
  it("is fast enough to notice a scan without hammering the device", () => {
    expect(QR_POLL_INTERVAL_MS).toBe(2000)
  })
})
