# Дизайн-система OnixData

Документ фиксирует то, что **уже есть в коде**: токены, шкалы, паттерны и
правила, по которым собраны экраны авторизации и дашборд. Это не предложение
изменить внешний вид, а описание существующих решений — чтобы новый экран
собирался из готовых кусков, а не подбирался на глаз.

Живой стайлгайд с теми же материалами: маршрут
[`/design-system`](../app/design-system/page.tsx).

Ключевые файлы:

| Файл                                                  | Что в нём                                             |
| ----------------------------------------------------- | ----------------------------------------------------- |
| [`app/globals.css`](../app/globals.css)               | CSS-переменные палитры, утилиты `.onix-glow`, анимации |
| [`tailwind.config.ts`](../tailwind.config.ts)         | Маппинг переменных в Tailwind-классы, радиусы, шрифт   |
| [`lib/design-tokens.ts`](../lib/design-tokens.ts)     | Реестр токенов с HEX/HSL — только для документации     |
| [`components/ui/`](../components/ui)                  | Базовые компоненты shadcn/ui, стиль `new-york`         |
| [`components/auth/auth-motion.ts`](../components/auth/auth-motion.ts) | Ступени каскада и классы отклика       |

---

## 1. Принципы

1. **Только тёмная тема.** На `<html>` жёстко стоит `className="dark"`, палитра
   продублирована в `:root` и `.dark`. Переключатель тем не нужен, «вспышки»
   светлого фона при загрузке нет.
2. **Коралл — точечно.** `--primary` (`#ff8975`) достаётся ключевым CTA,
   активным состояниям, данным графиков и позитивной тональности. Формулировка
   из кода: коралловый держим только за позитивной тональностью, «чтобы
   бренд-акцент не расползался по интерфейсу»
   ([`components/dashboard/badges.tsx`](../components/dashboard/badges.tsx)).
3. **`--accent` — это hover-фон, а не бренд.** Несмотря на имя, `--accent`
   (`#202020`) — subtle подложка наведения для ghost/outline и пунктов меню.
   Путать его с бренд-акцентом нельзя.
4. **Нейтральная почти-монохромная база.** Пять серых поверхностей в диапазоне
   светлоты 4,3–12,5% и одна линия границы `--border`. Глубину даёт светлота, а
   не тень.
5. **Нет зелёного success и жёлтого warning.** Позитив выражается кораллом,
   негатив — нейтрально (outline-бейдж), ошибка — `--destructive`. Третьего
   статусного цвета в системе не существует.
6. **Демо-режим виден.** Бэкенда нет: каждое действие отвечает тостом с
   пометкой «Демо-режим», описания карточек и диалогов честно предупреждают,
   что ничего не сохраняется и не отправляется.
7. **Русский интерфейс.** Копия, числа (`toLocaleString("ru-RU")`) и
   24-часовое время.
8. **Доступность по умолчанию.** `aria-label` на icon-кнопках, `sr-only`
   заголовки у `Sheet` и служебных колонок таблиц, кольцо `focus-visible`,
   `aria-current="page"` у активного пункта навигации, `aria-hidden` на
   декоративной графике, полное отключение анимаций по
   `prefers-reduced-motion`.

---

## 2. Foundations

### 2.1. Цвет

Все цвета живут в CSS-переменных и попадают в разметку Tailwind-классами.
HEX в компонентах не пишется: единственное место, где он допустим, —
`lib/design-tokens.ts` (нужен для подписей на странице стайлгайда). Значения
там сверены с комментариями в `globals.css` — расхождений нет.

#### Поверхности и текст

| Переменная             | HSL                | HEX       | Tailwind                | Назначение                                                                     |
| ---------------------- | ------------------ | --------- | ----------------------- | ------------------------------------------------------------------------------ |
| `--background`         | `0 0% 5.5%`        | `#0e0e0e` | `bg-background`         | Фон приложения и `DialogContent`. Ниже него только сайдбар.                     |
| `--foreground`         | `0 0% 100%`        | `#ffffff` | `text-foreground`       | Основной текст: заголовки, значения метрик, тело сообщений.                     |
| `--card`               | `0 0% 7.8%`        | `#141414` | `bg-card`               | Фон карточек — базовый контейнер контента.                                      |
| `--card-foreground`    | `0 0% 100%`        | `#ffffff` | `text-card-foreground`  | Текст внутри карточки.                                                          |
| `--popover`            | `0 0% 7.8%`        | `#141414` | `bg-popover`            | `DropdownMenuContent`, `SelectContent` — тот же уровень, что и карточка.         |
| `--popover-foreground` | `0 0% 100%`        | `#ffffff` | `text-popover-foreground` | Текст во всплывающих слоях.                                                   |
| `--secondary`          | `0 0% 12.2%`       | `#1f1f1f` | `bg-secondary`          | Вторичные кнопки, бейджи статусов и тегов.                                      |
| `--secondary-foreground` | `0 0% 98%`       | `#fafafa` | `text-secondary-foreground` | Текст на secondary-поверхности.                                             |
| `--muted`              | `0 0% 9.8%`        | `#191919` | `bg-muted`              | Дорожка `TabsList`, `bg-muted/50` — hover строки таблицы и фон `TableFooter`.    |
| `--muted-foreground`   | `226.2 8.5% 70%`   | `#acafb9` | `text-muted-foreground` | Второстепенный текст: подписи, описания, плейсхолдеры, заголовки колонок.        |
| `--accent`             | `0 0% 12.5%`       | `#202020` | `bg-accent`             | Subtle hover-фон ghost/outline-кнопок и пунктов меню. **Не бренд-акцент.**       |
| `--accent-foreground`  | `0 0% 100%`        | `#ffffff` | `text-accent-foreground` | Текст на accent-фоне при наведении.                                            |

#### Бренд и фокус

| Переменная             | HSL                | HEX       | Tailwind                     | Назначение                                                                 |
| ---------------------- | ------------------ | --------- | ---------------------------- | -------------------------------------------------------------------------- |
| `--primary`            | `8.7 100% 72.9%`   | `#ff8975` | `bg-primary` / `text-primary` | Бренд-акцент: основная кнопка, активная точка статуса, позитивный тренд, ссылки в auth, линия графика. |
| `--primary-foreground` | `0 0% 5.1%`        | `#0d0d0d` | `text-primary-foreground`    | Текст на коралловой плашке. Тёмный, не белый — контраст на светлом коралле.  |
| `--ring`               | `8.7 100% 72.9%`   | `#ff8975` | `ring-ring`                  | Кольцо фокуса; совпадает с `--primary`, поэтому фокус читается как бренд.    |

