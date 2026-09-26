export const tocItems = [
  { id: "principles", label: "Принципы" },
  { id: "color", label: "Цвет" },
  { id: "typography", label: "Типографика" },
  { id: "spacing", label: "Spacing" },
  { id: "radius", label: "Радиусы" },
  { id: "elevation", label: "Поверхности" },
  { id: "icons", label: "Иконки" },
  { id: "motion", label: "Motion" },
  { id: "layout", label: "Layout" },
  { id: "states", label: "Состояния" },
  { id: "components", label: "Компоненты" },
] as const

export function Toc() {
  return (
    <nav aria-label="Разделы дизайн-системы" className="space-y-1">
      {tocItems.map((item) => (
        <a
          key={item.id}
          href={`#${item.id}`}
          className="block rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {item.label}
        </a>
      ))}
    </nav>
  )
}

export function TocInline() {
  return (
    <nav
      aria-label="Разделы дизайн-системы"
      className="flex flex-wrap gap-2 lg:hidden"
    >
      {tocItems.map((item) => (
        <a
          key={item.id}
          href={`#${item.id}`}
          className="rounded-md border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {item.label}
        </a>
      ))}
    </nav>
  )
}
