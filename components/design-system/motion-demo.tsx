"use client"

import * as React from "react"
import { PlayIcon } from "lucide-react"

import { authEnter, authFormMessage, authPress } from "@/components/auth/auth-motion"
import { DsBlock } from "@/components/design-system/section"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const cascade: { className: string; label: string; delay: string }[] = [
  { className: authEnter.logo, label: "Логотип", delay: "0 мс" },
  { className: authEnter.title, label: "Заголовок", delay: "55 мс" },
  { className: authEnter.description, label: "Подзаголовок", delay: "110 мс" },
  { className: authEnter.field, label: "Поля формы", delay: "165 мс" },
  { className: authEnter.aside, label: "Чекбокс и ссылка", delay: "220 мс" },
  { className: authEnter.submit, label: "Кнопка отправки", delay: "275 мс" },
  { className: authEnter.divider, label: "Разделитель «или»", delay: "330 мс" },
  { className: authEnter.oauth, label: "OAuth-кнопки", delay: "385 мс" },
  { className: authEnter.altAction, label: "Альтернативное действие", delay: "440 мс" },
  { className: authEnter.copyright, label: "Копирайт", delay: "495 мс" },
]

const rules = [
  {
    name: ".auth-enter + .auth-enter-1…10",
    value: "450 мс · cubic-bezier(0.16, 1, 0.3, 1) · шаг 55 мс · fill-mode: backwards",
    usage:
      "Каскад левой колонки auth. Ступени перечислены литералами в auth-motion.ts: Tailwind сканирует исходники как текст и вырезает классы, которых не нашёл.",
  },
  {
    name: ".auth-rise / .auth-rise-late",
    value: "700 мс · fade + zoom-in-95 + slide-in-from-bottom-4, задержка 250 мс",
    usage: "Появление мок-скриншота и догоняющей карточки-метрики.",
  },
  {
    name: ".auth-line / .auth-line-late",
    value: "900 мс · прорисовка 1 → 0 по stroke-dashoffset, старт 400 / 800 мс",
    usage:
      "На <path> стоит pathLength=1, поэтому длина нормализована и дистанцию считать не нужно.",
  },
  {
    name: ".auth-area",
    value: "500 мс · старт 1150 мс",
    usage: "Заливка под графиком проявляется уже после прорисовки линии.",
  },
  {
    name: ".auth-float",
    value: "6 с · ease-in-out · infinite · старт 1 с",
    usage: "Очень мягкое парение карточки-метрики на ±5px.",
  },
  {
    name: ".auth-drift-1/2/3",
    value: "24 с / 30 с / 19 с · alternate",
    usage: "Дрейф фоновых гексагонов на несколько пикселей.",
  },
  {
    name: ".auth-ring",
    value: "900 мс · один раз, старт 250 мс",
    usage: "Кольцо вокруг иконки на экране успеха — не бесконечный пульс.",
  },
  {
    name: "authPress",
    value: "active:scale-[0.98] с явным списком transition-свойств",
    usage:
      "Отклик крупных auth-кнопок. Свойства перечислены явно, иначе twMerge выкинул бы transition-colors из buttonVariants.",
  },
  {
    name: "authFormMessage",
    value: "animate-in fade-in slide-in-from-top-1 duration-200",
    usage: "Появление сообщения валидации под полем.",
  },
  {
    name: "animate-pulse",
    value: "бесконечно",
    usage:
      "Индикатор «в эфире» в панелях Viber (мониторинг и сбор) и фон Skeleton.",
  },
  {
    name: "transition-colors",
    value: "по умолчанию 150 мс",
    usage:
      "Все интерактивные элементы: кнопки, пункты навигации и меню, строки таблиц.",
  },
]