#### Ошибки

| Переменная                 | HSL                 | HEX       | Tailwind                        | Назначение                                                             |
| -------------------------- | ------------------- | --------- | ------------------------------- | ---------------------------------------------------------------------- |
| `--destructive`            | `358.1 75.1% 59%`   | `#e5484d` | `bg-destructive` / `text-destructive` | Ошибка источника, деструктивный пункт меню, `FormMessage`, невалидное поле. |
| `--destructive-foreground` | `0 0% 100%`         | `#ffffff` | `text-destructive-foreground`   | Текст на красной плашке.                                                |

#### Границы

| Переменная | HSL          | HEX       | Tailwind        | Назначение                                                                 |
| ---------- | ------------ | --------- | --------------- | -------------------------------------------------------------------------- |
| `--border` | `0 0% 17.3%` | `#2c2c2c` | `border-border` | Разделители, рамки карточек и таблиц, границы топбара. Глобально `* { @apply border-border }`. |
| `--input`  | `0 0% 17.3%` | `#2c2c2c` | `border-input`  | Рамка полей, `SelectTrigger`, outline-кнопок; фон выключенного `Switch`.     |

#### Палитра графиков

| Переменная  | HSL                | HEX       | Роль                                                                  |
| ----------- | ------------------ | --------- | --------------------------------------------------------------------- |
| `--chart-1` | `8.7 100% 72.9%`   | `#ff8975` | Коралл — основной ряд: линия и заливка графика упоминаний, спарклайны. |
| `--chart-2` | `225 8.7% 91%`     | `#e6e7ea` | Светло-серый — второй ряд.                                             |
| `--chart-3` | `226.7 3.8% 53.1%` | `#83858c` | Средний серый — третий ряд.                                            |
| `--chart-4` | `8.6 50.7% 57.1%`  | `#c96a5a` | Приглушённый коралл — второй «брендовый» ряд.                           |
| `--chart-5` | `228 5.2% 38%`     | `#5c5e66` | Тёмно-серый — фоновые и справочные значения.                            |

Порядок задаёт приоритет: первый ряд всегда самый важный. Цвет ряда берётся
через `hsl(var(--chart-N))` либо через переменную `--color-<key>`, которую
`ChartContainer` генерирует из `ChartConfig`.

#### Сайдбар

| Переменная                    | HSL                | HEX       | Tailwind                        | Назначение                                                    |
| ----------------------------- | ------------------ | --------- | ------------------------------- | ------------------------------------------------------------- |
| `--sidebar-background`        | `0 0% 4.3%`        | `#0b0b0b` | `bg-sidebar`                    | Фон навигационной колонки — самый тёмный слой.                 |
| `--sidebar-foreground`        | `225 8.7% 91%`     | `#e6e7ea` | `text-sidebar-foreground`       | Имя пользователя и прочий текст сайдбара. `BrandLogo` сюда не входит: он задаёт `text-foreground`. |
| `--sidebar-primary`           | `8.7 100% 72.9%`   | `#ff8975` | `text-sidebar-primary`          | Иконка активного пункта навигации.                             |
| `--sidebar-primary-foreground`| `0 0% 5.1%`        | `#0d0d0d` | `text-sidebar-primary-foreground` | Текст на коралловой плашке внутри сайдбара.                  |
| `--sidebar-accent`            | `0 0% 9.8%`        | `#191919` | `bg-sidebar-accent`             | Фон активного пункта; hover — `bg-sidebar-accent/60`.          |
| `--sidebar-accent-foreground` | `0 0% 100%`        | `#ffffff` | `text-sidebar-accent-foreground`| Текст активного и наведённого пункта.                          |
| `--sidebar-border`            | `0 0% 12.9%`       | `#212121` | `border-sidebar-border`         | Граница сайдбара и линия над блоком пользователя.              |
| `--sidebar-ring`              | `8.7 100% 72.9%`   | `#ff8975` | `ring-sidebar-ring`             | Кольцо фокуса внутри сайдбара.                                 |

#### Семантика статусов источника

| Статус   | Подпись     | Цвет                          | Правило                                                              |
| -------- | ----------- | ----------------------------- | -------------------------------------------------------------------- |
| `active` | «Активен»   | `bg-primary`                  | Коралловая точка + `Badge secondary`. Единственный статус с брендом.  |
| `paused` | «На паузе»  | `bg-muted-foreground`         | Серая точка + `Badge secondary`. Пауза — не ошибка.                   |
| `error`  | «Ошибка»    | `bg-destructive`              | `Badge destructive` без точки: плашка уже красная.                    |

#### Семантика тональности

| Тональность | Подпись        | Компонент          | Правило                                                        |
| ----------- | -------------- | ------------------ | -------------------------------------------------------------- |
| `positive`  | «Позитив»      | `Badge` (default)  | Коралловая заливка — единственная тональность с бренд-акцентом. |
| `neutral`   | «Нейтрально»   | `Badge secondary`  | Серая плашка по умолчанию.                                      |
| `negative`  | «Негатив»      | `Badge outline`    | Только текст и контур. Негатив ≠ ошибка, `destructive` не берём. |

#### Прозрачности

Набор закрыт: новых ступеней не заводим. Список синхронизирован с
`alphaTokens` в [`lib/design-tokens.ts`](../lib/design-tokens.ts).

