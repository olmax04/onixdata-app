import { DsBlock } from "@/components/design-system/section"
import { cn } from "@/lib/utils"

interface Step {
  token: string
  px: string
  bar: string
  usage: string
}

const steps: Step[] = [
  {
    token: "1 / 0.25rem",
    px: "4px",
    bar: "w-1",
    usage: "gap-1 у иконки с числом, space-y-1 внутри пары «значение + тренд».",
  },
  {
    token: "1.5 / 0.375rem",
    px: "6px",
    bar: "w-1.5",
    usage:
      "gap-1.5 в бейджах со точкой, space-y-1.5 — поле формы (лейбл + контрол).",
  },
  {
    token: "2 / 0.5rem",
    px: "8px",
    bar: "w-2",
    usage: "gap-2 — самый частый шаг: иконка и текст, кнопки в ряд.",
  },
  {
    token: "3 / 0.75rem",
    px: "12px",
    bar: "w-3",
    usage: "gap-3 — колонки фильтров, p-3 в компактных карточках.",
  },
  {
    token: "4 / 1rem",
    px: "16px",
    bar: "w-4",
    usage:
      "gap-4 между карточками в сетке, space-y-4 в формах, p-4 у main на мобильных.",
  },
  {
    token: "6 / 1.5rem",
    px: "24px",
    bar: "w-6",
    usage: "space-y-6 между секциями страницы, p-6 внутри карточки, p-6 у main с sm.",
  },
]

interface Pattern {
  name: string
  code: string
  where: string
}

const patterns: Pattern[] = [
  {
    name: "Рабочая область страницы",
    code: "flex-1 space-y-6 p-4 sm:p-6",
    where: "<main> на каждой странице дашборда — единый ритм и поля.",
  },
  {
    name: "Полоса метрик",
    code: "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4",
    where: "Четыре MetricCard: 1 → 2 → 4 колонки.",
  },
  {
    name: "Сетка 2/3 + 1/3",
    code: "grid grid-cols-1 gap-4 lg:grid-cols-3 + lg:col-span-2",
    where: "График и топ слов; таблица сообщений и статус источников.",
  },
  {
    name: "Форма",
    code: "space-y-4 (на /register — space-y-3.5)",
    where:
      "Расстояние между полями. Регистрация на шаг плотнее: полей вдвое больше.",
  },
  {
    name: "Поле формы",
    code: "space-y-2 (FormItem) или space-y-1.5",
    where:
      "space-y-2 по умолчанию; 1.5 — в auth-формах, где лейбл скрыт (sr-only).",
  },
  {
    name: "Шапка страницы с действием",
    code: "flex flex-wrap items-center justify-between gap-3",
    where: "Заголовок слева, кнопка справа; на узком экране переносится.",
  },
  {
    name: "Пункт навигации",
    code: "flex items-center gap-3 rounded-lg px-3 py-2",
    where: "Сайдбар: иконка + подпись.",
  },
  {
    name: "Топбар",
    code: "flex h-16 items-center gap-2 px-4 sm:gap-3 sm:px-6",
    where: "Фиксированная высота 64px, поля синхронны с main.",
  },
]

export function SpacingScale() {
  return (
    <>
      <DsBlock
        title="Шкала"
        hint="Базовая сетка Tailwind — 4px. Используются шесть ступеней; половинные (1.5, 3.5) появляются там, где целая ступень ломает ритм."
      >
        <div className="divide-y rounded-xl border bg-card">
          {steps.map((step) => (
            <div key={step.token} className="flex items-center gap-4 p-3">
              <div className="flex w-32 shrink-0 items-center gap-2">
                <span
                  aria-hidden="true"
                  className={cn("h-4 bg-primary", step.bar)}
                />
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {step.px}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-mono text-xs">{step.token}</p>
                <p className="text-xs text-muted-foreground">{step.usage}</p>
              </div>
            </div>
          ))}
        </div>
      </DsBlock>

      <DsBlock
        title="Паттерны раскладки"
        hint="Повторяющиеся связки классов. Новый экран собирается из них, а не из подобранных на глаз отступов."
      >
        <div className="grid gap-3 md:grid-cols-2">
          {patterns.map((pattern) => (
            <div key={pattern.name} className="space-y-1 rounded-lg border bg-card p-3">
              <p className="text-sm font-medium">{pattern.name}</p>
              <p className="break-words font-mono text-xs text-muted-foreground">
                {pattern.code}
              </p>
              <p className="text-xs text-muted-foreground">{pattern.where}</p>
            </div>
          ))}
        </div>
      </DsBlock>
    </>
  )
}
