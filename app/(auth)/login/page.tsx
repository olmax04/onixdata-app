"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { MailIcon, Loader2Icon } from "lucide-react"
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

const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Укажите email")
    .email("Введите корректный email"),
  password: z.string().min(6, "Пароль должен быть не короче 6 символов"),
  remember: z.boolean(),
})

type LoginValues = z.infer<typeof loginSchema>

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextUrl = searchParams.get("next") || "/dashboard"

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", remember: true },
  })

  const onSubmit = async (values: LoginValues) => {
    const isConfigured = isSupabaseConfigured()

    if (!isConfigured) {
      toast.success("Вход выполнен (демо-режим)", {
        description: `${values.email}. Supabase не настроен в .env.local.`,
      })
      router.push(nextUrl)
      return
    }

    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      })

      if (error) {
        let msg = error.message
        if (error.message === "Invalid login credentials") {
          msg = "Неверный email или пароль. Если аккаунт ещё не создан, перейдите в «Регистрация»."
        } else if (error.message.toLowerCase().includes("email not confirmed")) {
          msg = "Email ещё не подтверждён. Проверьте почту или отключите «Confirm email» в настройках Supabase."
        }
        toast.error("Ошибка входа", {
          description: msg,
        })
        return
      }

      if (data.user) {
        toast.success("Вход выполнен", {
          description: `Добро пожаловать, ${data.user.email}!`,
        })
        router.push(nextUrl)
        router.refresh()
      }
    } catch (err) {
      toast.error("Ошибка соединения", {
        description: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return (
    <div className="space-y-6">
      <AuthHeading
        className={authEnter.title}
        descriptionClassName={authEnter.description}
        title="Вход в аккаунт."
        description="Введите email и пароль, чтобы продолжить работу с источниками."
      />

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-4"
          noValidate
        >
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
                    autoComplete="current-password"
                    placeholder="Пароль"
                    {...field}
                  />
                </FormControl>
                <FormMessage className={authFormMessage} />
              </FormItem>
            )}
          />

          <div
            className={cn(
              "flex items-center justify-between gap-3",
              authEnter.aside
            )}
          >
            <FormField
              control={form.control}
              name="remember"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center gap-2 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormLabel className="cursor-pointer text-sm font-normal text-muted-foreground">
                    Запомнить меня
                  </FormLabel>
                </FormItem>
              )}
            />

            <Link
              href="/forgot-password"
              className="rounded-sm text-sm text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              Забыли пароль?
            </Link>
          </div>

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
            Войти
          </Button>
        </form>
      </Form>

      <AuthDivider className={authEnter.divider} />

      <OAuthButtons className={authEnter.oauth} />

      <AuthAltAction
        className={authEnter.altAction}
        question="Нет аккаунта?"
        href="/register"
        action="Регистрация"
      />
    </div>
  )
}

export default function LoginPage() {
  return (
    <React.Suspense fallback={<div className="h-64" />}>
      <LoginForm />
    </React.Suspense>
  )
}