| Значение | Где используется |
| --- | --- |
| `bg-primary/10` | Подложка иконки на экране успеха, активный пункт и пилюля тренда в мок-скриншоте, фон `Skeleton`. |
| `bg-primary/20` | Дорожка `Progress` под коралловым индикатором. |
| `bg-primary/35` | Третья, самая тихая точка источника в мок-скриншоте. |
| `bg-primary/50` | Полоска активного пункта навигации в мок-скриншоте. |
| `bg-primary/60` | Вторая точка источника в мок-скриншоте. |
| `hover:bg-primary/80` | Hover коралловых бейджей. |
| `hover:bg-primary/90` | Hover основной кнопки. |
| `hover:bg-secondary/80` | Hover вторичной кнопки и вторичного бейджа. |
| `hover:bg-destructive/80` | Hover бейджа ошибки. |
| `hover:bg-destructive/90` | Hover деструктивной кнопки. |
| `hsl(var(--primary) / 0.14)` и `/ 0.07` | Два радиальных градиента утилиты `.onix-glow` на auth-экранах. |
| `hsl(var(--primary) / 0.45)` | Кольцо `.auth-ring` вокруг иконки на экране успеха. |
| `border-white/10`, `border-white/5` | Границы мок-карточек, лежащих поверх коралловой панели: `--border` на бренд-фоне не читается. |
| `from-white/10` → `to-[hsl(var(--primary-foreground)/0.15)]` | Диагональный градиент поверх коралловой панели auth. |
| `shadow-black/30`, `shadow-black/40` | Тени тех же мок-карточек — отрыв от коралловой плоскости. |
| `bg-background/80` + `supports-[backdrop-filter]:bg-background/60` | Полупрозрачный топбар с `backdrop-blur`. |
| `bg-muted/50` | Hover строки таблицы и фон `TableFooter`. |
| `bg-black/80` | Оверлей `Dialog` и `Sheet`. |
| `border-border/50` | Рамка тултипа графика. |
| `stroke-border/50` | Линии сетки recharts, перекрашенные внутри `ChartContainer`. |
| `bg-sidebar-accent/60` | Hover пункта навигации — полшага до активного состояния. |
| `bg-muted-foreground/35`, `bg-muted-foreground/20` | Неактивные маркеры и полоски в мок-скриншоте auth. |
| `text-primary-foreground/70` | Подзаголовок на коралловой панели auth. |

---

### 2.2. Типографика

**Шрифт** — Inter Tight, веса 400/500/600/700, подмножества `latin` и
`cyrillic`, подключён через `next/font/google` в переменную
`--font-inter-tight` (`display: "swap"`). На `body`:
`font-feature-settings: "rlig" 1, "calt" 1` и `-webkit-font-smoothing: antialiased`.

**Веса** (по факту использования): `font-medium` — 28 раз, `font-semibold` —
16, `font-normal` — 8, `font-bold` — 1 (слово «Onix» в вордмарке). Рабочая
пара — 500 и 600.

**Размеры** (по факту): `text-sm` — 51 раз, `text-xs` — 24, `text-lg` — 7,
`text-[0.95rem]` — 5, `text-[0.7rem]` — 4, `text-base` — 3, `text-[0.8rem]` — 2,
`text-[0.65rem]` — 2, `text-2xl` — 2, `text-3xl` — 2, по одному —
`text-[2rem]`, `text-[1.05rem]`, `text-[11px]`, `text-[10px]`.

> Счётчики выше посчитаны по `app/` и `components/` **без** самой страницы
> стайлгайда: каталоги `app/design-system/` и `components/design-system/`
> из подсчёта исключены, иначе документация накручивала бы собственные цифры.

#### Роли

Список синхронизирован с массивом `roles` в
[`components/design-system/type-scale.tsx`](../components/design-system/type-scale.tsx).

| Роль | Классы | Где |
| --- | --- | --- |
| Display — заголовок auth | `text-3xl font-semibold tracking-tight sm:text-[2rem]` | `AuthHeading`: единственный крупный текст в системе. |
| Page title — заголовок страницы | `text-base font-semibold sm:text-lg` | `Topbar`: `h1` текущего раздела, растёт с `sm`. |
| Section title — заголовок блока | `text-lg font-semibold` | `h2` над карточками на страницах дашборда. |
| Card title | `font-semibold leading-none tracking-tight` | `CardTitle` и `DialogTitle` (у диалога дополнительно `text-lg`). |
| Metric value | `text-2xl font-semibold tabular-nums tracking-tight` | `MetricCard`: числовое значение метрики. |
| Body | `text-sm` | Рабочий размер интерфейса: таблицы, описания, кнопки, поля. |
| Body medium | `text-sm font-medium` | Названия сущностей в таблицах и списках, пункты навигации, лейблы. |
| Caption | `text-xs text-muted-foreground` | Подписи под значением, handle источника, © в auth. |
| Form message | `text-[0.8rem] font-medium text-destructive` | `FormMessage`; `FormDescription` — тот же размер, но muted. |
| Auth button | `text-[0.95rem]` | Крупные кнопки auth-форм высотой `h-11`. |
| Mono | `font-mono tabular-nums` | Время, числа в таблицах, API-ключ, имена датасетов в мок-скриншоте. |
| Micro | `text-[0.7rem]` / `text-[0.65rem]` / `text-[11px]` / `text-[10px]` | Только мок-скриншот на auth, счётчик в бейдже топбара и число в теге ключевого слова. |
| Wordmark | `text-[1.05rem]` + `font-bold` / `font-normal` | `BrandLogo`: «Onix» жирным, «Data» обычным, точка кораллом. |

Правило: любое число, которое может меняться в кадре (время, счётчики, суммы),
получает `tabular-nums`, а в таблицах — ещё и `font-mono` с выравниванием по
правому краю.

---

### 2.3. Spacing

Базовая сетка — 4px (шкала Tailwind). Половинные ступени (`1.5`, `3.5`)
появляются там, где целая ломает ритм.

| Ступень      | px   | Где                                                                        |
| ------------ | ---- | -------------------------------------------------------------------------- |
| `1` / 0.25rem  | 4    | `gap-1` у иконки с числом, `space-y-1` в паре «значение + тренд».           |
| `1.5` / 0.375rem | 6  | `gap-1.5` в бейджах с точкой, `space-y-1.5` — поле формы, `CardHeader`.     |
| `2` / 0.5rem   | 8    | `gap-2` — самый частый шаг: иконка и текст, кнопки в ряд.                    |
| `3` / 0.75rem  | 12   | `gap-3` — колонки фильтров и шапки страниц, `p-3` в компактных карточках.   |
| `4` / 1rem     | 16   | `gap-4` между карточками, `space-y-4` в формах, `p-4` у `main` на мобильных. |
| `6` / 1.5rem   | 24   | `space-y-6` между секциями, `p-6` внутри карточки, `p-6` у `main` с `sm`.    |

#### Паттерны

