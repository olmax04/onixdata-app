"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { PlusIcon, Loader2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
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
const emulatorSchema = z.object({
  name: z
    .string()
    .min(2, "Минимум 2 символа")
    .max(30, "Максимум 30 символов")
    .regex(/^[a-zA-Z0-9_-]+$/, "Только латинские буквы, цифры, дефис и _"),
  proxyUrl: z.string().optional(),
})

type EmulatorFormValues = z.infer<typeof emulatorSchema>

interface NewEmulatorDialogProps {
  onCreated?: () => void
  trigger?: React.ReactNode
}

export function NewEmulatorDialog({ onCreated, trigger }: NewEmulatorDialogProps) {
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)

  const form = useForm<EmulatorFormValues>({
    resolver: zodResolver(emulatorSchema),
    defaultValues: {
      name: "",
      proxyUrl: "",
    },
  })

  const onSubmit = async (values: EmulatorFormValues) => {
    setLoading(true)
    try {
      const res = await fetch("/api/emulators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name.trim(),
          ramSize: 4096,
          resolution: "720x1280",
          proxyUrl: values.proxyUrl?.trim() || undefined,
        }),
      })

      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || data?.message || "Ошибка создания инстанса")
      }

      toast.success(`Инстанс "${values.name}" успешно запущен!`, {
        description: "Инстанс готов к работе",
      })

      form.reset()
      setOpen(false)
      onCreated?.()
    } catch (err: any) {
      toast.error("Не удалось создать инстанс", {
        description: err.message || String(err),
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) form.reset()
      }}
    >
      <DialogTrigger asChild>
        {trigger || (
          <Button className="gap-2">
            <PlusIcon className="h-4 w-4" />
            Создать инстанс
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Создать новый инстанс</DialogTitle>
          <DialogDescription>
            Новый изолированный инстанс будет инициализирован и подключен.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Имя инстанса *</FormLabel>
                  <FormControl>
                    <Input placeholder="например: viber-worker-01" {...field} />
                  </FormControl>
                  <FormDescription>
                    Уникальное рабочее имя инстанса.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="proxyUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Прокси (Опционально)</FormLabel>
                  <FormControl>
                    <Input placeholder="http://user:pass@ip:port" {...field} />
                  </FormControl>
                  <FormDescription>
                    HTTP/SOCKS5 прокси для выхода в интернет с мобильного IP.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={loading}
              >
                Отмена
              </Button>
              <Button type="submit" disabled={loading} className="gap-2">
                {loading && <Loader2Icon className="h-4 w-4 animate-spin" />}
                {loading ? "Запуск инстанса..." : "Создать инстанс"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
