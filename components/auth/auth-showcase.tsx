"use client"

import { usePathname } from "next/navigation"
import { SearchIcon, TrendingUpIcon } from "lucide-react"

import { cn } from "@/lib/utils"

const showcaseCopy: Record<string, { title: string; subtitle: string }> = {
  "/login": {
    title: "Все публичные данные — в одном рабочем месте.",
    subtitle:
      "Viber и другие мессенджеры: сбор, мониторинг и рассылка из одного окна.",
  },
  "/register": {
    title: "Первый сбор — за пару минут.",
    subtitle:
      "Подключите группы Viber, задайте ключевые слова и следите за потоком.",
  },
  "/forgot-password": {
    title: "Доступ вернём быстро.",
    subtitle:
      "Ссылка для смены пароля придёт на почту и будет действовать 30 минут.",
  },
}

const fallbackCopy = showcaseCopy["/login"]

const navRows = [
  { id: "overview", width: "w-14", active: false },
  { id: "viber", width: "w-10", active: true },
  { id: "stream", width: "w-12", active: false },
  { id: "broadcast", width: "w-9", active: false },
  { id: "settings", width: "w-11", active: false },
]

const sourceRows = [
  {
    platform: "Viber",
    messages: "213 004",
    delta: "+12%",
    dot: "bg-primary",
  },
  {
    platform: "Telegram",
    messages: "128 450",
    delta: "+8%",
    dot: "bg-primary/60",
  },
  {
    platform: "WhatsApp",
    messages: "41 870",
    delta: "+3%",
    dot: "bg-primary/35",
  },
]

const chartLine =
  "M0 58 L24 51 L48 55 L72 43 L96 46 L120 35 L144 31 L168 34 L192 23 L216 19 L240 13 L260 8"
const chartArea = `${chartLine} L260 76 L0 76 Z`
const sparkLine = "M0 20 L12 16 L24 18 L36 11 L48 13 L60 7 L72 9 L84 3 L96 2"

