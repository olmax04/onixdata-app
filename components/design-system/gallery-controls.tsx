"use client"

import * as React from "react"
import { MailIcon, PlusIcon, SearchIcon } from "lucide-react"

import { authPress } from "@/components/auth/auth-motion"
import { DsBlock, DsCode } from "@/components/design-system/section"
import { formatNumber } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { IconInput, PasswordInput } from "@/components/ui/icon-input"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { platforms } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

export function GalleryControls() {
  const [checked, setChecked] = React.useState(true)
  const [enabled, setEnabled] = React.useState(true)

  return (
    <>
      <DsBlock
        title="Button"
        hint="Шесть вариантов и четыре размера. Иконка внутри кнопки не требует класса размера: buttonVariants задаёт [&_svg]:size-4."
      >
        <div className="space-y-4 rounded-xl border bg-card p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Основная</Button>
            <Button variant="secondary">Вторичная</Button>
            <Button variant="outline">Контурная</Button>
            <Button variant="ghost">Призрачная</Button>
            <Button variant="destructive">Удалить</Button>
            <Button variant="link">Ссылка</Button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm">sm · h-8</Button>
            <Button>default · h-9</Button>
            <Button size="lg">lg · h-10</Button>
            <Button size="icon" aria-label="Новая задача">
              <PlusIcon />
            </Button>
            <Button className={cn("h-11 text-[0.95rem]", authPress)}>
              auth · h-11
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button disabled>Выключена</Button>
            <Button variant="outline" disabled>
              Выключена
            </Button>
            <Button>
              <PlusIcon />С иконкой
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Основная кнопка — одна на экран. Второе действие в диалоге всегда
            ghost «Отмена». Icon-кнопка обязана иметь{" "}
            <DsCode>aria-label</DsCode>.
          </p>
        </div>
      </DsBlock>

      <DsBlock
        title="Badge"
        hint="outline — платформа, secondary — теги и статусы, default (коралл) — позитив и счётчик уведомлений, destructive — ошибка источника."
      >
        <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4">
          <Badge>default</Badge>
          <Badge variant="secondary">secondary</Badge>
          <Badge variant="outline">outline</Badge>
          <Badge variant="destructive">destructive</Badge>
          <Badge variant="outline" className="font-normal">
            Telegram
          </Badge>
          <Badge variant="secondary" className="gap-1.5 py-1 font-normal">
            доставка
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
              {formatNumber(1842)}
            </span>
          </Badge>
          <Badge className="h-4 min-w-4 justify-center rounded-full px-1 text-[10px] leading-none">
            5
          </Badge>
        </div>
      </DsBlock>

      <DsBlock
        title="Input, IconInput, PasswordInput"
        hint="Обычное поле — h-9. В auth-формах лейбл скрыт (sr-only), поэтому поле выше (h-11), с иконкой слева (pl-10) и само показывает ошибку через aria-invalid."
      >
        <div className="grid gap-4 rounded-xl border bg-card p-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="ds-input">Обычное поле</Label>
            <Input id="ds-input" placeholder="invite.viber.com/…" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ds-input-disabled">Выключенное</Label>
            <Input id="ds-input-disabled" placeholder="Недоступно" disabled />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ds-input-search">Поиск</Label>
            <div className="relative">
              <SearchIcon
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id="ds-input-search"
                type="search"
                placeholder="Поиск по сообщениям…"
                className="pl-9"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ds-input-mono">Только для чтения (mono)</Label>
            <Input
              id="ds-input-mono"
              readOnly
              value="onix_sk_demo_4f2b91c07ae54d18bd3c6a0f7e15"
              className="font-mono text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="sr-only" htmlFor="ds-icon-input">
              Email
            </Label>
            <IconInput
              id="ds-icon-input"
              icon={MailIcon}
              type="email"
              placeholder="Email"
            />
            <p className="text-xs text-muted-foreground">IconInput · h-11</p>
          </div>

          <div className="space-y-1.5">
            <Label className="sr-only" htmlFor="ds-password-input">
              Пароль
            </Label>
            <PasswordInput id="ds-password-input" placeholder="Пароль" />
            <p className="text-xs text-muted-foreground">
              PasswordInput · переключатель видимости с aria-label
            </p>
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label className="sr-only" htmlFor="ds-icon-input-invalid">
              Email с ошибкой
            </Label>
            <IconInput
              id="ds-icon-input-invalid"
              icon={MailIcon}
              type="email"
              placeholder="Email"
              defaultValue="не-email"
              aria-invalid="true"
            />
            <p className="text-[0.8rem] font-medium text-destructive">
              Введите корректный email
            </p>
          </div>
        </div>
      </DsBlock>

      <DsBlock
        title="Select"
        hint="Триггер повторяет геометрию инпута (h-9, rounded-md, border-input). Список открывается в поповере на уровне карточки."
      >
        <div className="max-w-sm rounded-xl border bg-card p-4">
          <div className="space-y-1.5">
            <Label htmlFor="ds-select">Платформа</Label>
            <Select>
              <SelectTrigger id="ds-select">
                <SelectValue placeholder="Выберите платформу" />
              </SelectTrigger>
              <SelectContent>
                {platforms.map((platform) => (
                  <SelectItem key={platform} value={platform}>
                    {platform}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </DsBlock>

      <DsBlock
        title="Checkbox и Switch"
        hint="Оба во включённом состоянии заливаются кораллом. Checkbox — согласие в форме, Switch — настройка, которая применяется сразу."
      >
        <div className="space-y-4 rounded-xl border bg-card p-4">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2">
              <Checkbox
                id="ds-checkbox"
                checked={checked}
                onCheckedChange={(value) => setChecked(value === true)}
              />
              <Label
                htmlFor="ds-checkbox"
                className="cursor-pointer text-sm font-normal text-muted-foreground"
              >
                Запомнить меня
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="ds-checkbox-off" />
              <Label
                htmlFor="ds-checkbox-off"
                className="cursor-pointer text-sm font-normal text-muted-foreground"
              >
                Не выбрано
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="ds-checkbox-disabled" disabled />
              <Label
                htmlFor="ds-checkbox-disabled"
                className="text-sm font-normal text-muted-foreground"
              >
                Выключен
              </Label>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 border-t py-3">
            <div className="space-y-0.5">
              <Label htmlFor="ds-switch">Сбои источников</Label>
              <p className="text-sm text-muted-foreground">
                Письмо, если источник перестал отдавать данные.
              </p>
            </div>
            <Switch
              id="ds-switch"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>
        </div>
      </DsBlock>

      <DsBlock
        title="Tabs"
        hint="Дорожка на bg-muted, активный таб поднимается на bg-background с тенью. Используются в настройках."
      >
        <Tabs defaultValue="profile" className="space-y-4">
          <TabsList>
            <TabsTrigger value="profile">Профиль</TabsTrigger>
            <TabsTrigger value="api">API</TabsTrigger>
            <TabsTrigger value="notifications">Уведомления</TabsTrigger>
          </TabsList>
          <TabsContent value="profile">
            <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
              Содержимое вкладки «Профиль».
            </div>
          </TabsContent>
          <TabsContent value="api">
            <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
              Содержимое вкладки «API».
            </div>
          </TabsContent>
          <TabsContent value="notifications">
            <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
              Содержимое вкладки «Уведомления».
            </div>
          </TabsContent>
        </Tabs>
      </DsBlock>
    </>
  )
}
