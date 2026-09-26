/**
 * OnixData — реестр цветовых токенов дизайн-системы.
 *
 * ЕДИНСТВЕННОЕ место в проекте, где допустимы HEX-литералы: они нужны только
 * для подписей на странице /design-system и в docs/design-system.md.
 * Значения обязаны совпадать с комментариями в app/globals.css.
 * В компонентах цвет берётся Tailwind-классом либо `hsl(var(--…))`.
 */

import type { Sentiment, SourceStatus } from "@/lib/mock-data"

export interface DesignToken {
  /** Имя CSS-переменной, например `--background`. */
  name: string
  /** Значение как в globals.css: три компонента HSL без `hsl()`. */
  hsl: string
  /** То же значение в HEX — только для документации. */
  hex: string
  /** Типичный Tailwind-класс, через который токен попадает в разметку. */
  tailwind: string
  /** Назначение и правило использования. */
  usage: string
}

export interface TokenGroup {
  id: string
  title: string
  description: string
  tokens: DesignToken[]
}

export const tokenGroups: TokenGroup[] = [
  {
    id: "surfaces",
    title: "Поверхности и текст",
    description:
      "Почти монохромная нейтральная база. Слои различаются светлотой на 2–7%, границы — единственное, что отделяет карточку от фона.",
    tokens: [
      {
        name: "--background",
        hsl: "0 0% 5.5%",
        hex: "#0e0e0e",
        tailwind: "bg-background",
        usage:
          "Фон приложения и диалогов. Самый нижний слой, темнее его только сайдбар.",
      },
      {
        name: "--foreground",
        hsl: "0 0% 100%",
        hex: "#ffffff",
        tailwind: "text-foreground",
        usage: "Основной текст: заголовки, значения метрик, тело сообщений.",
      },
      {
        name: "--card",
        hsl: "0 0% 7.8%",
        hex: "#141414",
        tailwind: "bg-card",
        usage: "Фон карточек — базовый контейнер контента на всех экранах.",
      },
      {
        name: "--card-foreground",
        hsl: "0 0% 100%",
        hex: "#ffffff",
        tailwind: "text-card-foreground",
        usage: "Текст внутри карточки. Совпадает с --foreground.",
      },
      {
        name: "--popover",
        hsl: "0 0% 7.8%",
        hex: "#141414",
        tailwind: "bg-popover",
        usage:
          "Фон всплывающих слоёв: DropdownMenu, SelectContent. Тот же уровень, что и карточка.",
      },
      {
        name: "--popover-foreground",
        hsl: "0 0% 100%",
        hex: "#ffffff",
        tailwind: "text-popover-foreground",
        usage: "Текст во всплывающих слоях.",
      },
      {
        name: "--secondary",
        hsl: "0 0% 12.2%",
        hex: "#1f1f1f",
        tailwind: "bg-secondary",
        usage:
          "Вторичные кнопки и бейджи статусов/тегов. Заметно светлее карточки, читается как «плашка».",
      },
      {
        name: "--secondary-foreground",
        hsl: "0 0% 98%",
        hex: "#fafafa",
        tailwind: "text-secondary-foreground",
        usage: "Текст на secondary-поверхности.",
      },
      {
        name: "--muted",
        hsl: "0 0% 9.8%",
        hex: "#191919",
        tailwind: "bg-muted",
        usage:
          "Приглушённый фон: дорожка TabsList, поиск в мок-скриншоте, hover строки таблицы через bg-muted/50.",
      },
      {
        name: "--muted-foreground",
        hsl: "226.2 8.5% 70%",
        hex: "#acafb9",
        tailwind: "text-muted-foreground",
        usage:
          "Второстепенный текст: подписи, описания карточек, плейсхолдеры, заголовки колонок, статус «на паузе».",
      },
      {
        name: "--accent",
        hsl: "0 0% 12.5%",
        hex: "#202020",
        tailwind: "bg-accent",
        usage:
          "Subtle hover-фон для ghost/outline-кнопок и пунктов меню. Это НЕ бренд-акцент.",
      },
      {
        name: "--accent-foreground",
        hsl: "0 0% 100%",
        hex: "#ffffff",
        tailwind: "text-accent-foreground",
        usage: "Текст на accent-фоне при наведении.",
      },
    ],
  },
  {
    id: "brand",
    title: "Бренд и фокус",
    description:
      "Коралл — единственный хроматический акцент системы. Применяется точечно: ключевые CTA, активные состояния, данные графиков, позитивная тональность.",
    tokens: [
      {
        name: "--primary",
        hsl: "8.7 100% 72.9%",
        hex: "#ff8975",
        tailwind: "bg-primary / text-primary",
        usage:
          "Бренд-акцент. Основная кнопка, активная точка статуса, позитивный тренд, ссылки в auth, заливка графика.",
      },
      {
        name: "--primary-foreground",
        hsl: "0 0% 5.1%",
        hex: "#0d0d0d",
        tailwind: "text-primary-foreground",
        usage:
          "Текст на коралловой плашке. Тёмный, а не белый — контраст на светлом коралле.",
      },
      {
        name: "--ring",
        hsl: "8.7 100% 72.9%",
        hex: "#ff8975",
        tailwind: "ring-ring",
        usage:
          "Кольцо фокуса. Совпадает с --primary, поэтому фокус читается как бренд-состояние.",
      },
    ],
  },
  {
    id: "status",
    title: "Ошибки",
    description:
      "Единственный статусный цвет помимо коралла. Зелёного success и жёлтого warning в системе нет.",
    tokens: [
      {
        name: "--destructive",
        hsl: "358.1 75.1% 59%",
        hex: "#e5484d",
        tailwind: "bg-destructive / text-destructive",
        usage:
          "Ошибка источника, деструктивный пункт меню, сообщение валидации, невалидная рамка поля.",
      },
      {
        name: "--destructive-foreground",
        hsl: "0 0% 100%",
        hex: "#ffffff",
        tailwind: "text-destructive-foreground",
        usage: "Текст на красной плашке.",
      },
    ],
  },
  {
    id: "lines",
    title: "Границы",
    description:
      "Обе переменные равны: рамка поля и рамка карточки — одна линия. Глобально `* { @apply border-border }`.",
    tokens: [
      {
        name: "--border",
        hsl: "0 0% 17.3%",
        hex: "#2c2c2c",
        tailwind: "border-border",
        usage:
          "Разделители, рамки карточек, границы таблиц, топбара и сайдбара.",
      },
      {
        name: "--input",
        hsl: "0 0% 17.3%",
        hex: "#2c2c2c",
        tailwind: "border-input",
        usage:
          "Рамка полей ввода, SelectTrigger и outline-кнопок; фон невключённого Switch.",
      },
    ],
  },
  {
    id: "charts",
    title: "Палитра графиков",
    description:
      "Ряд 1 — коралл, остальные уходят в нейтраль. Порядок задаёт приоритет: первый ряд всегда самый важный.",
    tokens: [
      {
        name: "--chart-1",
        hsl: "8.7 100% 72.9%",
        hex: "#ff8975",
        tailwind: "text-chart-1 / hsl(var(--chart-1))",
        usage:
          "Основной ряд данных: линия и градиентная заливка графика упоминаний, спарклайны метрик.",
      },
      {
        name: "--chart-2",
        hsl: "225 8.7% 91%",
        hex: "#e6e7ea",
        tailwind: "text-chart-2",
        usage: "Второй ряд — светло-серый, для сравнения с основным.",
      },
      {
        name: "--chart-3",
        hsl: "226.7 3.8% 53.1%",
        hex: "#83858c",
        tailwind: "text-chart-3",
        usage: "Третий ряд — средний серый.",
      },
      {
        name: "--chart-4",
        hsl: "8.6 50.7% 57.1%",
        hex: "#c96a5a",
        tailwind: "text-chart-4",
        usage:
          "Приглушённый коралл — второй «брендовый» ряд, когда нужно два оттенка одной семьи.",
      },
      {
        name: "--chart-5",
        hsl: "228 5.2% 38%",
        hex: "#5c5e66",
        tailwind: "text-chart-5",
        usage: "Пятый ряд — тёмно-серый, фоновые и справочные значения.",
      },
    ],
  },
  {
    id: "sidebar",
    title: "Сайдбар",
    description:
      "Отдельный набор: сайдбар темнее приложения и держит собственные hover/active-состояния.",
    tokens: [
      {
        name: "--sidebar-background",
        hsl: "0 0% 4.3%",
        hex: "#0b0b0b",
        tailwind: "bg-sidebar",
        usage: "Фон навигационной колонки — самый тёмный слой интерфейса.",
      },
      {
        name: "--sidebar-foreground",
        hsl: "225 8.7% 91%",
        hex: "#e6e7ea",
        tailwind: "text-sidebar-foreground",
        usage: "Имя пользователя и прочий текст сайдбара.",
      },
      {
        name: "--sidebar-primary",
        hsl: "8.7 100% 72.9%",
        hex: "#ff8975",
        tailwind: "text-sidebar-primary",
        usage: "Иконка активного пункта навигации.",
      },
      {
        name: "--sidebar-primary-foreground",
        hsl: "0 0% 5.1%",
        hex: "#0d0d0d",
        tailwind: "text-sidebar-primary-foreground",
        usage: "Текст на коралловой плашке внутри сайдбара.",
      },
      {
        name: "--sidebar-accent",
        hsl: "0 0% 9.8%",
        hex: "#191919",
        tailwind: "bg-sidebar-accent",
        usage:
          "Фон активного пункта; hover даёт bg-sidebar-accent/60 — полшага до активного состояния.",
      },
      {
        name: "--sidebar-accent-foreground",
        hsl: "0 0% 100%",
        hex: "#ffffff",
        tailwind: "text-sidebar-accent-foreground",
        usage: "Текст активного и наведённого пункта навигации.",
      },
      {
        name: "--sidebar-border",
        hsl: "0 0% 12.9%",
        hex: "#212121",
        tailwind: "border-sidebar-border",
        usage:
          "Правая граница сайдбара и линия над блоком пользователя. Светлее общего --border.",
      },
      {
        name: "--sidebar-ring",
        hsl: "8.7 100% 72.9%",
        hex: "#ff8975",
        tailwind: "ring-sidebar-ring",
        usage: "Кольцо фокуса внутри сайдбара.",
      },
    ],
  },
]

