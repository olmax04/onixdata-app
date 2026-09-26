"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { CopyIcon, Loader2Icon } from "lucide-react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { useAuth } from "@/components/auth/auth-provider"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PasswordInput } from "@/components/ui/icon-input"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { currentUser, demoApiKey } from "@/lib/mock-data"
import {
  buildProfileSaveToast,
  buildProfileUpdate,
  passwordSchema,
  profileSchema,
  type PasswordValues,
  type ProfileValues,
} from "@/lib/settings/profile-form"
import { createClient } from "@/lib/supabase/client"
import { isSupabaseConfigured } from "@/lib/supabase/config"

const demoHint = "Supabase не подключён: показаны демо-данные, изменения не сохраняются."

function ProfileFormSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-10 w-full max-w-sm" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-10 w-full max-w-sm" />
      </div>
    </div>
  )
}

function ProfileTab() {
  const { user, profile, isLoading, refresh } = useAuth()
  const configured = React.useMemo(() => isSupabaseConfigured(), [])
  const fallbackProfile = configured ? null : currentUser

  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: fallbackProfile?.name ?? "",
      email: fallbackProfile?.email ?? "",
    },
  })

  const { isDirty } = form.formState
  const currentName = profile?.name ?? fallbackProfile?.name ?? ""
  const currentEmail = profile?.email ?? fallbackProfile?.email ?? ""

  // Профиль догружается асинхронно; пока форму не трогали — подставляем свежие данные.
  React.useEffect(() => {
    if (isDirty) return
    form.reset({ name: currentName, email: currentEmail })
  }, [form, isDirty, currentName, currentEmail])

  const onSubmit = async (values: ProfileValues) => {
    const plan = buildProfileUpdate(
      { name: currentName, email: currentEmail },
      values
    )

    if (!configured) {
      toast.success("Профиль сохранён", {
        description: "Демо-режим: данные не отправляются на сервер.",
      })
      return
    }

    if (!plan.hasChanges) {
      const info = buildProfileSaveToast(plan)
      toast.info(info.title, { description: info.description })
      return
    }

    if (!user) {
      toast.error("Сессия не найдена", {
        description: "Войдите заново и повторите попытку.",
      })
      return
    }

    try {
      const supabase = createClient()
      let profileRowError: string | null = null

      if (plan.nameChanged) {
        // Сначала учётная запись: если упадёт она, в public.profiles ещё нет
        // нового имени и состояние остаётся согласованным.
        const { error: metadataError } = await supabase.auth.updateUser({
          data: { full_name: plan.fullName },
        })

        if (metadataError) {
          toast.error("Не удалось сохранить имя", {
            description: metadataError.message,
          })
          return
        }

        // select после update: при 0 затронутых строк Supabase вернёт
        // data === null без ошибки — это не успех.
        const { data, error } = await supabase
          .from("profiles")
          .update({ full_name: plan.fullName })
          .eq("id", user.id)
          .select("id")
          .maybeSingle()

        if (error) {
          profileRowError = error.message
        } else if (!data) {
          profileRowError = "Строка профиля недоступна для записи."
        }
      }

      if (plan.emailChanged) {
        const { error } = await supabase.auth.updateUser({ email: plan.email })

        if (error) {
          toast.error("Не удалось изменить email", {
            description: error.message,
          })
          return
        }
      }

      await refresh()

      // Email в auth сменится только после подтверждения — показываем текущий.
      form.reset({ name: plan.fullName, email: user.email ?? currentEmail })

      if (profileRowError) {
        toast.warning("Профиль сохранён частично", {
          description: `Имя сохранено в учётной записи, но не удалось обновить профиль в базе. ${profileRowError}`,
        })
        return
      }

      const success = buildProfileSaveToast(plan)
      toast.success(success.title, { description: success.description })
    } catch (err) {
      toast.error("Ошибка соединения", {
        description: err instanceof Error ? err.message : String(err),
      })
    }
  }

  const disabled = form.formState.isSubmitting || (configured && isLoading)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Профиль</CardTitle>
        <CardDescription>
          Как вас видят участники рабочей области.
          {configured ? null : ` ${demoHint}`}
        </CardDescription>
      </CardHeader>

      {configured && isLoading ? (
        <CardContent>
          <ProfileFormSkeleton />
        </CardContent>
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <FormLabel>Имя</FormLabel>
                    <FormControl>
                      <Input
                        autoComplete="name"
                        className="max-w-sm"
                        disabled={disabled}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        autoComplete="email"
                        className="max-w-sm"
                        disabled={disabled}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      После смены адреса Supabase отправит письмо со ссылкой
                      подтверждения — email сменится только после перехода по
                      ней.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={disabled}>
                {form.formState.isSubmitting ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : null}
                Сохранить
              </Button>
            </CardFooter>
          </form>
        </Form>
      )}
    </Card>
  )
}

