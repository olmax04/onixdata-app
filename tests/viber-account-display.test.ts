import { describe, expect, it } from "vitest"

import {
  formatPhoneNumber,
  formatViberAccount,
  getAuthDetail,
  type ViberAccountInfo,
} from "../lib/emulator-status"

function account(overrides: Partial<ViberAccountInfo> = {}): ViberAccountInfo {
  return {
    phoneNumber: "+380936486995",
    displayName: "Milena",
    status: "authorized",
    authorizedAt: "2026-09-15T10:00:00.000Z",
    source: "login",
    ...overrides,
  }
}

describe("formatPhoneNumber", () => {
  it("группирует номер по правилам известного кода страны", () => {
    expect(formatPhoneNumber("+380936486995")).toBe("+380 93 648 69 95")
    expect(formatPhoneNumber("+48794034881")).toBe("+48 794 034 881")
    expect(formatPhoneNumber("+79161234567")).toBe("+7 916 123 45 67")
    expect(formatPhoneNumber("+12025550147")).toBe("+1 202 555 0147")
  })

  it("группирует по три цифры, когда код страны неизвестен", () => {
    expect(formatPhoneNumber("+998901234567")).toBe("+998 901 234 567")
  })

  it("не ломается на пустом или коротком значении", () => {
    expect(formatPhoneNumber("")).toBe("")
    expect(formatPhoneNumber(null)).toBe("")
    expect(formatPhoneNumber(undefined)).toBe("")
    expect(formatPhoneNumber("+7")).toBe("+7")
  })

  it("игнорирует уже расставленные разделители", () => {
    expect(formatPhoneNumber("380 (93) 648-69-95")).toBe("+380 93 648 69 95")
  })
})

describe("formatViberAccount", () => {
  it("склеивает имя профиля и номер", () => {
    expect(formatViberAccount(account())).toBe("Milena · +380 93 648 69 95")
  })

  it("возвращает только известную часть", () => {
    expect(formatViberAccount(account({ displayName: null }))).toBe("+380 93 648 69 95")
    expect(formatViberAccount(account({ phoneNumber: "" }))).toBe("Milena")
  })

  it("возвращает пустую строку, когда данных нет", () => {
    expect(formatViberAccount(null)).toBe("")
    expect(formatViberAccount(undefined)).toBe("")
    expect(formatViberAccount(account({ displayName: null, phoneNumber: "" }))).toBe("")
  })
})

describe("getAuthDetail", () => {
  it("сообщает об отсутствии входа", () => {
    expect(getAuthDetail()).toEqual({ text: "Вход не выполнен", variant: "muted" })
    expect(getAuthDetail(null)).toEqual({ text: "Вход не выполнен", variant: "muted" })
  })

  it("показывает аккаунт после успешного входа", () => {
    expect(getAuthDetail(account())).toEqual({
      text: "Вход: Milena · +380 93 648 69 95",
      variant: "success",
    })
  })

  it("показывает ожидание кода подтверждения", () => {
    expect(getAuthDetail(account({ status: "pending", displayName: null }))).toEqual({
      text: "Ожидает код: +380 93 648 69 95",
      variant: "warning",
    })
  })
})