const tokensByName = new Map(
  tokenGroups.flatMap((group) => group.tokens.map((token) => [token.name, token]))
)

/** Достаёт токен по имени переменной — чтобы HEX не дублировался по компонентам. */
export function getToken(name: string): DesignToken {
  const token = tokensByName.get(name)

  if (!token) {
    throw new Error(`Неизвестный токен: ${name}`)
  }

  return token
}

export interface SemanticRow<TKey extends string> {
  key: TKey
  label: string
  value: string
  rule: string
}

/** Статусы источника: active → primary, paused → muted, error → destructive. */
export const statusSemantics: SemanticRow<SourceStatus>[] = [
  {
    key: "active",
    label: "active — «Активен»",
    value: "bg-primary",
    rule: "Коралловая точка + Badge secondary. Единственный статус, которому положен бренд-цвет.",
  },
  {
    key: "paused",
    label: "paused — «На паузе»",
    value: "bg-muted-foreground",
    rule: "Серая точка + Badge secondary. Пауза — это не ошибка, цвет нейтральный.",
  },
  {
    key: "error",
    label: "error — «Ошибка»",
    value: "bg-destructive",
    rule: "Badge destructive без точки: сама плашка уже красная.",
  },
]

/** Тональность сообщения: позитив — коралл, нейтраль — плашка, негатив — контур. */
export const sentimentSemantics: SemanticRow<Sentiment>[] = [
  {
    key: "positive",
    label: "positive — «Позитив»",
    value: "Badge (default)",
    rule: "Коралловая заливка. Позитив — единственная тональность с бренд-акцентом.",
  },
  {
    key: "neutral",
    label: "neutral — «Нейтрально»",
    value: "Badge secondary",
    rule: "Серая плашка — тональность по умолчанию.",
  },
  {
    key: "negative",
    label: "negative — «Негатив»",
    value: "Badge outline",
    rule: "Только текст и контур. Негатив не красят в destructive: это не ошибка системы.",
  },
]


