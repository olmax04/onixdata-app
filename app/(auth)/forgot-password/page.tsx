"use client"

import * as React from "react"
import Link from "next/link"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeftIcon, MailCheckIcon, MailIcon } from "lucide-react"
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { IconInput } from "@/components/ui/icon-input"

const forgotSchema = z.object({
  email: z.string().min(1, "Укажите email").email("Введите корректный email"),
})

type ForgotValues = z.infer<typeof forgotSchema>

export default function ForgotPasswordPage() {
  const [sentTo, setSentTo] = React.useState<string | null>(null)
  const successHeadingRef = React.useRef<HTMLHeadingElement>(null)

  /*
   * Каскад — часть загрузки страницы. По «Отправить на другой адрес» форма
   * монтируется заново, и повторный проход недопустим: из-за
   * fill-mode: backwards пользователь увидел бы вместо формы пустое место.
   * Флаг поднимаем на уходе к экрану успеха, а не сразу после монтирования:
   * иначе первый же ре-рендер формы (ввод в поле) оборвал бы идущий каскад.
   */
  const entered = React.useRef(false)
  const enter = (className: string) =>
    entered.current ? undefined : className

  const form = useForm<ForgotValues>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: "" },
  })

  /* Форма размонтируется — переносим фокус на заголовок экрана успеха. */
  React.useEffect(() => {
    if (sentTo) {
      entered.current = true
      successHeadingRef.current?.focus()
    }
  }, [sentTo])

  const onSubmit = async (values: ForgotValues) => {
    const isConfigured = isSupabaseConfigured()

    if (!isConfigured) {
      setSentTo(values.email)
      toast.success("Ссылка отправлена (демо-режим)", {
        description: "Supabase не настроен в .env.local.",
      })
      return
    }

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      })

      if (error) {
        toast.error("Ошибка отправки", {
          description: error.message,
        })
        return
      }

      setSentTo(values.email)
      toast.success("Ссылка для сброса пароля отправлена", {
        description: `Проверьте почту ${values.email}.`,
      })
    } catch (err) {
      toast.error("Ошибка соединения", {
        description: err instanceof Error ? err.message : String(err),
      })
    }
  }

  if (sentTo) {
    return (
      <div className="animate-in fade-in zoom-in-95 space-y-6 text-center duration-500">
        <div className="flex flex-col items-center gap-4">
          {/* Кольцо отыгрывает один раз — бесконечный пульс здесь раздражает. */}
          <div className="auth-ring animate-in zoom-in-50 relative flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary duration-500">
            <MailCheckIcon className="size-6" aria-hidden="true" />
          </div>
          <AuthHeading
            ref={successHeadingRef}
            tabIndex={-1}
            title="Проверьте почту."
            description={
              <>
                Письмо со ссылкой отправлено на{" "}
                <span className="font-medium text-foreground">{sentTo}</span>.
                Ссылка действует 30 минут.
              </>
            }
          />
        </div>

        <div className="space-y-2">
          <Button
            asChild
            className={cn("h-11 w-full text-[0.95rem]", authPress)}
          >
            <Link href="/login">Вернуться ко входу</Link>
          </Button>
          <Button
            type="button"
            variant="ghost"
            className={cn("h-11 w-full text-[0.95rem]", authPress)}
            onClick={() => setSentTo(null)}
          >
            Отправить на другой адрес
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <AuthHeading
        className={enter(authEnter.title)}
        descriptionClassName={enter(authEnter.description)}
        title="Восстановление доступа."
        description="Укажите email аккаунта — пришлём ссылку для смены пароля."
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
              <FormItem className={cn("space-y-1.5", enter(authEnter.field))}>
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
                <FormDescription>
                  Демо-режим: письмо реально не отправляется.
                </FormDescription>
                <FormMessage className={authFormMessage} />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            className={cn(
              "h-11 w-full text-[0.95rem]",
              authPress,
              enter(authEnter.submit)
            )}
          >
            Отправить ссылку
          </Button>
        </form>
      </Form>

      <p className={cn("text-center", enter(authEnter.backLink))}>
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