function Hexagon({ className, size }: { className?: string; size: number }) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M50 2 93.3 26v48L50 98 6.7 74V26z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function AuthShowcase() {
  const pathname = usePathname()
  const copy = showcaseCopy[pathname] ?? fallbackCopy

  return (
    <aside className="hidden lg:block">
      <div className="sticky top-3 flex h-[calc(100vh-1.5rem)] flex-col items-center justify-center overflow-hidden rounded-[2rem] bg-primary px-10 py-12 text-primary-foreground">
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-[hsl(var(--primary-foreground)/0.15)]"
          aria-hidden="true"
        />

        <Hexagon
          size={260}
          className="auth-drift-1 pointer-events-none absolute -right-16 -top-20 opacity-[0.14]"
        />
        <Hexagon
          size={180}
          className="auth-drift-2 pointer-events-none absolute -bottom-16 -left-14 opacity-[0.16]"
        />
        <Hexagon
          size={120}
          className="auth-drift-3 pointer-events-none absolute -right-8 bottom-24 opacity-[0.12]"
        />

        <div className="relative flex w-full max-w-[28rem] flex-col items-center">
          <div className="relative mb-14 w-full" aria-hidden="true">
            <div className="auth-rise rounded-2xl border border-white/10 bg-card text-card-foreground shadow-2xl shadow-black/30">
              <div className="flex">
                <div className="w-[4.75rem] shrink-0 space-y-1.5 border-r border-white/10 p-3">
                  {navRows.map((row) => (
                    <div
                      key={row.id}
                      className={cn(
                        "flex items-center gap-1.5 rounded-md px-1.5 py-1.5",
                        row.active && "bg-primary/10"
                      )}
                    >
                      <span
                        className={cn(
                          "size-2.5 shrink-0 rounded-[3px]",
                          row.active ? "bg-primary" : "bg-muted-foreground/35"
                        )}
                      />
                      <span
                        className={cn(
                          "h-1.5 rounded-full",
                          row.width,
                          row.active ? "bg-primary/50" : "bg-muted-foreground/20"
                        )}
                      />
                    </div>
                  ))}
                </div>

                <div className="min-w-0 flex-1 space-y-3.5 p-4">
                  <div className="flex h-8 items-center gap-2 rounded-lg border border-white/5 bg-muted px-2.5">
                    <SearchIcon
                      className="size-3.5 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <span className="truncate text-[0.7rem] text-muted-foreground">
                      Поиск по группам и сообщениям
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {sourceRows.map((row) => (
                      <div
                        key={row.platform}
                        className="flex items-center gap-2 text-[0.7rem]"
                      >
                        <span
                          className={cn("size-1.5 rounded-full", row.dot)}
                          aria-hidden="true"
                        />
                        <span className="flex-1 truncate text-muted-foreground">
                          {row.platform}
                        </span>
                        <span className="tabular-nums text-foreground">
                          {row.messages}
                        </span>
                        <span className="w-9 text-right tabular-nums text-primary">
                          {row.delta}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2 border-t border-white/5 pt-3">
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <p className="text-[0.7rem] text-muted-foreground">
                          Упоминания за 30 дней
                        </p>
                        <p className="text-lg font-semibold leading-tight text-foreground">
                          384 209
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[0.65rem] font-medium text-primary">
                        <TrendingUpIcon className="size-3" aria-hidden="true" />
                        +18,2%
                      </span>
                    </div>

                    <svg
                      viewBox="0 0 260 76"
                      preserveAspectRatio="none"
                      className="h-20 w-full"
                      aria-hidden="true"
                    >
                      <defs>
                        <linearGradient
                          id="onix-auth-area"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="hsl(var(--primary))"
                            stopOpacity="0.4"
                          />
                          <stop
                            offset="100%"
                            stopColor="hsl(var(--primary))"
                            stopOpacity="0"
                          />
                        </linearGradient>
                      </defs>
                      <path
                        d={chartArea}
                        fill="url(#onix-auth-area)"
                        className="auth-area"
                      />
                      <path
                        d={chartLine}
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
                  </div>
                </div>
              </div>
            </div>

            {/* Карточка появляется следом за моком, потом очень мягко парит. */}
            <div className="auth-rise auth-rise-late absolute -bottom-8 -left-8 w-[11rem]">
              <div className="auth-float rounded-xl border border-white/10 bg-card p-3 text-card-foreground shadow-2xl shadow-black/40">
                <p className="truncate font-mono text-[0.7rem] text-muted-foreground">
                  viber_public_groups
                </p>
                <div className="mt-2 flex items-end justify-between gap-3">
                  <p className="text-base font-semibold leading-none tabular-nums text-foreground">
                    48 210
                  </p>
                  <svg
                    viewBox="0 0 96 24"
                    preserveAspectRatio="none"
                    className="h-6 w-16"
                    aria-hidden="true"
                  >
                    <path
                      d={sparkLine}
                      fill="none"
                      stroke="hsl(var(--primary))"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                      pathLength={1}
                      className="auth-line auth-line-late"
                    />
                  </svg>
                </div>
                <p className="mt-2 inline-flex items-center gap-1 text-[0.65rem] font-medium text-primary">
                  <TrendingUpIcon className="size-3" aria-hidden="true" />
                  +12,4% строк за неделю
                </p>
              </div>
            </div>
          </div>

          {/*
            Layout не размонтируется при переходах login ↔ register ↔ forgot,
            поэтому key={pathname} пересоздаёт узел и анимация играет заново.
            Мок-скриншот стоит выше по дереву и переход не задевает.

            min-h держит высоту блока по самому высокому варианту копирайта,
            иначе колонка перецентровывалась бы и мок прыгал по вертикали.
            Замерено в браузере: до xl максимум даёт /login (116px при 1024,
            заголовок в две строки), от xl — /register (124px).
          */}
          <div
            key={pathname}
            className="animate-in fade-in slide-in-from-bottom-1 min-h-[7.25rem] space-y-3 text-center duration-500 xl:min-h-[7.75rem]"
          >
            <h2 className="text-balance text-2xl font-semibold tracking-tight text-primary-foreground xl:text-3xl">
              {copy.title}
            </h2>
            <p className="text-balance text-sm text-primary-foreground/70">
              {copy.subtitle}
            </p>
          </div>
        </div>
      </div>
    </aside>
  )
}
