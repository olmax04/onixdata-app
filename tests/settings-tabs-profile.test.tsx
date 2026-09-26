// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const refreshMock = vi.fn()

vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({
    user: { id: "user-1", email: "maxim@onixdata.io" },
    profile: {
      name: "Максим Орлов",
      email: "maxim@onixdata.io",
      initials: "МО",
      role: "Владелец рабочей области",
    },
    isLoading: false,
    refresh: refreshMock,
    signOut: vi.fn(),
  }),
}))

const maybeSingleMock = vi.fn(async () => ({ data: { id: "user-1" }, error: null }))
const selectMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }))
const eqMock = vi.fn(() => ({ select: selectMock }))
const updateMock = vi.fn(() => ({ eq: eqMock }))
const fromMock = vi.fn(() => ({ update: updateMock }))
const updateUserMock = vi.fn(async () => ({ data: {}, error: null }))
const signInWithPasswordMock = vi.fn(async () => ({ data: {}, error: null }))

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: fromMock,
    auth: {
      updateUser: updateUserMock,
      signInWithPassword: signInWithPasswordMock,
    },
  }),
}))

vi.mock("@/lib/supabase/config", () => ({
  isSupabaseConfigured: () => true,
}))

const toastSuccess = vi.fn()
const toastError = vi.fn()
const toastInfo = vi.fn()
const toastWarning = vi.fn()

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
    info: (...args: unknown[]) => toastInfo(...args),
    warning: (...args: unknown[]) => toastWarning(...args),
  },
}))

import { SettingsTabs } from "@/components/dashboard/settings-tabs"

function setValue(label: RegExp | string, value: string) {
  const input = screen.getByLabelText(label)
  fireEvent.change(input, { target: { value } })
  return input as HTMLInputElement
}

describe("SettingsTabs · вкладка «Профиль»", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it("подставляет имя и email текущего пользователя", () => {
    render(<SettingsTabs />)

    expect((screen.getByLabelText("Имя") as HTMLInputElement).value).toBe(
      "Максим Орлов"
    )
    expect((screen.getByLabelText("Email") as HTMLInputElement).value).toBe(
      "maxim@onixdata.io"
    )
  })

  it("сохраняет имя сначала в user_metadata, затем в public.profiles", async () => {
    render(<SettingsTabs />)

    setValue("Имя", "Максим Алесеюк")
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }))

    await waitFor(() => {
      expect(fromMock).toHaveBeenCalledWith("profiles")
    })

    expect(updateUserMock).toHaveBeenCalledWith({
      data: { full_name: "Максим Алесеюк" },
    })
    expect(updateMock).toHaveBeenCalledWith({ full_name: "Максим Алесеюк" })
    expect(eqMock).toHaveBeenCalledWith("id", "user-1")
    expect(selectMock).toHaveBeenCalledWith("id")
    expect(
      (updateUserMock as unknown as { mock: { invocationCallOrder: number[] } })
        .mock.invocationCallOrder[0]
    ).toBeLessThan(fromMock.mock.invocationCallOrder[0] as number)
    expect(refreshMock).toHaveBeenCalled()
    expect(toastSuccess).toHaveBeenCalled()
  })

  it("не пишет в public.profiles, если учётная запись не обновилась", async () => {
    updateUserMock.mockResolvedValueOnce({
      data: {},
      error: { message: "Auth session missing" },
    } as never)

    render(<SettingsTabs />)

    setValue("Имя", "Максим Алесеюк")
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }))

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        "Не удалось сохранить имя",
        expect.anything()
      )
    })

    expect(fromMock).not.toHaveBeenCalled()
    expect(toastSuccess).not.toHaveBeenCalled()
  })

  it("сообщает о частичном сохранении, если строка профиля не обновилась", async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: null } as never)

    render(<SettingsTabs />)

    setValue("Имя", "Максим Алесеюк")
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }))

    await waitFor(() => {
      expect(toastWarning).toHaveBeenCalledWith(
        "Профиль сохранён частично",
        expect.anything()
      )
    })

    expect(toastSuccess).not.toHaveBeenCalled()
    expect(refreshMock).toHaveBeenCalled()
  })

  it("не трогает Supabase, когда изменений нет", async () => {
    render(<SettingsTabs />)

    setValue("Имя", "Максим Орлов ")
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }))

    await waitFor(() => {
      expect(toastInfo).toHaveBeenCalledWith(
        "Изменений нет",
        expect.anything()
      )
    })

    expect(fromMock).not.toHaveBeenCalled()
    expect(updateUserMock).not.toHaveBeenCalled()
  })

  it("меняет email только через auth и не пишет его в public.profiles", async () => {
    render(<SettingsTabs />)

    setValue("Email", "new@onixdata.io")
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }))

    await waitFor(() => {
      expect(updateUserMock).toHaveBeenCalledWith({ email: "new@onixdata.io" })
    })

    expect(fromMock).not.toHaveBeenCalled()
  })
})

describe("SettingsTabs · карточка «Смена пароля»", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it("переподтверждает текущий пароль перед обновлением", async () => {
    render(<SettingsTabs />)

    setValue("Текущий пароль", "old-password")
    setValue("Новый пароль", "new-password")
    setValue("Повторите новый пароль", "new-password")
    fireEvent.click(screen.getByRole("button", { name: "Сменить пароль" }))

    await waitFor(() => {
      expect(signInWithPasswordMock).toHaveBeenCalledWith({
        email: "maxim@onixdata.io",
        password: "old-password",
      })
    })

    expect(updateUserMock).toHaveBeenCalledWith({ password: "new-password" })
    expect(toastSuccess).toHaveBeenCalledWith("Пароль обновлён")
  })

  it("сообщает о неверном текущем пароле и не меняет пароль", async () => {
    signInWithPasswordMock.mockResolvedValueOnce({
      data: {},
      error: { message: "Invalid login credentials" },
    } as never)

    render(<SettingsTabs />)

    setValue("Текущий пароль", "wrong-password")
    setValue("Новый пароль", "new-password")
    setValue("Повторите новый пароль", "new-password")
    fireEvent.click(screen.getByRole("button", { name: "Сменить пароль" }))

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("Текущий пароль неверный")
    })

    expect(updateUserMock).not.toHaveBeenCalled()
    expect(await screen.findByText("Текущий пароль неверный")).toBeDefined()
  })
})
