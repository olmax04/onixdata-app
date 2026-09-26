import { DsBlock } from "@/components/design-system/section"
import { cn } from "@/lib/utils"

interface RadiusStep {
  name: string
  value: string
  box: string
  usage: string
}

const steps: RadiusStep[] = [
  {
    name: "rounded-sm",
    value: "calc(--radius - 4px) = 8px",
    box: "rounded-sm",
    usage: "Пункты меню и Select, Checkbox, кнопка закрытия диалога.",
  },
  {
    name: "rounded-md",
    value: "calc(--radius - 2px) = 10px",
    box: "rounded-md",
    usage:
      "Кнопки, инпуты, SelectTrigger, Badge, поповеры, Skeleton — самый частый радиус.",
  },
  {
    name: "rounded-lg",
    value: "--radius = 12px",
    box: "rounded-lg",
    usage: "Пункты навигации, TabsList, тултип графика, DialogContent с sm.",
  },
  {
    name: "rounded-xl",
    value: "12px (шкала Tailwind)",
    box: "rounded-xl",
    usage: "Card — базовый контейнер контента.",
  },
  {
    name: "rounded-2xl",
    value: "16px",
    box: "rounded-2xl",
    usage: "Мок-скриншот на auth-панели.",
  },
  {
    name: "rounded-[2rem]",
    value: "32px",
    box: "rounded-[2rem]",
    usage: "Коралловая панель auth — единственное место с таким радиусом.",
  },
  {
    name: "rounded-full",
    value: "9999px",
    box: "rounded-full",
    usage:
      "Аватары, точки статуса, пилюли, Progress, Switch, счётчик уведомлений.",
  },
]

export function RadiusScale() {
  return (
    <DsBlock
      title="Шкала"
      hint="Всё завязано на --radius: 0.75rem. Tailwind считает от него lg / md / sm; Card использует собственный rounded-xl."
    >
      <div className="divide-y rounded-xl border bg-card">
        {steps.map((step) => (
          <div key={step.name} className="flex items-center gap-4 p-3">
            <span
              aria-hidden="true"
              className={cn(
                "size-12 shrink-0 border bg-primary/10",
                step.box
              )}
            />
            <div className="min-w-0 flex-1">
              <p className="font-mono text-xs">{step.name}</p>
              <p className="font-mono text-xs text-muted-foreground">
                {step.value}
              </p>
              <p className="text-xs text-muted-foreground">{step.usage}</p>
            </div>
          </div>
        ))}
      </div>
    </DsBlock>
  )
}