function PasswordCard() {
  const { user } = useAuth()
  const configured = React.useMemo(() => isSupabaseConfigured(), [])

  const form = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  })

  const onSubmit = async (values: PasswordValues) => {
    if (!configured) {
      toast.success("Пароль изменён", {
        description: "Демо-режим: данные не отправляются на сервер.",
      })
      form.reset()
      return
    }

    const email = user?.email

    if (!email) {
      toast.error("Сессия не найдена", {
        description: "Войдите заново и повторите попытку.",
      })
      return
    }

    try {
      const supabase = createClient()

      // updateUser не проверяет текущий пароль — делаем это повторным входом.
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email,
        password: values.currentPassword,
      })

      if (reauthError) {
        form.setError("currentPassword", {
          message: "Текущий пароль неверный",
        })
        toast.error("Текущий пароль неверный")
        return
      }

      const { error } = await supabase.auth.updateUser({
        password: values.newPassword,
      })

      if (error) {
        toast.error("Не удалось изменить пароль", {
          description: error.message,
        })
        return
      }

      toast.success("Пароль обновлён")
      form.reset()
    } catch (err) {
      toast.error("Ошибка соединения", {
        description: err instanceof Error ? err.message : String(err),
      })
    }
  }

  const disabled = form.formState.isSubmitting

  return (
    <Card>
      <CardHeader>
        <CardTitle>Смена пароля</CardTitle>
        <CardDescription>
          Подтвердите текущий пароль и задайте новый — не короче 8 символов.
          {configured ? null : ` ${demoHint}`}
        </CardDescription>
      </CardHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="currentPassword"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel>Текущий пароль</FormLabel>
                  <FormControl>
                    <PasswordInput
                      autoComplete="current-password"
                      className="max-w-sm"
                      disabled={disabled}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel>Новый пароль</FormLabel>
                  <FormControl>
                    <PasswordInput
                      autoComplete="new-password"
                      className="max-w-sm"
                      disabled={disabled}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel>Повторите новый пароль</FormLabel>
                  <FormControl>
                    <PasswordInput
                      autoComplete="new-password"
                      className="max-w-sm"
                      disabled={disabled}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={disabled}>
              {disabled ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : null}
              Сменить пароль
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  )
}

function ApiTab() {
  const copyKey = async () => {
    try {
      await navigator.clipboard.writeText(demoApiKey)
      toast.success("Ключ скопирован", {
        description: "Это демонстрационный ключ, он ничего не открывает.",
      })
    } catch {
      toast.error("Не удалось скопировать", {
        description: "Скопируйте ключ вручную.",
      })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>API</CardTitle>
        <CardDescription>
          Ключ для доступа к выгрузкам. Значение ниже — демонстрационное.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="settings-api-key">Ключ доступа</Label>
          <div className="flex max-w-xl gap-2">
            <Input
              id="settings-api-key"
              readOnly
              value={demoApiKey}
              className="font-mono text-xs"
            />
            <Button
              variant="outline"
              onClick={copyKey}
              aria-label="Скопировать API-ключ"
            >
              <CopyIcon />
              Скопировать
            </Button>
          </div>
        </div>
        <Separator />
        <p className="text-sm text-muted-foreground">
          Ключ даёт доступ только к публичным данным, собранным вашими
          источниками.
        </p>
      </CardContent>
    </Card>
  )
}

function NotificationsTab() {
  const [sourceAlerts, setSourceAlerts] = React.useState(true)
  const [weeklyDigest, setWeeklyDigest] = React.useState(false)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Уведомления</CardTitle>
        <CardDescription>
          Что присылать по почте. Демо-режим: письма не отправляются.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        <div className="flex items-center justify-between gap-4 py-3">
          <div className="space-y-0.5">
            <Label htmlFor="notify-sources">Сбои источников</Label>
            <p className="text-sm text-muted-foreground">
              Письмо, если источник перестал отдавать данные.
            </p>
          </div>
          <Switch
            id="notify-sources"
            checked={sourceAlerts}
            onCheckedChange={setSourceAlerts}
          />
        </div>
        <Separator />
        <div className="flex items-center justify-between gap-4 py-3">
          <div className="space-y-0.5">
            <Label htmlFor="notify-digest">Еженедельный дайджест</Label>
            <p className="text-sm text-muted-foreground">
              Сводка по упоминаниям и тональности за неделю.
            </p>
          </div>
          <Switch
            id="notify-digest"
            checked={weeklyDigest}
            onCheckedChange={setWeeklyDigest}
          />
        </div>
      </CardContent>
    </Card>
  )
}

export function SettingsTabs() {
  return (
    <Tabs defaultValue="profile" className="space-y-4">
      <TabsList>
        <TabsTrigger value="profile">Профиль</TabsTrigger>
        <TabsTrigger value="api">API</TabsTrigger>
        <TabsTrigger value="notifications">Уведомления</TabsTrigger>
      </TabsList>

      <TabsContent value="profile" className="space-y-4">
        <ProfileTab />
        <PasswordCard />
      </TabsContent>
      <TabsContent value="api">
        <ApiTab />
      </TabsContent>
      <TabsContent value="notifications">
        <NotificationsTab />
      </TabsContent>
    </Tabs>
  )
}
