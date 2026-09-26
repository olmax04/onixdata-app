import { DsBlock } from "@/components/design-system/section"

const breakpoints: { name: string; width: string; rule: string }[] = [
  {
    name: "база",
    width: "< 640px",
    rule: "Одна колонка. Сайдбар — только в Sheet, поиск в топбаре скрыт, кнопка «Новая задача» превращается в icon-кнопку.",
  },
  {
    name: "sm",
    width: "≥ 640px",
    rule: "Поля main растут до p-6, метрики встают в две колонки, заголовок страницы — text-lg, появляется кнопка с подписью.",
  },
  {
    name: "md",
    width: "≥ 768px",
    rule: "Появляется поиск в топбаре (w-56).",
  },
  {
    name: "lg",
    width: "≥ 1024px",
    rule: "Постоянный сайдбар w-64 вместо Sheet; auth разъезжается на две колонки и показывает коралловую панель; сетки 2/3 + 1/3; поиск в топбаре расширяется до w-72.",
  },
  {
    name: "xl",
    width: "≥ 1280px",
    rule: "Метрики в четыре колонки.",
  },
]

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md border border-dashed px-2 py-1 text-[0.7rem] text-muted-foreground">
      {children}
    </span>
  )
}

export function LayoutSketches() {
  return (
    <>
      <DsBlock
        title="Auth — две колонки"
        hint="lg:grid lg:grid-cols-2 lg:gap-3 lg:p-3. Слева форма шириной max-w-[25rem] на фоне .onix-glow, справа липкая коралловая панель rounded-[2rem] с мок-скриншотом. До lg правая колонка скрыта целиком."
      >
        <div className="grid gap-3 rounded-xl border bg-card p-3 lg:grid-cols-2">
          <div className="onix-glow flex min-h-[13rem] flex-col justify-between rounded-lg border border-dashed p-4">
            <Chip>BrandLogo · size 30</Chip>
            <div className="mx-auto w-full max-w-[16rem] space-y-2">
              <div className="h-6 rounded-md bg-muted" />
              <div className="h-3 w-3/4 rounded-md bg-muted" />
              <div className="h-9 rounded-md border" />
              <div className="h-9 rounded-md border" />
              <div className="h-9 rounded-md bg-primary" />
            </div>
            <Chip>© · text-xs muted</Chip>
          </div>

          <div className="relative flex min-h-[13rem] items-center justify-center overflow-hidden rounded-[2rem] bg-primary p-6 text-primary-foreground">
            <div className="w-full max-w-[15rem] space-y-3">
              <div className="rounded-2xl border border-white/10 bg-card p-3 shadow-2xl shadow-black/30">
                <div className="h-2 w-16 rounded-full bg-muted-foreground/20" />
                <div className="mt-2 h-10 rounded-md bg-primary/10" />
              </div>
              <p className="text-center text-sm font-semibold">
                Мок-скриншот + карточка-метрика
              </p>
            </div>
          </div>
        </div>
      </DsBlock>

      <DsBlock
        title="Dashboard shell"
        hint="Сайдбар w-64 (sticky, h-screen) → топбар h-16 (sticky, blur) → main flex-1 space-y-6 p-4 sm:p-6. До lg сайдбар живёт в Sheet, который открывает icon-кнопка с aria-label."
      >
        <div className="flex min-h-[15rem] overflow-hidden rounded-xl border bg-card">
          <div className="hidden w-40 shrink-0 flex-col justify-between border-r border-sidebar-border bg-sidebar p-3 sm:flex">
            <div className="space-y-2">
              <Chip>BrandLogo</Chip>
              <div className="h-7 rounded-lg bg-sidebar-accent" />
              <div className="h-7 rounded-lg" />
              <div className="h-7 rounded-lg" />
            </div>
            <Chip>Пользователь</Chip>
          </div>

          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b bg-background/80 px-4 backdrop-blur">
              <Chip>h1 · Обзор</Chip>
              <Chip>поиск · CTA · уведомления · аватар</Chip>
            </div>
            <div className="flex-1 space-y-3 p-4">
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                <div className="h-12 rounded-xl border" />
                <div className="h-12 rounded-xl border" />
                <div className="hidden h-12 rounded-xl border xl:block" />
                <div className="hidden h-12 rounded-xl border xl:block" />
              </div>
              <div className="grid gap-3 lg:grid-cols-3">
                <div className="h-20 rounded-xl border lg:col-span-2" />
                <div className="h-20 rounded-xl border" />
              </div>
            </div>
          </div>
        </div>
      </DsBlock>

      <DsBlock
        title="Брейкпоинты"
        hint="Значения Tailwind по умолчанию. 2xl в проекте не используется."
      >
        <div className="divide-y rounded-xl border bg-card">
          {breakpoints.map((item) => (
            <div key={item.name} className="flex gap-4 p-3">
              <div className="w-20 shrink-0">
                <p className="font-mono text-xs font-medium">{item.name}</p>
                <p className="font-mono text-xs tabular-nums text-muted-foreground">
                  {item.width}
                </p>
              </div>
              <p className="min-w-0 flex-1 text-xs text-muted-foreground">
                {item.rule}
              </p>
            </div>
          ))}
        </div>
      </DsBlock>
    </>
  )
}