export interface AlphaToken {
  value: string
  usage: string
}

/**
 * Полный список прозрачностей, встречающихся в коде приложения
 * (сама страница /design-system и её подкомпоненты не учитываются).
 * Набор закрыт: новых ступеней не заводим.
 */
export const alphaTokens: AlphaToken[] = [
  {
    value: "bg-primary/10",
    usage:
      "Подложка иконки на экране успеха, активный пункт и пилюля тренда в мок-скриншоте, фон Skeleton.",
  },
  {
    value: "bg-primary/20",
    usage: "Дорожка Progress под коралловым индикатором.",
  },
  {
    value: "bg-primary/35",
    usage: "Третья, самая тихая точка источника в мок-скриншоте.",
  },
  {
    value: "bg-primary/50",
    usage: "Полоска активного пункта навигации в мок-скриншоте.",
  },
  { value: "bg-primary/60", usage: "Вторая точка источника в мок-скриншоте." },
  { value: "hover:bg-primary/80", usage: "Hover коралловых бейджей." },
  { value: "hover:bg-primary/90", usage: "Hover основной кнопки." },
  {
    value: "hover:bg-secondary/80",
    usage: "Hover вторичной кнопки и вторичного бейджа.",
  },
  { value: "hover:bg-destructive/80", usage: "Hover бейджа ошибки." },
  { value: "hover:bg-destructive/90", usage: "Hover деструктивной кнопки." },
  {
    value: "hsl(var(--primary) / 0.14) и / 0.07",
    usage: "Два радиальных градиента утилиты .onix-glow на auth-экранах.",
  },
  {
    value: "hsl(var(--primary) / 0.45)",
    usage: "Кольцо .auth-ring вокруг иконки на экране успеха.",
  },
  {
    value: "border-white/10, border-white/5",
    usage:
      "Границы мок-карточек, лежащих поверх коралловой панели: --border на бренд-фоне не читается.",
  },
  {
    value: "from-white/10 → to-[hsl(var(--primary-foreground)/0.15)]",
    usage: "Диагональный градиент поверх коралловой панели auth.",
  },
  {
    value: "shadow-black/30, shadow-black/40",
    usage: "Тени тех же мок-карточек — отрыв от коралловой плоскости.",
  },
  {
    value: "bg-background/80 + supports-[backdrop-filter]:bg-background/60",
    usage: "Полупрозрачный топбар с backdrop-blur.",
  },
  { value: "bg-muted/50", usage: "Hover строки таблицы и фон TableFooter." },
  { value: "bg-black/80", usage: "Оверлей Dialog и Sheet." },
  { value: "border-border/50", usage: "Рамка тултипа графика." },
  {
    value: "stroke-border/50",
    usage: "Линии сетки recharts, перекрашенные внутри ChartContainer.",
  },
  {
    value: "bg-sidebar-accent/60",
    usage: "Hover пункта навигации — полшага до активного состояния.",
  },
  {
    value: "bg-muted-foreground/35, bg-muted-foreground/20",
    usage: "Неактивные маркеры и полоски в мок-скриншоте auth.",
  },
  {
    value: "text-primary-foreground/70",
    usage: "Подзаголовок на коралловой панели auth.",
  },
]
