"use client"

import { BellIcon, DownloadIcon, MoreHorizontalIcon, PauseIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"

import { DsBlock, DsCode } from "@/components/design-system/section"
import { NewParseDialog } from "@/components/dashboard/new-parse-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export function GalleryOverlays() {
  return (
    <>
      <DsBlock
        title="Dialog"
        hint="Ширина sm:max-w-md, форма внутри — space-y-4. В DialogFooter слева ghost «Отмена», справа основное действие. Закрытие сбрасывает форму."
      >
        <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">Открыть диалог</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Удалить источник</DialogTitle>
                <DialogDescription>
                  Действие необратимо. Демо-режим: ничего не удаляется.
                </DialogDescription>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                Собранные сообщения останутся в базе, новые перестанут
                поступать.
              </p>
              <DialogFooter className="gap-2 sm:gap-2">
                <DialogClose asChild>
                  <Button type="button" variant="ghost">
                    Отмена
                  </Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button type="button" variant="destructive">
                    Удалить
                  </Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <NewParseDialog
            trigger={<Button variant="outline">Реальный NewParseDialog</Button>}
          />
        </div>
      </DsBlock>

      <DsBlock
        title="DropdownMenu"
        hint="Действия строки таблицы. Деструктивный пункт помечается text-destructive focus:bg-destructive/15 focus:text-destructive: обычный focus:bg-accent даёт под красным текстом контраст 4,16:1 — ниже нормы."
      >
        <div className="rounded-xl border bg-card p-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Действия для источника Доставка и логистика · Минск"
              >
                <MoreHorizontalIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44">
              <DropdownMenuLabel>Действия</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <PauseIcon />
                Пауза
              </DropdownMenuItem>
              <DropdownMenuItem>
                <DownloadIcon />
                Экспорт
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:bg-destructive/15 focus:text-destructive">
                <Trash2Icon />
                Удалить
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </DsBlock>

      <DsBlock
        title="Tooltip"
        hint="Единственный элемент с коралловой заливкой по умолчанию: bg-primary + text-primary-foreground, text-xs. Тултип — подсказка, а не способ спрятать смысл: доступное имя всегда есть у самой кнопки."
      >
        <div className="rounded-xl border bg-card p-4">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Уведомления: 5">
                  <BellIcon />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Уведомления: 5</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </DsBlock>

      <DsBlock
        title="Sheet"
        hint="Мобильная навигация: side=&quot;left&quot;, w-64, p-0. Заголовок и описание обязательны, но скрыты — SheetTitle и SheetDescription с sr-only, иначе Radix ругается на отсутствие доступного имени."
      >
        <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
          Живой пример — иконка меню в топбаре дашборда на экране уже{" "}
          <DsCode>lg</DsCode>. Здесь не дублируется: Sheet перекрыл бы страницу
          целиком.
        </div>
      </DsBlock>

      <DsBlock
        title="Sonner"
        hint="Toaster подключён один раз в корневом layout: position top-right, richColors, closeButton, theme dark. Любое действие прототипа отвечает тостом с пометкой «Демо-режим»."
      >
        <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4">
          <Button
            variant="outline"
            onClick={() =>
              toast("Уведомления", {
                description: "Демо-режим: центр уведомлений не подключён.",
              })
            }
          >
            Показать тост
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              toast.success("Задача парсинга запущена", {
                description:
                  "Viber: invite.viber.com/demo. Демо-режим, сбор не выполняется.",
              })
            }
          >
            toast.success
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              toast.error("Не удалось скопировать", {
                description: "Скопируйте ключ вручную.",
              })
            }
          >
            toast.error
          </Button>
        </div>
      </DsBlock>
    </>
  )
}
