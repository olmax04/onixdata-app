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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { exportFormats, sources } from "@/lib/mock-data"

const exportSchema = z.object({
  format: z.string().min(1, "Выберите формат"),
  source: z.string().min(1, "Выберите источник"),
})

type ExportValues = z.infer<typeof exportSchema>

export function ExportDialog({ trigger }: { trigger: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)

  const form = useForm<ExportValues>({
    resolver: zodResolver(exportSchema),
    defaultValues: { format: "", source: "" },
  })

  const onSubmit = (values: ExportValues) => {
    toast.success("Экспорт поставлен в очередь", {
      description: `${values.format} · ${values.source}. Демо-режим: файл не формируется.`,
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
          <DialogTitle>Экспорт датасета</DialogTitle>
          <DialogDescription>
            Выберите формат и источник. Демо-режим: файл не формируется.
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
              name="format"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Формат</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите формат" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {exportFormats.map((format) => (
                        <SelectItem key={format} value={format}>
                          {format}
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
              name="source"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Источник</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите источник" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Все источники">
                        Все источники
                      </SelectItem>
                      {sources.map((source) => (
                        <SelectItem key={source.id} value={source.name}>
                          {source.name}
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
              <Button type="submit">Экспортировать</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