| Паттерн                      | Классы                                                        | Где                                                       |
| ---------------------------- | ------------------------------------------------------------- | --------------------------------------------------------- |
| Рабочая область страницы     | `flex-1 space-y-6 p-4 sm:p-6`                                 | `<main>` на каждой странице дашборда.                     |
| Полоса метрик                | `grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4`        | Четыре `MetricCard`.                                      |
| Сетка 2/3 + 1/3              | `grid grid-cols-1 gap-4 lg:grid-cols-3` + `lg:col-span-2`     | График и топ слов; таблица сообщений и статус источников. |
| Форма                        | `space-y-4` (на `/register` — `space-y-3.5`)                  | Расстояние между полями.                                  |
| Поле формы                   | `space-y-2` (`FormItem`) или `space-y-1.5`                    | `1.5` — в auth, где лейбл скрыт `sr-only`.                |
| Шапка страницы с действием   | `flex flex-wrap items-center justify-between gap-3`           | Заголовок слева, кнопка справа.                           |
| Пункт навигации              | `flex items-center gap-3 rounded-lg px-3 py-2`                | Сайдбар.                                                  |
| Топбар                       | `flex h-16 items-center gap-2 px-4 sm:gap-3 sm:px-6`          | Высота 64px, поля синхронны с `main`.                     |

Регистрация осознанно на шаг плотнее логина (`4`/`3.5` против `6`/`4`): полей
вдвое больше, и на ноутбучной высоте форма должна помещаться целиком.

---

### 2.4. Радиусы

`--radius: 0.75rem`. Tailwind считает от него: `lg = var(--radius)` = 12px,
`md = calc(--radius - 2px)` = 10px, `sm = calc(--radius - 4px)` = 8px.

| Класс             | Значение             | Где                                                                       |
| ----------------- | -------------------- | ------------------------------------------------------------------------- |
| `rounded-sm`      | 8px                  | Пункты меню и `Select`, `Checkbox`, кнопка закрытия диалога.               |
| `rounded-md`      | 10px                 | Кнопки, инпуты, `SelectTrigger`, `Badge`, поповеры, `Skeleton`.            |
| `rounded-lg`      | 12px                 | Пункты навигации, `TabsList`, тултип графика, `DialogContent` с `sm`.      |
| `rounded-xl`      | 12px (шкала Tailwind) | `Card` — базовый контейнер контента.                                       |
| `rounded-2xl`     | 16px                 | Мок-скриншот на auth-панели.                                               |
| `rounded-[2rem]`  | 32px                 | Коралловая панель auth — единственное место.                               |
| `rounded-full`    | 9999px               | Аватары, точки статуса, пилюли, `Progress`, `Switch`, счётчик уведомлений. |

---

### 2.5. Поверхности и elevation

Глубину задаёт светлота, а не тень:

```
sidebar #0b0b0b  →  background #0e0e0e  →  card / popover #141414
                 →  muted #191919  →  secondary #1f1f1f / accent #202020
```

Границы: `--border` `#2c2c2c` везде, `--sidebar-border` `#212121` в сайдбаре.

| Тень                        | Где                                                                     |
| --------------------------- | ----------------------------------------------------------------------- |
| `shadow`                    | `Card`, основная кнопка, `Badge`, `Checkbox`, активный таб.              |
| `shadow-sm`                 | Инпуты, `SelectTrigger`, `Switch`, outline/secondary-кнопки.             |
| `shadow-md`                 | `SelectContent`, `DropdownMenuContent`.                                  |
| `shadow-lg`                 | `DialogContent`, `SheetContent`, тост, подменю, thumb у `Switch`.        |
| `shadow-xl`                 | Тултип графика — единственное место.                                     |
| `shadow-2xl shadow-black/30` и `/40` | Мок-карточки на коралловой панели.                              |

Липкие поверхности:

- **Topbar** — `sticky top-0 z-30 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60`, высота `h-16`.
- **Sidebar** — `w-64 border-r border-sidebar-border` + внутренний `sticky top-0 h-screen`.

`.onix-glow` — единственный фоновый эффект: два радиальных градиента коралла
(`60rem × 40rem at 50% -10%` с альфой 0.14 и `40rem × 30rem at 85% 15%` с 0.07)
на левой колонке auth.

---

### 2.6. Иконки

Библиотека — **lucide-react**, единый линейный стиль. Смешивать наборы нельзя;
исключение — фирменные логотипы Google и GitHub в `OAuthButtons`, нарисованные
inline-SVG в собственных цветах бренда.

| Размер          | Где                                                                     |
| --------------- | ----------------------------------------------------------------------- |
| `size-2`        | Точка статуса (`StatusDot`), индикатор «в эфире».                        |
| `size-3`, `size-3.5` | Иконка тренда в `MetricCard`, микро-элементы мок-скриншота.        |
| `size-4`        | Размер по умолчанию: кнопки, пункты меню, иконка в поле, навигация.       |
| `size-6`        | Иконка внутри круга `size-12` на экране успеха.                          |
| `size-8`        | `Avatar` в топбаре и сайдбаре.                                           |

Внутри кнопок размер задаёт сам `Button` через `[&_svg]:size-4` — дублировать
класс не нужно. Декоративная иконка получает `aria-hidden="true"`; кнопка без
текстовой подписи — `aria-label`.

---

### 2.7. Motion

Плагин `tailwindcss-animate`. Движение объясняет появление контента и
подтверждает нажатие — больше ничего.

