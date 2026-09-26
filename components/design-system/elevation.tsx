import { DsBlock } from "@/components/design-system/section"
import { getToken } from "@/lib/design-tokens"
import { cn } from "@/lib/utils"

/** HEX не дублируем — берём из реестра токенов по имени переменной. */
const layers: { name: string; token: string; usage: string }[] = [
  {
    name: "Сайдбар",
    token: "--sidebar-background",
    usage: "Самый нижний слой: навигация уходит глубже, чем контент.",
  },
  {
    name: "Фон приложения",
    token: "--background",
    usage: "Рабочая область, топбар (через background/80), DialogContent.",
  },
  {
    name: "Карточка / поповер",
    token: "--card",
    usage: "Контент лежит на карточке, всплывающие слои — на том же уровне.",
  },
  {
    name: "Muted",
    token: "--muted",
    usage: "Дорожка табов, hover строки таблицы, фон вложенных плашек.",
  },
  {
    name: "Secondary / accent",
    token: "--secondary",
    usage: "Вторичные кнопки и бейджи; --accent — на полшага светлее, hover-фон.",
  },
]

interface ShadowStep {
  name: string
  box: string
  usage: string
}

const shadows: ShadowStep[] = [
  {
    name: "shadow",
    box: "shadow",
    usage: "Card, основная кнопка, Badge, Checkbox, активный таб.",
  },
  {
    name: "shadow-sm",
    box: "shadow-sm",
    usage: "Инпуты, SelectTrigger, Switch, outline/secondary-кнопки.",
  },
  {
    name: "shadow-md",
    box: "shadow-md",
    usage: "SelectContent и DropdownMenuContent.",
  },
  {
    name: "shadow-lg",
    box: "shadow-lg",
    usage: "DialogContent, SheetContent, тост, подменю, thumb у Switch.",
  },
  {
    name: "shadow-xl",
    box: "shadow-xl",
    usage: "Тултип графика — единственное место.",
  },
  {
    name: "shadow-2xl shadow-black/30",
    box: "shadow-2xl shadow-black/30",
    usage:
      "Мок-карточки на коралловой панели: обычная тень на бренд-фоне не читается.",
  },
]

export function Elevation() {
  return (
    <>
      <DsBlock
        title="Слои"
        hint="Глубину задаёт светлота, а не тень: пять поверхностей в диапазоне 4,3–12,5% и одна линия границы --border."
      >
        <div className="divide-y rounded-xl border bg-card">
          {layers.map((layer) => {
            const token = getToken(layer.token)

            return (
              <div key={layer.token} className="flex items-center gap-4 p-3">
                <span
                  aria-hidden="true"
                  className="size-12 shrink-0 rounded-md border"
                  style={{ backgroundColor: `hsl(var(${token.name}))` }}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{layer.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {token.name} · {token.hex}
                  </p>
                  <p className="text-xs text-muted-foreground">{layer.usage}</p>
                </div>
              </div>
            )
          })}
        </div>
      </DsBlock>

      <DsBlock
        title="Тени"
        hint="Тень отделяет всплывающий слой от подложки. На плоском контенте её нет — там работает граница."
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {shadows.map((shadow) => (
            <div key={shadow.name} className="space-y-2">
              <div
                className={cn(
                  "flex h-16 items-center justify-center rounded-xl border bg-card font-mono text-xs",
                  shadow.box
                )}
              >
                {shadow.name}
              </div>
              <p className="text-xs text-muted-foreground">{shadow.usage}</p>
            </div>
          ))}
        </div>
      </DsBlock>

      <DsBlock
        title="Липкие поверхности"
        hint="Топбар и сайдбар не скроллятся вместе с контентом."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 rounded-lg border bg-card p-3">
            <p className="text-sm font-medium">Topbar</p>
            <p className="break-words font-mono text-xs text-muted-foreground">
              sticky top-0 z-30 border-b bg-background/80 backdrop-blur
              supports-[backdrop-filter]:bg-background/60
            </p>
          </div>
          <div className="space-y-1 rounded-lg border bg-card p-3">
            <p className="text-sm font-medium">Sidebar</p>
            <p className="break-words font-mono text-xs text-muted-foreground">
              w-64 border-r border-sidebar-border + внутренний sticky top-0
              h-screen
            </p>
          </div>
        </div>
      </DsBlock>

      <DsBlock
        title="onix-glow"
        hint="Утилита из globals.css: два радиальных градиента коралла (0.14 и 0.07) на фоне левой колонки auth. Единственный фоновый эффект системы."
      >
        <div className="onix-glow flex h-32 items-end rounded-xl border p-4">
          <p className="text-xs text-muted-foreground">
            .onix-glow — 60rem × 40rem at 50% -10% и 40rem × 30rem at 85% 15%
          </p>
        </div>
      </DsBlock>
    </>
  )
}
