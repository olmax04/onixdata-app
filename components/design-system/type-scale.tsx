import * as React from "react"

import { DsBlock } from "@/components/design-system/section"
import { cn } from "@/lib/utils"

interface TypeRole {
  name: string
  classes: string
  where: string
  sample: React.ReactNode
  /**
   * Литеральные классы для рендера образца. Могут отличаться от `classes`:
   * если роль описывает набор размеров (Micro) или добирает вес и семейство
   * для наглядности (Auth button, Mono), здесь стоит один конкретный вариант.
   */
  preview: string
}

/*
 * Тот же список, что в docs/design-system.md → «2.2. Типографика».
 * Массив живёт рядом с компонентом, а не в lib/: Tailwind сканирует только
 * pages/ components/ app/ src/, и классы из lib/ были бы вырезаны из сборки.
 */
const roles: TypeRole[] = [
  {
    name: "Display — заголовок auth",
    classes: "text-3xl font-semibold tracking-tight sm:text-[2rem]",
    where: "AuthHeading: единственный крупный текст в системе.",
    sample: "Вход в аккаунт.",
    preview: "text-3xl font-semibold tracking-tight sm:text-[2rem]",
  },
  {
    name: "Page title — заголовок страницы",
    classes: "text-base font-semibold sm:text-lg",
    where: "Topbar: h1 текущего раздела, растёт с sm.",
    sample: "Источники",
    preview: "text-base font-semibold sm:text-lg",
  },
  {
    name: "Section title — заголовок блока",
    classes: "text-lg font-semibold",
    where: "h2 над карточками на страницах дашборда.",
    sample: "Подключённые источники",
    preview: "text-lg font-semibold",
  },
  {
    name: "Card title",
    classes: "font-semibold leading-none tracking-tight",
    where: "CardTitle и DialogTitle (у диалога дополнительно text-lg).",
    sample: "Упоминания по часам",
    preview: "font-semibold leading-none tracking-tight",
  },
  {
    name: "Metric value",
    classes: "text-2xl font-semibold tabular-nums tracking-tight",
    where: "MetricCard: числовое значение метрики.",
    sample: "1 284 903",
    preview: "text-2xl font-semibold tabular-nums tracking-tight",
  },
  {
    name: "Body",
    classes: "text-sm",
    where: "Рабочий размер интерфейса: таблицы, описания, кнопки, поля.",
    sample: "Собираем только публичные сообщения.",
    preview: "text-sm",
  },
  {
    name: "Body medium",
    classes: "text-sm font-medium",
    where: "Названия сущностей в таблицах и списках, пункты навигации, лейблы.",
    sample: "Крипто Дайджест",
    preview: "text-sm font-medium",
  },
  {
    name: "Caption",
    classes: "text-xs text-muted-foreground",
    where: "Подписи под значением, handle источника, © в auth.",
    sample: "@crypto_digest_ru",
    preview: "text-xs text-muted-foreground",
  },
  {
    name: "Form message",
    classes: "text-[0.8rem] font-medium text-destructive",
    where: "FormMessage; FormDescription — тот же размер, но muted.",
    sample: "Введите корректный email",
    preview: "text-[0.8rem] font-medium text-destructive",
  },
  {
    name: "Auth button",
    classes: "text-[0.95rem]",
    where: "Крупные кнопки auth-форм высотой h-11.",
    sample: "Создать аккаунт",
    preview: "text-[0.95rem] font-medium",
  },
  {
    name: "Mono",
    classes: "font-mono tabular-nums",
    where: "Время, числа в таблицах, API-ключ, имена датасетов в мок-скриншоте.",
    sample: "14:32:08 · 128 450",
    preview: "font-mono text-sm tabular-nums",
  },
  {
    name: "Micro",
    classes: "text-[0.7rem] / text-[0.65rem] / text-[11px] / text-[10px]",
    where:
      "Только мок-скриншот на auth, счётчик в бейдже топбара и число в теге ключевого слова.",
    sample: "+18,2%",
    preview: "text-[0.7rem] font-medium text-primary",
  },
  {
    name: "Wordmark",
    classes: "text-[1.05rem] + font-bold / font-normal",
    where: "BrandLogo: «Onix» жирным, «Data» обычным, точка кораллом.",
    sample: (
      <>
        <b className="font-bold">Onix</b>
        <span className="font-normal">Data</span>
        <span className="text-primary">.</span>
      </>
    ),
    preview: "text-[1.05rem] leading-none",
  },
]

export function TypeScale() {
  return (
    <>
      <DsBlock
        title="Шрифт"
        hint="Inter Tight (400/500/600/700, latin + cyrillic) через next/font с переменной --font-inter-tight. На body: font-feature-settings «rlig» 1, «calt» 1 и -webkit-font-smoothing: antialiased."
      >
        <div className="rounded-xl border bg-card p-4">
          <p className="text-2xl tracking-tight">
            <span className="font-normal">Аа 400 </span>
            <span className="font-medium">Аа 500 </span>
            <span className="font-semibold">Аа 600 </span>
            <span className="font-bold">Аа 700</span>
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            Рабочие веса — 500 (medium) и 600 (semibold). 400 остаётся для
            длинного текста и «мягких» лейблов, 700 использован ровно один раз:
            слово «Onix» в вордмарке.
          </p>
        </div>
      </DsBlock>

      <DsBlock
        title="Роли"
        hint="Размеры не назначаются произвольно: у каждого есть роль и место, где он уже применён."
      >
        <div className="divide-y rounded-xl border bg-card">
          {roles.map((role) => (
            <div
              key={role.name}
              className="grid gap-3 p-4 md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] md:items-center"
            >
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-medium">{role.name}</p>
                <p className="break-words font-mono text-xs text-muted-foreground">
                  {role.classes}
                </p>
                <p className="text-xs text-muted-foreground">{role.where}</p>
              </div>
              <div className="min-w-0">
                <p className={cn("truncate", role.preview)}>{role.sample}</p>
              </div>
            </div>
          ))}
        </div>
      </DsBlock>
    </>
  )
}
