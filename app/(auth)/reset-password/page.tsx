"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeftIcon, CheckCircle2Icon, Loader2Icon } from "lucide-react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { AuthHeading } from "@/components/auth/auth-heading"
import {
  authEnter,
  authFormMessage,
  authPress,
} from "@/components/auth/auth-motion"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { PasswordInput } from "@/components/ui/icon-input"

const resetSchema = z
  .object({
    password: z.string().min(8, "Пароль должен быть не короче 8 символов"),
    confirmPassword: z.string().min(1, "Повторите пароль"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Пароли не совпадают",
    path: ["confirmPassword"],
  })

type ResetValues = z.infer<typeof resetSchema>

export default function ResetPasswordPage() {
  const router = useRouter()
  const [completed, setCompleted] = React.useState(false)

  const form = useForm<ResetValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: "", confirmPassword: "" },
  })

  const onSubmit = async (values: ResetValues) => {
    const isConfigured = isSupabaseConfigured()

    if (!isConfigured) {
      setCompleted(true)
      toast.success("Пароль изменён (демо-режим)")
      return
    }

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({
        password: values.password,
      })

      if (error) {
        toast.error("Ошибка смены пароля", {
          description: error.message,
        })
        return
      }

      setCompleted(true)
      toast.success("Пароль успешно обновлён")
    } catch (err) {
      toast.error("Ошибка соединения", {
        description: err instanceof Error ? err.message : String(err),
      })
    }
  }

  if (completed) {
    return (
      <div className="animate-in fade-in zoom-in-95 space-y-6 text-center duration-500">
        <div className="flex flex-col items-center gap-4">
          <div className="auth-ring relative flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary duration-500">
            <CheckCircle2Icon className="size-6" aria-hidden="true" />
          </div>
          <AuthHeading
            title="Пароль изменён."
            description="Теперь вы можете войти в систему с новым паролем."
          />
        </div>

        <Button
          asChild
          className={cn("h-11 w-full text-[0.95rem]", authPress)}
        >
          <Link href="/login">Войти в аккаунт</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <AuthHeading
        className={authEnter.title}
        descriptionClassName={authEnter.description}
        title="Новый пароль."
        description="Придумайте надёжный пароль для доступа к вашему аккаунту."
      />

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-4"
          noValidate
        >
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem className={cn("space-y-1.5", authEnter.field)}>
                <FormLabel className="sr-only">Новый пароль</FormLabel>
                <FormControl>
                  <PasswordInput
                    autoComplete="new-password"
                    placeholder="Новый пароль"
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
                    placeholder="Повторите новый пароль"
                    {...field}
                  />
                </FormControl>
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
            Сохранить пароль
          </Button>
        </form>
      </Form>

      <p className={cn("text-center", authEnter.backLink)}>
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 rounded-sm text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <ArrowLeftIcon className="size-4" aria-hidden="true" />
          Вернуться ко входу
        </Link>
      </p>
    </div>
  )
}
