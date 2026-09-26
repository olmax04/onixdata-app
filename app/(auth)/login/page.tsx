"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { MailIcon } from "lucide-react"
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

const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Укажите email")
    .email("Введите корректный email"),
  password: z.string().min(8, "Пароль должен быть не короче 8 символов"),
  remember: z.boolean(),
})

type LoginValues = z.infer<typeof loginSchema>

export default function LoginPage() {
  const router = useRouter()
  const { signIn } = useAuth()
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", remember: true },
  })

  const onSubmit = async (values: LoginValues) => {
    setIsSubmitting(true)
    try {
      const { error } = await signIn(values.email, values.password)
      if (error) {
        toast.error("Ошибка входа", {
          description: error.message || "Неверный email или пароль",
        })
        return
      }
      toast.success("Вход выполнен", {
        description: "Добро пожаловать в OnixData. Открываем дашборд.",
      })
      router.push("/dashboard")
    } catch (err: unknown) {
      toast.error("Не удалось выполнить вход", {
        description: err instanceof Error ? err.message : "Неизвестная ошибка",
      })
    } finally {
      setIsSubmitting(false)
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
                Вход...
              </>
            ) : (
              "Войти"
            )}
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