| Класс / константа                 | Параметры                                                             | Роль                                                                 |
| --------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `.auth-enter` + `.auth-enter-1…10` | 450 мс, `cubic-bezier(0.16, 1, 0.3, 1)`, шаг 55 мс, `fill-mode: backwards` | Каскад левой колонки auth: от логотипа до © ~495 мс.             |
| `.auth-rise` / `.auth-rise-late`  | 700 мс, `fade + zoom-in-95 + slide-in-from-bottom-4`, задержка 250 мс  | Мок-скриншот и догоняющая карточка-метрика.                          |
| `.auth-line` / `.auth-line-late`  | 900 мс, `stroke-dashoffset` 1 → 0, старт 400 / 800 мс                  | Прорисовка линии графика.                                             |
| `.auth-area`                      | 500 мс, старт 1150 мс                                                  | Заливка под графиком — после прорисовки линии.                        |
| `.auth-float`                     | 6 с, `ease-in-out`, бесконечно, старт 1 с                              | Парение карточки-метрики на ±5px.                                     |
| `.auth-drift-1/2/3`               | 24 с / 30 с / 19 с, `alternate`                                        | Дрейф фоновых гексагонов.                                             |
| `.auth-ring`                      | 900 мс, один раз, старт 250 мс                                         | Кольцо вокруг иконки на экране успеха (не бесконечный пульс).         |
| `authPress`                       | `active:scale-[0.98]` с явным списком `transition-[…]`                 | Отклик крупных auth-кнопок.                                           |
| `authFormMessage`                 | `animate-in fade-in slide-in-from-top-1 duration-200`                  | Появление сообщения валидации.                                        |
| `animate-pulse`                   | бесконечно                                                             | Индикатор «в эфире» на `/dashboard/stream`, фон `Skeleton`.           |
| `transition-colors`               | 150 мс по умолчанию                                                    | Все интерактивные элементы.                                           |

Три вещи, которые легко сломать:

1. **Ступени каскада перечислены литералами** в `auth-motion.ts`. Tailwind
   сканирует исходники как текст и вырезает классы, которых не нашёл: строку
   вида `` `auth-enter-${n}` `` он не увидит, и анимация тихо исчезнет.
2. **`fill-mode: backwards` обязателен.** Без него элемент виден в финальном
   состоянии до старта своей анимации, и каскад превращается в мигание.
3. **`authPress` перечисляет свойства явно.** `transition-colors` из
   `buttonVariants` попадает в ту же группу `twMerge`, что и `transition-*`;
   без явного списка плавная смена фона на hover потерялась бы.

#### prefers-reduced-motion

Глобальный блок в конце `globals.css` обнуляет `animation-duration`,
`animation-iteration-count`, `transition-duration`, `scroll-behavior` и —
отдельно — `animation-delay`, а `.auth-line` показывает график целиком.

Каждое объявление внутри блока обязано быть `!important`: в собранном бандле
блок оказывается примерно на строке 2248, а вариантные и адаптивные утилиты
идут после него (~2277–2982) — `.active\:scale-\[0.98\]`,
`.aria-\[invalid=true\]\:…`, `data-[state=open]:animate-in`, `min-width`-медиа.
При равной специфичности выигрывает то, что ниже, поэтому объявление без
`!important` молча проиграет. Задержки обнуляются потому, что каскад держит
стартовое состояние через `fill-mode: backwards`: без сброса контент остался бы
невидимым ещё почти секунду после загрузки.

---

### 2.8. Бренд

`BrandLogo` ([`components/brand-logo.tsx`](../components/brand-logo.tsx)):

- **Метка** — SVG-«созвездие» 32×32: четыре круга разного радиуса (два
  сплошных, два с `opacity .55`) и три соединяющие линии с `opacity .5`.
  Рисуется `currentColor`, поэтому наследует цвет текста.
- **Вордмарк** — `text-[1.05rem]`: «Onix» жирным (`font-bold`), «Data»
  обычным (`font-normal`), точка кораллом (`text-primary`).
- **Размеры** — `size` по умолчанию 26 (сайдбар, топбар стайлгайда), 30 в auth.
- **`markOnly`** скрывает вордмарк, оставляя метку.
- Внутри есть `<span className="sr-only">OnixData</span>`, поэтому
  ссылка-логотип уже озвучена и дополнительная подпись не нужна.

Дополнительные бренд-мотивы: коралловое свечение `.onix-glow` и контурные
гексагоны на auth-панели.

---

## 3. Layout-паттерны

### Auth

```
min-h-screen bg-background lg:grid lg:grid-cols-2 lg:gap-3 lg:p-3
├── левая колонка  .onix-glow  px-5 py-8 sm:px-10 lg:px-8
│   └── mx-auto max-w-[25rem] flex-1 flex-col gap-6
│       ├── BrandLogo size=30            (ступень 1)
│       ├── children (форма)             (ступени 2–9)
│       └── © text-xs muted              (ступень 10)
└── AuthShowcase  hidden lg:block
    └── sticky top-3 h-[calc(100vh-1.5rem)] rounded-[2rem] bg-primary px-10 py-12
```

Правая панель существует только с `lg`. Внутри — мок-скриншот `rounded-2xl` на
`bg-card` с `border-white/10` и `shadow-2xl shadow-black/30`, карточка-метрика
на `-bottom-8 -left-8`, три дрейфующих гексагона и блок копирайта с
`key={pathname}`, чтобы анимация отыгрывала при переходе login ↔ register ↔
forgot. У блока копирайта зафиксирован `min-h-[7.25rem]` (`xl:min-h-[7.75rem]`),
иначе колонка перецентровывалась бы и мок прыгал по вертикали.

### Dashboard shell

```
flex min-h-screen bg-background
├── AppSidebar   hidden w-64 shrink-0 border-r border-sidebar-border lg:block
│   └── sticky top-0 h-screen  →  логотип h-16 / ScrollArea с nav / блок пользователя
└── flex min-w-0 flex-1 flex-col
    ├── Topbar  sticky top-0 z-30 h-16 border-b bg-background/80 backdrop-blur
    └── main    flex-1 space-y-6 p-4 sm:p-6
```

До `lg` сайдбар живёт в `Sheet` (`side="left"`, `w-64`, `p-0`), который
открывает icon-кнопка с `aria-label="Открыть меню навигации"`. Один и тот же
`SidebarBody` рендерится в обоих случаях; в мобильном варианте он получает
`onNavigate`, закрывающий шторку.

### Брейкпоинты

| Брейкпоинт | Ширина   | Что меняется                                                                                                     |
| ---------- | -------- | ---------------------------------------------------------------------------------------------------------------- |
| база       | < 640px  | Одна колонка. Сайдбар только в `Sheet`, поиск в топбаре скрыт, «Новая задача» — icon-кнопка.                       |
| `sm`       | ≥ 640px  | `main` получает `p-6`, метрики в две колонки, заголовок страницы `text-lg`, кнопка с подписью.                     |
| `md`       | ≥ 768px  | Появляется поиск в топбаре (`w-56`).                                                                               |
| `lg`       | ≥ 1024px | Постоянный сайдбар `w-64`; auth разъезжается на две колонки; сетки 2/3 + 1/3; поиск в топбаре расширяется до `w-72`. |
| `xl`       | ≥ 1280px | Метрики в четыре колонки. |

