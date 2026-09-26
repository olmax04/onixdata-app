import { DsBlock } from "@/components/design-system/section"

interface StateRow {
  element: string
  hover: string
  focus: string
  active: string
  disabled: string
  invalid: string
}

/*
 * Тот же список, что в docs/design-system.md → «5. Состояния».
 * Значения выводятся текстом, в className не попадают, так что ограничение
 * Tailwind на сканирование lib/ здесь не действует. Массив живёт рядом с
 * компонентом просто для единообразия с type-scale.tsx, где оно действует.
 */
const rows: StateRow[] = [
  {
    element: "Button default",
    hover: "hover:bg-primary/90",
    focus: "ring-1 ring-ring",
    active: "— (в auth: active:scale-[0.98])",
    disabled: "opacity-50 + pointer-events-none",
    invalid: "—",
  },
  {
    element: "Button secondary",
    hover: "hover:bg-secondary/80",
    focus: "ring-1 ring-ring",
    active: "—",
    disabled: "opacity-50 + pointer-events-none",
    invalid: "—",
  },
  {
    element: "Button outline / ghost",
    hover: "hover:bg-accent hover:text-accent-foreground",
    focus: "ring-1 ring-ring",
    active: "—",
    disabled: "opacity-50 + pointer-events-none",
    invalid: "—",
  },
  {
    element: "Button destructive",
    hover: "hover:bg-destructive/90",
    focus: "ring-1 ring-ring",
    active: "—",
    disabled: "opacity-50 + pointer-events-none",
    invalid: "—",
  },
  {
    element: "Input / IconInput",
    hover: "— (transition-colors)",
    focus: "ring-1 ring-ring",
    active: "—",
    disabled: "opacity-50 + cursor-not-allowed",
    invalid:
      "только IconInput/PasswordInput: aria-[invalid=true]: border-destructive; кольцо только в фокусе — aria-[invalid=true]:focus-visible:ring-destructive. Базовый Input невалидность не подсвечивает, aria-invalid ставит FormControl",
  },
  {
    element: "SelectTrigger",
    hover: "—",
    focus: "focus:ring-1 focus:ring-ring",
    active: "data-[state=open] раскрывает список",
    disabled: "opacity-50 + cursor-not-allowed",
    invalid: "как у Input (через FormControl)",
  },
  {
    element: "Пункт навигации",
    hover: "hover:bg-sidebar-accent/60",
    focus: "ring-1 ring-sidebar-ring",
    active: "bg-sidebar-accent + иконка text-sidebar-primary + aria-current",
    disabled: "—",
    invalid: "—",
  },
  {
    element: "Пункт меню / Select",
    hover: "focus:bg-accent focus:text-accent-foreground",
    focus: "то же (Radix ведёт фокус мышью и клавиатурой)",
    active: "—",
    disabled: "data-[disabled]: opacity-50 + pointer-events-none",
    invalid: "—",
  },
  {
    element: "Строка таблицы",
    hover: "hover:bg-muted/50",
    focus: "—",
    active: "data-[state=selected]:bg-muted",
    disabled: "—",
    invalid: "—",
  },
  {
    element: "TabsTrigger",
    hover: "—",
    focus: "ring-2 ring-ring ring-offset-2",
    active: "data-[state=active]: bg-background + shadow",
    disabled: "opacity-50 + pointer-events-none",
    invalid: "—",
  },
  {
    element: "Checkbox / Switch",
    hover: "—",
    focus: "Checkbox ring-1, Switch ring-2 + ring-offset-2",
    active: "data-[state=checked]:bg-primary",
    disabled: "opacity-50 + cursor-not-allowed",
    invalid: "—",
  },
  {
    element: "Badge",
    hover: "hover:bg-…/80 у заливок (primary, secondary, destructive)",
    focus: "focus:ring-2 focus:ring-ring + ring-offset-2",
    active: "—",
    disabled: "—",
    invalid: "—",
  },
]

export function StatesTable() {
  return (
    <DsBlock
      title="Матрица состояний"
      hint="Фокус всегда коралловый (--ring совпадает с --primary) и рисуется только focus-visible — мышью кольцо не появляется. Выключенный элемент гасится до opacity-50 и перестаёт ловить события."
    >
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[52rem] caption-bottom text-sm">
          <thead className="[&_tr]:border-b">
            <tr className="border-b">
              <th className="h-10 min-w-[10rem] px-3 text-left align-middle font-medium text-muted-foreground">
                Элемент
              </th>
              <th className="h-10 min-w-[11rem] px-3 text-left align-middle font-medium text-muted-foreground">
                Hover
              </th>
              <th className="h-10 min-w-[9rem] px-3 text-left align-middle font-medium text-muted-foreground">
                Focus-visible
              </th>
              <th className="h-10 min-w-[11rem] px-3 text-left align-middle font-medium text-muted-foreground">
                Active
              </th>
              <th className="h-10 min-w-[11rem] px-3 text-left align-middle font-medium text-muted-foreground">
                Disabled
              </th>
              <th className="h-10 min-w-[13rem] px-3 text-left align-middle font-medium text-muted-foreground">
                Invalid
              </th>
            </tr>
          </thead>
          <tbody className="[&_tr:last-child]:border-0">
            {rows.map((row) => (
              <tr key={row.element} className="border-b">
                <td className="p-3 align-top text-sm font-medium">
                  {row.element}
                </td>
                <td className="p-3 align-top font-mono text-xs text-muted-foreground">
                  {row.hover}
                </td>
                <td className="p-3 align-top font-mono text-xs text-muted-foreground">
                  {row.focus}
                </td>
                <td className="p-3 align-top font-mono text-xs text-muted-foreground">
                  {row.active}
                </td>
                <td className="p-3 align-top font-mono text-xs text-muted-foreground">
                  {row.disabled}
                </td>
                <td className="p-3 align-top font-mono text-xs text-muted-foreground">
                  {row.invalid}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DsBlock>
  )
}
