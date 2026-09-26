const principles: { title: string; text: string }[] = [
  {
    title: "Только тёмная тема",
    text: "На <html> жёстко стоит класс dark, палитра продублирована в :root и .dark. Переключателя нет — и «вспышки» светлого фона при загрузке тоже.",
  },
  {
    title: "Коралл — точечно",
    text: "--primary достаётся ключевым CTA, активным состояниям, данным графиков и позитивной тональности. Так бренд-акцент не расползается по интерфейсу.",
  },
  {
    title: "--accent — это hover, а не бренд",
    text: "Несмотря на имя, --accent — subtle фон наведения для ghost и outline. Путать его с бренд-акцентом нельзя.",
  },
  {
    title: "Почти монохромная база",
    text: "Пять нейтральных поверхностей в диапазоне светлоты 4,3–12,5% и одна линия границы. Глубину даёт светлота, а не тень.",
  },
  {
    title: "Нет зелёного и жёлтого",
    text: "Success и warning в системе отсутствуют: позитив выражается кораллом, негатив — нейтрально, ошибка — destructive. Осознанное исключение — панели Viber: состояния бэкенда используют статусные цвета Tailwind.",
  },
  {
    title: "Демо-режим виден вне разделов Viber",
    text: "Вне разделов Viber бэкенда нет: каждое действие отвечает тостом с пометкой «Демо-режим», а описания честно говорят, что ничего не сохраняется. Живой бэкенд есть только у панелей components/dashboard/viber-*.",
  },
  {
    title: "Русский интерфейс",
    text: "Вся копия на русском, числа через formatNumber и formatDelta из lib/format.ts, время 24-часовое.",
  },
  {
    title: "Доступность по умолчанию",
    text: "aria-label на icon-кнопках, sr-only заголовок и описание у Sheet, кольцо focus-visible, aria-current у активного пункта, полное отключение анимаций по prefers-reduced-motion.",
  },
]

export function Principles() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {principles.map((principle) => (
        <div
          key={principle.title}
          className="space-y-1 rounded-lg border bg-card p-4"
        >
          <p className="text-sm font-medium">{principle.title}</p>
          <p className="text-sm text-muted-foreground">{principle.text}</p>
        </div>
      ))}
    </div>
  )
}
