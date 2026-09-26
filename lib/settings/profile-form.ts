import { z } from "zod"

export const profileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Имя должно быть не короче 2 символов")
    .max(80, "Имя должно быть не длиннее 80 символов"),
  email: z
    .string()
    .trim()
    .min(1, "Укажите email")
    .email("Введите корректный email"),
})

export type ProfileValues = z.infer<typeof profileSchema>

export const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Введите текущий пароль"),
    newPassword: z.string().min(8, "Пароль должен быть не короче 8 символов"),
    confirmPassword: z.string().min(1, "Повторите пароль"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Пароли не совпадают",
    path: ["confirmPassword"],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: "Новый пароль должен отличаться от текущего",
    path: ["newPassword"],
  })

export type PasswordValues = z.infer<typeof passwordSchema>

export interface ProfileUpdatePlan {
  nameChanged: boolean
  emailChanged: boolean
  hasChanges: boolean
  fullName: string
  email: string
}

function normalizeEmail(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase()
}

export function buildProfileUpdate(
  current: { name?: string | null; email?: string | null },
  values: ProfileValues
): ProfileUpdatePlan {
  const fullName = values.name.trim()
  const email = normalizeEmail(values.email)
  const nameChanged = fullName !== (current.name ?? "").trim()
  const emailChanged = email !== normalizeEmail(current.email)

  return {
    nameChanged,
    emailChanged,
    hasChanges: nameChanged || emailChanged,
    fullName,
    email,
  }
}

export interface ProfileSaveToast {
  variant: "success" | "info"
  title: string
  description?: string
}

export function buildProfileSaveToast(plan: ProfileUpdatePlan): ProfileSaveToast {
  if (!plan.hasChanges) {
    return {
      variant: "info",
      title: "Изменений нет",
      description: "Данные профиля совпадают с сохранёнными.",
    }
  }

  if (plan.emailChanged) {
    return {
      variant: "success",
      title: "Профиль сохранён",
      description: `На адрес ${plan.email} отправлено письмо со ссылкой подтверждения. Email сменится после перехода по ссылке.`,
    }
  }

  return {
    variant: "success",
    title: "Профиль сохранён",
    description: "Имя обновлено.",
  }
}

export function resolveProfileName(input: {
  profileFullName?: string | null
  metadataFullName?: string | null
  metadataName?: string | null
  email?: string | null
}): string {
  const candidates = [
    input.profileFullName,
    input.metadataFullName,
    input.metadataName,
    input.email?.split("@")[0],
  ]

  for (const candidate of candidates) {
    const value = candidate?.trim()
    if (value) return value
  }

  return "Пользователь"
}
