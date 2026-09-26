"use client"

import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { MailIcon, UserIcon } from "lucide-react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { cn } from "@/lib/utils"
import { AuthAltAction } from "@/components/auth/auth-alt-action"
import { AuthDivider } from "@/components/auth/auth-divider"
import { AuthHeading } from "@/components/auth/auth-heading"
import {
  authEnter,
  authFormMessage,
  authPress,
} from "@/components/auth/auth-motion"
import { OAuthButtons } from "@/components/auth/oauth-buttons"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { IconInput, PasswordInput } from "@/components/ui/icon-input"

import * as React from "react"
import { useAuth } from "@/lib/supabase/auth-context"
import { Loader2Icon } from "lucide-react"

const registerSchema = z
  .object({
    name: z.string().min(2, "Укажите имя (минимум 2 символа)"),
    email: z.string().min(1, "Укажите email").email("Введите корректный email"),
    password: z.string().min(8, "Пароль должен быть не короче 8 символов"),
    confirmPassword: z.string().min(1, "Повторите пароль"),
    terms: z.boolean().refine((value) => value === true, {
      message: "Нужно принять условия использования",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Пароли не совпадают",
    path: ["confirmPassword"],
  })

type RegisterValues = z.infer<typeof registerSchema>

export default function RegisterPage() {
  const router = useRouter()
  const { signUp } = useAuth()
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      terms: false,
    },
  })

  const onSubmit = async (values: RegisterValues) => {
    setIsSubmitting(true)
    try {
      const { data, error } = await signUp(values.email, values.password, values.name)
      if (error) {
        toast.error("Ошибка при регистрации", {
          description: error.message || "Не удалось создать аккаунт",
        })
        return
      }

      const res = data as { session?: unknown; user?: { identities?: unknown[] } } | null
      if (res?.user && (!res.session || (Array.isArray(res.user.identities) && res.user.identities.length === 0))) {
        toast.success("Регистрация успешна", {
          description: "Проверьте почту для подтверждения аккаунта.",
        })
        router.push("/login")
      } else {
        toast.success("Аккаунт создан", {
          description: `Добро пожаловать, ${values.name}! Открываем дашборд.`,
        })
        router.push("/dashboard")
      }
    } catch (err: unknown) {
      toast.error("Не удалось создать аккаунт", {
        description: err instanceof Error ? err.message : "Неизвестная ошибка",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  /*
   * Ритм осознанно на шаг плотнее, чем на /login и /forgot-password
   * (4/3.5 против 6/4): в форме вдвое больше полей, и на ноутбучной
   * высоте она должна помещаться целиком.
   */
  return (
    <div className="space-y-4">
      <AuthHeading
        className={authEnter.title}
        descriptionClassName={authEnter.description}
        title="Создать аккаунт."
        description="Подключите группы Viber и запустите первый сбор за пару минут."
      />

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-3.5"
          noValidate
        >
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem className={cn("space-y-1.5", authEnter.field)}>
                <FormLabel className="sr-only">Имя</FormLabel>
                <FormControl>
                  <IconInput
                    icon={UserIcon}
                    autoComplete="name"
                    placeholder="Имя"
                    {...field}
                  />
                </FormControl>
                <FormMessage className={authFormMessage} />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem className={cn("space-y-1.5", authEnter.field)}>
                <FormLabel className="sr-only">Email</FormLabel>
                <FormControl>
                  <IconInput
                    icon={MailIcon}
                    type="email"
                    autoComplete="email"
                    placeholder="Email"
                    {...field}
                  />
                </FormControl>
                <FormMessage className={authFormMessage} />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem className={cn("space-y-1.5", authEnter.field)}>
                <FormLabel className="sr-only">Пароль</FormLabel>
                <FormControl>
                  <PasswordInput
                    autoComplete="new-password"
                    placeholder="Пароль"
                    {...field}
                  />
                </FormControl>
                <FormMessage className={authFormMessage} />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem className={cn("space-y-1.5", authEnter.field)}>
                <FormLabel className="sr-only">Повторите пароль</FormLabel>
                <FormControl>
                  <PasswordInput
                    autoComplete="new-password"
                    placeholder="Повторите пароль"
                    {...field}
                  />
                </FormControl>
                <FormMessage className={authFormMessage} />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="terms"
            render={({ field }) => (
              <FormItem className={cn("space-y-2", authEnter.aside)}>
                <div className="flex items-center gap-2">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormLabel className="cursor-pointer text-sm font-normal text-muted-foreground">
                    Я принимаю условия использования
                  </FormLabel>
                </div>
                <FormMessage className={authFormMessage} />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            disabled={isSubmitting}
            className={cn(
              "h-11 w-full text-[0.95rem]",
              authPress,
              authEnter.submit
            )}
          >
            {isSubmitting ? (
              <>
                <Loader2Icon className="mr-2 size-4 animate-spin" />
                Создание аккаунта...
              </>
            ) : (
              "Создать аккаунт"
            )}
          </Button>
        </form>
      </Form>

      <AuthDivider className={authEnter.divider} />

      <OAuthButtons className={authEnter.oauth} />

      <AuthAltAction
        className={authEnter.altAction}
        question="Уже есть аккаунт?"
        href="/login"
        action="Войти"
      />
    </div>
  )
}