export function MotionDemo() {
  const [run, setRun] = React.useState(0)

  return (
    <>
      <DsBlock
        title="Каскад появления auth"
        hint="Десять ступеней по 55 мс: от логотипа до копирайта проходит ~495 мс. fill-mode: backwards обязателен — без него элемент видно в финальном состоянии до старта собственной анимации, и каскад превращается в мигание."
      >
        <div className="rounded-xl border bg-card p-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={authPress}
            onClick={() => setRun((value) => value + 1)}
          >
            <PlayIcon />
            Проиграть
          </Button>

          <div key={run} className="mt-4 space-y-2">
            {cascade.map((step) => (
              <div
                key={step.label}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2",
                  step.className
                )}
              >
                <span className="truncate text-sm">{step.label}</span>
                <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                  {step.delay}
                </span>
              </div>
            ))}
          </div>
        </div>
      </DsBlock>

      <DsBlock
        title="Прорисовка графика"
        hint="Та же связка, что на мок-скриншоте auth: линия рисуется, заливка проявляется следом."
      >
        <div key={`chart-${run}`} className="rounded-xl border bg-card p-4">
          <svg
            viewBox="0 0 260 76"
            preserveAspectRatio="none"
            className="h-24 w-full"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="ds-motion-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.4" />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d="M0 58 L24 51 L48 55 L72 43 L96 46 L120 35 L144 31 L168 34 L192 23 L216 19 L240 13 L260 8 L260 76 L0 76 Z"
              fill="url(#ds-motion-area)"
              className="auth-area"
            />
            <path
              d="M0 58 L24 51 L48 55 L72 43 L96 46 L120 35 L144 31 L168 34 L192 23 L216 19 L240 13 L260 8"
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              pathLength={1}
              className="auth-line"
            />
          </svg>
          <p className="mt-2 text-xs text-muted-foreground">
            Кнопка «Проиграть» переигрывает и этот блок: ремаунт по key —
            единственный способ отыграть CSS-анимацию заново.
          </p>
        </div>
      </DsBlock>

      <DsBlock
        title="Однократное кольцо и парение"
        hint="Кольцо отыгрывает один раз, карточка парит бесконечно — но амплитуда 5px, поэтому не отвлекает."
      >
        <div key={`loop-${run}`} className="flex flex-wrap items-center gap-6 rounded-xl border bg-card p-6">
          <div className="auth-ring animate-in zoom-in-50 relative flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary duration-500">
            <PlayIcon className="size-6" aria-hidden="true" />
          </div>
          <div className="auth-float w-44 rounded-xl border bg-background p-3">
            <p className="truncate font-mono text-[0.7rem] text-muted-foreground">
              viber_public_groups
            </p>
            <p className="mt-2 text-base font-semibold leading-none tabular-nums">
              48 210
            </p>
          </div>
          <p className={cn("text-[0.8rem] font-medium text-destructive", authFormMessage)}>
            Введите корректный email
          </p>
        </div>
      </DsBlock>

      <DsBlock
        title="Правила"
        hint="Длительности не изобретаются на месте: у каждого движения в системе есть имя."
      >
        <div className="divide-y rounded-xl border bg-card">
          {rules.map((rule) => (
            <div key={rule.name} className="space-y-1 p-3">
              <p className="break-words font-mono text-xs">{rule.name}</p>
              <p className="break-words text-xs text-muted-foreground">
                {rule.value}
              </p>
              <p className="text-xs text-muted-foreground">{rule.usage}</p>
            </div>
          ))}
        </div>
      </DsBlock>

      <DsBlock
        title="prefers-reduced-motion"
        hint="Глобальный блок в globals.css обнуляет длительности, счётчик повторов и задержки, а график показывает целиком."
      >
        <div className="space-y-2 rounded-xl border bg-card p-4 text-sm text-muted-foreground">
          <p>
            Каждое объявление внутри этого блока обязано быть{" "}
            <span className="font-mono text-xs">!important</span>: в собранном
            бандле блок оказывается выше вариантных и адаптивных утилит
            (active:scale, aria-[invalid], data-[state=open]:animate-in,
            min-width-медиа), а при равной специфичности выигрывает то, что
            ниже.
          </p>
          <p>
            Задержки тоже обнуляются: каскад держит стартовое состояние через{" "}
            <span className="font-mono text-xs">fill-mode: backwards</span>, и
            без сброса контент остался бы невидимым ещё почти секунду после
            загрузки.
          </p>
        </div>
      </DsBlock>
    </>
  )
}
