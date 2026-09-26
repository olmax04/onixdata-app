import { describe, expect, it } from "vitest"
import {
  buildProfileSaveToast,
  buildProfileUpdate,
  passwordSchema,
  profileSchema,
  resolveProfileName,
} from "../lib/settings/profile-form"

describe("profileSchema", () => {
  it("принимает корректные имя и email", () => {
    const result = profileSchema.safeParse({
      name: "Максим Орлов",
      email: "maxim@onixdata.io",
    })

    expect(result.success).toBe(true)
  })

  it("отклоняет слишком короткое имя", () => {
    const result = profileSchema.safeParse({ name: "М", email: "a@b.io" })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["name"])
    }
  })

  it("отклоняет некорректный email", () => {
    const result = profileSchema.safeParse({ name: "Максим", email: "не-email" })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["email"])
    }
  })

  it("отсекает пробелы по краям", () => {
    const result = profileSchema.safeParse({
      name: "  Максим Орлов  ",
      email: "  maxim@onixdata.io ",
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe("Максим Орлов")
      expect(result.data.email).toBe("maxim@onixdata.io")
    }
  })
})

describe("passwordSchema", () => {
  const valid = {
    currentPassword: "old-password",
    newPassword: "new-password",
    confirmPassword: "new-password",
  }

  it("принимает корректный набор паролей", () => {
    expect(passwordSchema.safeParse(valid).success).toBe(true)
  })

  it("требует текущий пароль", () => {
    const result = passwordSchema.safeParse({ ...valid, currentPassword: "" })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["currentPassword"])
    }
  })

  it("требует минимум 8 символов в новом пароле", () => {
    const result = passwordSchema.safeParse({
      ...valid,
      newPassword: "short",
      confirmPassword: "short",
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(
        result.error.issues.some((issue) => issue.path[0] === "newPassword")
      ).toBe(true)
    }
  })

  it("требует совпадения нового пароля и подтверждения", () => {
    const result = passwordSchema.safeParse({
      ...valid,
      confirmPassword: "another-password",
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(
        result.error.issues.some((issue) => issue.path[0] === "confirmPassword")
      ).toBe(true)
    }
  })

  it("требует, чтобы новый пароль отличался от текущего", () => {
    const result = passwordSchema.safeParse({
      currentPassword: "same-password",
      newPassword: "same-password",
      confirmPassword: "same-password",
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(
        result.error.issues.some((issue) => issue.path[0] === "newPassword")
      ).toBe(true)
    }
  })
})

describe("buildProfileUpdate", () => {
  const current = { name: "Максим Орлов", email: "maxim@onixdata.io" }

  it("не находит изменений, если значения совпадают", () => {
    const plan = buildProfileUpdate(current, {
      name: "Максим Орлов",
      email: "maxim@onixdata.io",
    })

    expect(plan).toEqual({
      nameChanged: false,
      emailChanged: false,
      hasChanges: false,
      fullName: "Максим Орлов",
      email: "maxim@onixdata.io",
    })
  })

  it("отмечает изменение имени", () => {
    const plan = buildProfileUpdate(current, {
      name: "  Максим Алесеюк  ",
      email: "maxim@onixdata.io",
    })

    expect(plan.nameChanged).toBe(true)
    expect(plan.emailChanged).toBe(false)
    expect(plan.hasChanges).toBe(true)
    expect(plan.fullName).toBe("Максим Алесеюк")
  })

  it("отмечает изменение email и нормализует его", () => {
    const plan = buildProfileUpdate(current, {
      name: "Максим Орлов",
      email: "  NEW@onixdata.IO ",
    })

    expect(plan.emailChanged).toBe(true)
    expect(plan.nameChanged).toBe(false)
    expect(plan.email).toBe("new@onixdata.io")
  })

  it("игнорирует регистр и пробелы при сравнении email", () => {
    const plan = buildProfileUpdate(current, {
      name: "Максим Орлов",
      email: " Maxim@OnixData.io ",
    })

    expect(plan.emailChanged).toBe(false)
    expect(plan.hasChanges).toBe(false)
  })

  it("работает, когда текущие значения пустые", () => {
    const plan = buildProfileUpdate(
      { name: "", email: "" },
      { name: "Новое имя", email: "user@onixdata.io" }
    )

    expect(plan).toMatchObject({
      nameChanged: true,
      emailChanged: true,
      hasChanges: true,
      fullName: "Новое имя",
      email: "user@onixdata.io",
    })
  })
})

describe("buildProfileSaveToast", () => {
  it("сообщает об отсутствии изменений", () => {
    const toast = buildProfileSaveToast({
      nameChanged: false,
      emailChanged: false,
      hasChanges: false,
      fullName: "Максим",
      email: "maxim@onixdata.io",
    })

    expect(toast.variant).toBe("info")
    expect(toast.title).toBe("Изменений нет")
  })

  it("сообщает о сохранении имени", () => {
    const toast = buildProfileSaveToast({
      nameChanged: true,
      emailChanged: false,
      hasChanges: true,
      fullName: "Максим",
      email: "maxim@onixdata.io",
    })

    expect(toast.variant).toBe("success")
    expect(toast.title).toBe("Профиль сохранён")
    expect(toast.description ?? "").not.toContain("подтверж")
  })

  it("предупреждает о письме подтверждения при смене email", () => {
    const toast = buildProfileSaveToast({
      nameChanged: true,
      emailChanged: true,
      hasChanges: true,
      fullName: "Максим",
      email: "new@onixdata.io",
    })

    expect(toast.variant).toBe("success")
    expect(toast.description).toContain("new@onixdata.io")
    expect(toast.description).toContain("подтверж")
  })
})

describe("resolveProfileName", () => {
  it("предпочитает full_name из public.profiles", () => {
    expect(
      resolveProfileName({
        profileFullName: "Из профиля",
        metadataFullName: "Из метаданных",
        email: "maxim@onixdata.io",
      })
    ).toBe("Из профиля")
  })

  it("падает на full_name из метаданных", () => {
    expect(
      resolveProfileName({
        profileFullName: "   ",
        metadataFullName: "Из метаданных",
        metadataName: "Имя",
        email: "maxim@onixdata.io",
      })
    ).toBe("Из метаданных")
  })

  it("падает на name из метаданных", () => {
    expect(
      resolveProfileName({
        profileFullName: null,
        metadataFullName: null,
        metadataName: "Имя",
        email: "maxim@onixdata.io",
      })
    ).toBe("Имя")
  })

  it("падает на локальную часть email", () => {
    expect(resolveProfileName({ email: "maxim@onixdata.io" })).toBe("maxim")
  })

  it("возвращает запасное значение, если ничего нет", () => {
    expect(resolveProfileName({})).toBe("Пользователь")
  })
})
