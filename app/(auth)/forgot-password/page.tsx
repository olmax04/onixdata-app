"use client"

import * as React from "react"
import Link from "next/link"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeftIcon, MailCheckIcon, MailIcon } from "lucide-react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { cn } from "@/lib/utils"
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

import { useAuth } from "@/lib/supabase/auth-context"
import { Loader2Icon } from "lucide-react"

const forgotSchema = z.object({
  email: z.string().min(1, "Укажите email").email("Введите корректный email"),
})

type ForgotValues = z.infer<typeof forgotSchema>

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth()
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [sentTo, setSentTo] = React.useState<string | null>(null)
  const successHeadingRef = React.useRef<HTMLHeadingElement>(null)
  const emailInputRef = React.useRef<HTMLInputElement | null>(null)
  /* Возврат к форме: её нужно очистить и вернуть фокус в поле email. */
  const refocusEmail = React.useRef(false)

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
      return
    }

    if (refocusEmail.current) {
      refocusEmail.current = false
      emailInputRef.current?.focus()
    }
  }, [sentTo])

  const onSubmit = async (values: ForgotValues) => {
    setIsSubmitting(true)
    try {
      const { error } = await resetPassword(values.email)
      if (error) {
        toast.error("Ошибка при отправке ссылки", {
          description: error.message || "Не удалось отправить письмо для сброса",
        })
        return
      }
      setSentTo(values.email)
      toast.success("Ссылка отправлена", {
        description: "Проверьте почту для перехода к сбросу пароля.",
      })
    } catch (err: unknown) {
      toast.error("Не удалось отправить ссылку", {
        description: err instanceof Error ? err.message : "Неизвестная ошибка",
      })
    } finally {
      setIsSubmitting(false)
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
            onClick={() => {
              form.reset()
              refocusEmail.current = true
              setSentTo(null)
            }}
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
                    ref={(node) => {
                      field.ref(node)
                      emailInputRef.current = node
                    }}
                  />
                </FormControl>
                <FormDescription>
                  На указанный адрес придет письмо со ссылкой для восстановления.
                </FormDescription>
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
              enter(authEnter.submit)
            )}
          >
            {isSubmitting ? (
              <>
                <Loader2Icon className="mr-2 size-4 animate-spin" />
                Отправка...
              </>
            ) : (
              "Отправить ссылку"
            )}
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
