"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { frequencyOptions, platforms } from "@/lib/mock-data"

const parseSchema = z.object({
  platform: z.enum(["Telegram", "WhatsApp", "Discord"], {
    required_error: "Выберите платформу",
  }),
  target: z.string().min(3, "Укажите ссылку, канал или сервер"),
  keywords: z.string().min(2, "Укажите хотя бы одно ключевое слово"),
  frequency: z.string().min(1, "Выберите частоту обновления"),
})

type ParseValues = z.infer<typeof parseSchema>

export function NewParseDialog({ trigger }: { trigger: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)

  const form = useForm<ParseValues>({
    resolver: zodResolver(parseSchema),
    defaultValues: { target: "", keywords: "", frequency: "" },
  })

  const onSubmit = (values: ParseValues) => {
    toast.success("Задача парсинга запущена", {
      description: `${values.platform}: ${values.target}. Демо-режим, сбор не выполняется.`,
    })
    form.reset()
    setOpen(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) form.reset()
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Новая задача парсинга</DialogTitle>
          <DialogDescription>
            Собираем только публичные сообщения. Демо-режим: задача не
            выполняется.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
            noValidate
          >
            <FormField
              control={form.control}
              name="platform"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Платформа</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите платформу" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {platforms.map((platform) => (
                        <SelectItem key={platform} value={platform}>
                          {platform}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="target"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ссылка или канал</FormLabel>
                  <FormControl>
                    <Input placeholder="@my_public_channel" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="keywords"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ключевые слова</FormLabel>
                  <FormControl>
                    <Input placeholder="доставка, тариф, возврат" {...field} />
                  </FormControl>
                  <FormDescription>Перечислите через запятую.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="frequency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Частота обновления</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите частоту" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {frequencyOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
              >
                Отмена
              </Button>
              <Button type="submit">Запустить сбор</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