`2xl` в проекте не используется.

---

## 4. Каталог компонентов

### 4.1. Базовые (`components/ui/`)

| Компонент | Варианты / размеры | Ключевые правила | Файл |
| --------- | ------------------ | ---------------- | ---- |
| **Button** | `default`, `destructive`, `outline`, `secondary`, `ghost`, `link`; `default` h-9, `sm` h-8, `lg` h-10, `icon` h-9 w-9 | Иконки внутри — автоматически `size-4` через `[&_svg]:size-4`. Основная кнопка одна на экран. Icon-кнопка обязана иметь `aria-label`. В auth — `h-11 w-full text-[0.95rem]` + `authPress`. | [`button.tsx`](../components/ui/button.tsx) |
| **Badge** | `default`, `secondary`, `destructive`, `outline` | `outline` — платформа (`font-normal`), `secondary` — теги и статусы, `default` — позитивная тональность и счётчик уведомлений, `destructive` — ошибка источника. | [`badge.tsx`](../components/ui/badge.tsx) |
| **Card** | `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter` | `rounded-xl border bg-card shadow`. `CardHeader` — `p-6 space-y-1.5`, `CardContent` — `p-6 pt-0`. Между заголовком и телом отступа нет намеренно. | [`card.tsx`](../components/ui/card.tsx) |
| **Input** | h-9, `text-base md:text-sm` | 16px на мобильных, чтобы iOS не зумил при фокусе. | [`input.tsx`](../components/ui/input.tsx) |
| **IconInput / PasswordInput** | h-11, `pl-10` (пароль — ещё `pr-10`) | Иконка стоит в DOM перед инпутом, поэтому подсветку даёт `group-focus-within`, а не `peer-focus`. Лейблы в auth скрыты, поэтому ошибку показывает само поле: `aria-[invalid=true]:border-destructive` + `:focus-visible:ring-destructive`. Переключатель видимости — с `aria-label`, смена `EyeIcon` ↔ `EyeOffIcon` пересоздаёт узел, и анимация отыгрывает. | [`icon-input.tsx`](../components/ui/icon-input.tsx) |
| **Label** | — | `text-sm font-medium leading-none`, гасится при `peer-disabled`. | [`label.tsx`](../components/ui/label.tsx) |
| **Form** | `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormDescription`, `FormMessage` | react-hook-form + zod через `zodResolver`. `FormControl` сам проставляет `id`, `aria-describedby` и `aria-invalid`. Формы всегда `noValidate` — валидацию ведёт zod. | [`form.tsx`](../components/ui/form.tsx) |
| **Select** | `SelectTrigger`, `SelectContent`, `SelectItem`, `SelectLabel`, `SelectSeparator` | Триггер повторяет геометрию инпута (h-9, `rounded-md`, `border-input`). Контент — `position="popper"`, `bg-popover`, `shadow-md`. | [`select.tsx`](../components/ui/select.tsx) |
| **Checkbox** | 4×4 | `border-primary`, во включённом состоянии `bg-primary`. Согласие в форме. | [`checkbox.tsx`](../components/ui/checkbox.tsx) |
| **Switch** | 9×5, thumb 4×4 | `data-[state=checked]:bg-primary`, выключенный — `bg-input`. Настройка, применяемая сразу. | [`switch.tsx`](../components/ui/switch.tsx) |
| **Tabs** | h-9 дорожка | Дорожка `bg-muted rounded-lg p-1`, активный таб поднимается на `bg-background` с `shadow`. | [`tabs.tsx`](../components/ui/tabs.tsx) |
| **Table** | — | Обёртка `overflow-x-auto`, у колонок `min-w-[…]`, числа справа в `font-mono tabular-nums`. Заголовки — `text-muted-foreground font-medium`. Служебная колонка действий подписана через `sr-only`. Hover строки — `bg-muted/50`. | [`table.tsx`](../components/ui/table.tsx) |
| **Dialog** | `max-w-lg` по умолчанию, в проекте — `sm:max-w-md` | Оверлей `bg-black/80`. `DialogFooter`: слева ghost «Отмена», справа основное действие; в проекте добавляется `gap-2 sm:gap-2`. Закрытие сбрасывает форму. Кнопка закрытия несёт `sr-only` «Закрыть». | [`dialog.tsx`](../components/ui/dialog.tsx) |
| **Sheet** | `side`: top / bottom / left / right; `w-3/4 sm:max-w-sm` | Мобильная навигация — `side="left" w-64 p-0`. `SheetTitle` и `SheetDescription` обязательны, но скрыты `sr-only`. | [`sheet.tsx`](../components/ui/sheet.tsx) |
| **DropdownMenu** | `Content`, `Item`, `CheckboxItem`, `RadioItem`, `Label`, `Separator`, `Shortcut`, `Sub*` | Деструктивный пункт — `className="text-destructive focus:text-destructive"`, иначе цвет теряется при наведении. Пункт-ссылка — `<DropdownMenuItem asChild><Link/></DropdownMenuItem>`. | [`dropdown-menu.tsx`](../components/ui/dropdown-menu.tsx) |
| **Tooltip** | — | Единственный элемент с коралловой заливкой по умолчанию: `bg-primary text-primary-foreground text-xs`. Требует `TooltipProvider`. Подсказка не заменяет доступное имя. | [`tooltip.tsx`](../components/ui/tooltip.tsx) |
| **Avatar** | h-9 по умолчанию, в проекте `size-8` | Изображений нет — всегда `AvatarFallback` с инициалами `text-xs font-medium` на `bg-muted` (в сайдбаре — `bg-sidebar-accent`). | [`avatar.tsx`](../components/ui/avatar.tsx) |
| **Separator** | `horizontal` / `vertical` | `bg-border`, 1px. Для вертикального нужно задать высоту (`h-6`). | [`separator.tsx`](../components/ui/separator.tsx) |
| **Progress** | h-2 | Дорожка `bg-primary/20`, индикатор `bg-primary`. | [`progress.tsx`](../components/ui/progress.tsx) |
| **Skeleton** | — | `animate-pulse rounded-md bg-primary/10`. | [`skeleton.tsx`](../components/ui/skeleton.tsx) |
| **ScrollArea** | — | Обёртка навигации в сайдбаре; ползунок `bg-border`, ширина 2.5. | [`scroll-area.tsx`](../components/ui/scroll-area.tsx) |
| **Chart** | `ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, `ChartLegend*`, `ChartStyle` | `ChartConfig` задаёт подпись и цвет ряда; `ChartStyle` превращает их в `--color-<key>`. Тултип — `rounded-lg border-border/50 bg-background shadow-xl`, значение в `font-mono tabular-nums`. | [`chart.tsx`](../components/ui/chart.tsx) |
| **Sonner (Toaster)** | — | Подключён один раз в корневом layout: `position="top-right" richColors closeButton`, внутри `theme="dark"` (next-themes не используется). Паттерн вызова — `toast(title, { description })`, где description честно помечает «Демо-режим». | [`sonner.tsx`](../components/ui/sonner.tsx) |

### 4.2. Композиты

| Компонент | Назначение | Правила | Файл |
| --------- | ---------- | ------- | ---- |
| **BrandLogo** | Логотип | `size` (26/30), `markOnly`. Внутри `sr-only` «OnixData». | [`brand-logo.tsx`](../components/brand-logo.tsx) |
| **MetricCard** | Карточка метрики | Значение `text-2xl font-semibold tabular-nums`; дельта коралловая при росте и `muted-foreground` при падении — красного здесь нет. Спарклайн `h-12 w-24`, `isAnimationActive={false}`, обёрнут в `aria-hidden`. Градиент id уникален по `metric.id`. | [`metric-card.tsx`](../components/dashboard/metric-card.tsx) |
| **StatusDot / StatusBadge / SentimentBadge** | Статус источника и тональность | См. таблицы семантики в §2.1. `StatusDot` — `aria-hidden`, смысл несёт текст рядом. | [`badges.tsx`](../components/dashboard/badges.tsx) |
| **Topbar** | Шапка раздела | `title` в `h1`. Поиск с `md`, «Новая задача» отдельными кнопками для `sm+` и мобильного (у второй — `aria-label`). Счётчик уведомлений — `Badge` `h-4 min-w-4 text-[10px]` в углу icon-кнопки, у кнопки `aria-label` с числом. | [`topbar.tsx`](../components/dashboard/topbar.tsx) |
| **AppSidebar / MobileSidebar** | Навигация | Общий `navItems`; активность считает `isItemActive` (точное совпадение для `/dashboard`, префикс для остальных). Активный пункт — `bg-sidebar-accent` + `aria-current="page"` + коралловая иконка. | [`app-sidebar.tsx`](../components/dashboard/app-sidebar.tsx) |
| **MentionsChart** | График упоминаний | `aspect-auto h-[280px] w-full`, заливка — градиент `0.35 → 0.02` от `var(--color-mentions)`, `CartesianGrid vertical={false} strokeDasharray="3 3"`, оси без линий и засечек, `cursor={false}`. | [`mentions-chart.tsx`](../components/dashboard/mentions-chart.tsx) |
| **SourcesTable / DatasetsTable** | Таблицы | `overflow-x-auto`, `min-w` у колонок, числа `text-right font-mono tabular-nums` через `toLocaleString("ru-RU")`. Двухстрочная ячейка: название `text-sm font-medium` + подпись `text-xs text-muted-foreground`. Действия строки — `DropdownMenu` с `aria-label`, включающим имя источника. | [`sources-table.tsx`](../components/dashboard/sources-table.tsx), [`datasets-table.tsx`](../components/dashboard/datasets-table.tsx) |
| **NewParseDialog / ExportDialog** | Диалоги с формой | Принимают `trigger` как `ReactNode` — один и тот же диалог используется из топбара и со страницы. `sm:max-w-md`, форма `space-y-4`, `noValidate`, футер `gap-2 sm:gap-2`. Закрытие вызывает `form.reset()`. Успех — `toast.success` с пометкой демо-режима. | [`new-parse-dialog.tsx`](../components/dashboard/new-parse-dialog.tsx), [`export-dialog.tsx`](../components/dashboard/export-dialog.tsx) |
| **SettingsTabs** | Настройки | Три вкладки, каждая — одна `Card`. API-ключ в `Input readOnly font-mono text-xs`; копирование через `navigator.clipboard` с `try/catch` и тостом на оба исхода. | [`settings-tabs.tsx`](../components/dashboard/settings-tabs.tsx) |
| **AuthHeading** | Заголовок auth | `title` + `description`; `className` и `descriptionClassName` разные, потому что это соседние ступени каскада. `forwardRef` + `tabIndex={-1}` нужны, чтобы перевести фокус на экран успеха. | [`auth-heading.tsx`](../components/auth/auth-heading.tsx) |
| **AuthDivider** | Разделитель «или» | Линия `border-t` за текстом на `bg-background`, `text-xs uppercase`. | [`auth-divider.tsx`](../components/auth/auth-divider.tsx) |
| **AuthAltAction** | Ссылка «Нет аккаунта? Регистрация» | `text-center text-sm text-muted-foreground`, ссылка `font-medium text-primary`. | [`auth-alt-action.tsx`](../components/auth/auth-alt-action.tsx) |
| **OAuthButtons** | Google / GitHub | `grid grid-cols-2 gap-3`, кнопки `outline h-11 bg-transparent` + `authPress`. Иконки — фирменные SVG. Оба показывают тост «Демо: OAuth не подключён». | [`oauth-buttons.tsx`](../components/auth/oauth-buttons.tsx) |
| **AuthShowcase** | Правая панель auth | Копия зависит от `pathname` с фолбэком на `/login`. Вся графика — `aria-hidden`. | [`auth-showcase.tsx`](../components/auth/auth-showcase.tsx) |

---

## 5. Состояния

Таблица синхронизирована с матрицей на `/design-system`
([`components/design-system/states.tsx`](../components/design-system/states.tsx)).

| Элемент | Hover | Focus-visible | Active | Disabled | Invalid |
| --- | --- | --- | --- | --- | --- |
| Button `default` | `hover:bg-primary/90` | `ring-1 ring-ring` | — (в auth: `active:scale-[0.98]`) | `opacity-50` + `pointer-events-none` | — |
| Button `secondary` | `hover:bg-secondary/80` | `ring-1 ring-ring` | — | `opacity-50` + `pointer-events-none` | — |
| Button `outline` / `ghost` | `hover:bg-accent hover:text-accent-foreground` | `ring-1 ring-ring` | — | `opacity-50` + `pointer-events-none` | — |
| Button `destructive` | `hover:bg-destructive/90` | `ring-1 ring-ring` | — | `opacity-50` + `pointer-events-none` | — |
| Input / IconInput | — (`transition-colors`) | `ring-1 ring-ring` | — | `opacity-50` + `cursor-not-allowed` | Только `IconInput`/`PasswordInput`: `aria-[invalid=true]`: `border-destructive`; кольцо только в фокусе — `aria-[invalid=true]:focus-visible:ring-destructive`. Базовый `Input` невалидность не подсвечивает, `aria-invalid` ставит `FormControl` |
| SelectTrigger | — | `focus:ring-1 focus:ring-ring` | `data-[state=open]` раскрывает список | `opacity-50` + `cursor-not-allowed` | как у Input (через `FormControl`) |
| Пункт навигации | `hover:bg-sidebar-accent/60` | `ring-1 ring-sidebar-ring` | `bg-sidebar-accent` + иконка `text-sidebar-primary` + `aria-current` | — | — |
| Пункт меню / Select | `focus:bg-accent focus:text-accent-foreground` | то же (Radix ведёт фокус мышью и клавиатурой) | — | `data-[disabled]`: `opacity-50` + `pointer-events-none` | — |
| Строка таблицы | `hover:bg-muted/50` | — | `data-[state=selected]:bg-muted` | — | — |
| TabsTrigger | — | `ring-2 ring-ring ring-offset-2` | `data-[state=active]`: `bg-background` + `shadow` | `opacity-50` + `pointer-events-none` | — |
| Checkbox / Switch | — | Checkbox `ring-1`, Switch `ring-2` + `ring-offset-2` | `data-[state=checked]:bg-primary` | `opacity-50` + `cursor-not-allowed` | — |
| Badge | `hover:bg-…/80` у заливок (primary, secondary, destructive) | `focus:ring-2 focus:ring-ring` + `ring-offset-2` | — | — | — |

Фокус всегда коралловый (`--ring` совпадает с `--primary`) и рисуется только
по `focus-visible` — мышью кольцо не появляется.

---

## 6. Do / Don't

**Do**

- Брать цвет Tailwind-классом (`bg-card`, `text-muted-foreground`) или через
  `hsl(var(--…))` в inline-стилях и SVG.
- Начинать новый экран с `<main className="flex-1 space-y-6 p-4 sm:p-6">` и
  собирать содержимое из `Card`.
- Ставить `aria-label` на любую кнопку без видимого текста и `aria-hidden` на
  декоративную графику.
- Оборачивать таблицы в `overflow-x-auto` и задавать колонкам `min-w`.
- Писать классы анимаций литеральными строками.
- Помечать демо-действия тостом с описанием, что ничего не произошло.
- Форматировать числа через `toLocaleString("ru-RU")` и давать им
  `tabular-nums`.

**Don't**

- Не использовать коралл как фон карточек и больших плоскостей — исключение
  ровно одно: `AuthShowcase`.
- Не вводить новых цветов вне токенов; не добавлять зелёный success и жёлтый
  warning.
- Не хардкодить HEX в компонентах — только `lib/design-tokens.ts`.
- Не склеивать имена классов на лету (`` `auth-enter-${n}` ``,
  `` `text-${size}` ``): Tailwind их вырежет.
- Не путать `--accent` с бренд-акцентом.
- Не оставлять `Sheet` и `Dialog` без заголовка — при необходимости он
  `sr-only`.
- Не ставить второй primary-CTA в одном экранном блоке.
- Не убирать `!important` из блока `prefers-reduced-motion`.
- Не дублировать `size-4` на иконках внутри `Button` — это уже сделано.

---

## 7. Контент и тон

- **Язык** — русский, включая служебные подписи и `aria-label`.
- **Заголовки auth** — короткие, с точкой: «Вход в аккаунт.», «Создать
  аккаунт.», «Восстановление доступа.», «Проверьте почту.»
- **Заголовки разделов** — существительное без точки: «Обзор», «Источники»,
  «Поток», «Датасеты», «Настройки».
- **Демо-пометки** — в описании, а не в заголовке: «Демо-режим: изменения не
  сохраняются», «Демо-данные за последние 24 часа», «Демо-режим: файл не
  формируется».
- **Числа** — `toLocaleString("ru-RU")`: `1 284 903`, `+12,4%`, `12,4 МБ`.
- **Время** — 24-часовое: `14:32:08`,
  `toLocaleTimeString("ru-RU", { hour12: false })`.
- **Ошибки валидации** — повелительное наклонение, коротко: «Укажите email»,
  «Пароли не совпадают», «Выберите платформу».
- **Тосты** — заголовок в прошедшем времени или назывной («Профиль сохранён»,
  «Уведомления»), описание объясняет, что это демо.

---

## 8. Как добавлять новое

1. **Проверить каталог.** Нужный элемент уже может быть в `components/ui/` или
   среди композитов — начинать с нуля почти никогда не нужно.
2. **Взять готовый примитив.** Новый компонент собирается из существующих;
   если нужен ещё один shadcn-компонент, добавляем его в `components/ui/`
   в стиле `new-york` и приводим к токенам проекта.
3. **Только токены.** Цвета — Tailwind-классами, радиусы — из шкалы, отступы —
   из шести ступеней. Ни одного нового HEX.
4. **Проверить доступность.** `aria-label` у icon-кнопок, `sr-only` у скрытых
   заголовков, фокус виден, `aria-hidden` на декоре.
5. **Проверить адаптив.** Мобильная ширина 375px без горизонтального скролла
   страницы; широкий контент скроллится внутри своего контейнера.
6. **Проверить демо-контракт.** Действие без бэкенда обязано ответить тостом
   с честным описанием.
7. **Прогнать проверки:** `npm run typecheck` и `npm run lint`.
8. **Добавить в стайлгайд.** Новый компонент или токен появляется на
   `/design-system` — подкомпоненты лежат в `components/design-system/`.
