"use client"

import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { MailIcon, UserIcon, Loader2Icon } from "lucide-react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { isSupabaseConfigured } from "@/lib/supabase/config"
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
    const isConfigured = isSupabaseConfigured()

    if (!isConfigured) {
      toast.success("Аккаунт создан (демо-режим)", {
        description: `${values.email}. Supabase не настроен в .env.local.`,
      })
      router.push("/dashboard")
      return
    }

    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: {
            name: values.name,
            full_name: values.name,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) {
        toast.error("Ошибка регистрации", {
          description: error.message,
        })
        return
      }

      if (data.session) {
        toast.success("Регистрация успешна", {
          description: `Добро пожаловать в OnixData, ${values.name}!`,
        })
        router.push("/dashboard")
        router.refresh()
      } else {
        toast.success("Аккаунт создан", {
          description: "На ваш email отправлено письмо с подтверждением. Пожалуйста, проверьте почту.",
        })
        router.push("/login")
      }
    } catch (err) {
      toast.error("Ошибка регистрации", {
        description: err instanceof Error ? err.message : String(err),
      })
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
        description="Подключите источники и соберите первый датасет за пару минут."
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
            disabled={form.formState.isSubmitting}
            className={cn(
              "h-11 w-full text-[0.95rem]",
              authPress,
              authEnter.submit
            )}
          >
            {form.formState.isSubmitting ? (
              <Loader2Icon className="size-4 animate-spin mr-2" />
            ) : null}
            Создать аккаунт
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
