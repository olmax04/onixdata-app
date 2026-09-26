/**
 * OnixData — демонстрационные данные.
 * Все значения ниже вымышленные и нужны только для показа интерфейса.
 * Реальных сетевых вызовов и реальных клиентов здесь нет.
 */

export type Platform = "Telegram" | "WhatsApp" | "Discord" | "Viber"

export type SourceStatus = "active" | "paused" | "error"

export type Sentiment = "positive" | "neutral" | "negative"

export type DatasetFormat = "CSV" | "JSON" | "API"

export interface Source {
  id: string
  name: string
  handle: string
  platform: Platform
  kind: string
  messages: number
  updatedAt: string
  status: SourceStatus
}

export interface StreamMessage {
  id: string
  time: string
  source: string
  platform: Platform
  author: string
  text: string
  sentiment: Sentiment
  phone?: string | null
  phoneSource?: "message_text" | "viber_profile" | "none" | null
}

export interface Dataset {
  id: string
  name: string
  source: string
  rows: number
  format: DatasetFormat
  createdAt: string
  size: string
}

export interface Metric {
  id: string
  title: string
  value: string
  delta: number
  hint: string
  spark: { i: number; v: number }[]
}

export interface Keyword {
  word: string
  count: number
}

export const sourceStatusLabels: Record<SourceStatus, string> = {
  active: "Активен",
  paused: "На паузе",
  error: "Ошибка",
}

export const sentimentLabels: Record<Sentiment, string> = {
  positive: "Позитив",
  neutral: "Нейтрально",
  negative: "Негатив",
}

export const platforms: Platform[] = ["Telegram", "WhatsApp", "Discord"]

export const frequencyOptions = [
  { value: "realtime", label: "Реальное время" },
  { value: "5min", label: "Раз в 5 минут" },
  { value: "hourly", label: "Раз в час" },
]

export const sources: Source[] = [
  {
    id: "src-01",
    name: "Крипто Дайджест",
    handle: "@crypto_digest_ru",
    platform: "Telegram",
    kind: "Публичный канал",
    messages: 128450,
    updatedAt: "2 мин назад",
    status: "active",
  },
  {
    id: "src-02",
    name: "Retail Analytics",
    handle: "@retail_analytics",
    platform: "Telegram",
    kind: "Публичный чат",
    messages: 84119,
    updatedAt: "5 мин назад",
    status: "active",
  },
  {
    id: "src-03",
    name: "Devs Community",
    handle: "discord.gg/devs-community",
    platform: "Discord",
    kind: "Сервер · 12 каналов",
    messages: 213004,
    updatedAt: "1 мин назад",
    status: "active",
  },
  {
    id: "src-04",
    name: "Открытая рассылка ритейла",
    handle: "wa.me/open-retail",
    platform: "WhatsApp",
    kind: "Публичная группа",
    messages: 41870,
    updatedAt: "12 мин назад",
    status: "paused",
  },
  {
    id: "src-05",
    name: "Медиа Мониторинг",
    handle: "@media_monitor",
    platform: "Telegram",
    kind: "Публичный канал",
    messages: 96233,
    updatedAt: "3 мин назад",
    status: "active",
  },
  {
    id: "src-06",
    name: "Gaming Hub",
    handle: "discord.gg/gaming-hub",
    platform: "Discord",
    kind: "Сервер · 5 каналов",
    messages: 155920,
    updatedAt: "8 мин назад",
    status: "error",
  },
  {
    id: "src-07",
    name: "Фарма Новости",
    handle: "@pharma_news",
    platform: "Telegram",
    kind: "Публичный канал",
    messages: 33402,
    updatedAt: "26 мин назад",
    status: "paused",
  },
  {
    id: "src-08",
    name: "Logistics Open",
    handle: "wa.me/logistics-open",
    platform: "WhatsApp",
    kind: "Публичная группа",
    messages: 27615,
    updatedAt: "4 мин назад",
    status: "active",
  },
]

export const metrics: Metric[] = [
  {
    id: "mentions",
    title: "Упоминания за 24 ч",
    value: "18 402",
    delta: 12.4,
    hint: "вчера за тот же период — 16 370",
    spark: [
      { i: 0, v: 420 },
      { i: 1, v: 465 },
      { i: 2, v: 448 },
      { i: 3, v: 512 },
      { i: 4, v: 587 },
      { i: 5, v: 552 },
      { i: 6, v: 640 },
      { i: 7, v: 705 },
      { i: 8, v: 682 },
      { i: 9, v: 761 },
      { i: 10, v: 812 },
      { i: 11, v: 874 },
    ],
  },
  {
    id: "sources",
    title: "Активные источники",
    value: "42",
    delta: 4.8,
    hint: "8 в этом проекте, 34 в архиве",
    spark: [
      { i: 0, v: 33 },
      { i: 1, v: 34 },
      { i: 2, v: 34 },
      { i: 3, v: 36 },
      { i: 4, v: 35 },
      { i: 5, v: 38 },
      { i: 6, v: 39 },
      { i: 7, v: 39 },
      { i: 8, v: 40 },
      { i: 9, v: 41 },
      { i: 10, v: 41 },
      { i: 11, v: 42 },
    ],
  },
  {
    id: "collected",
    title: "Сообщений собрано",
    value: "1 284 903",
    delta: 8.1,
    hint: "за всё время наблюдения",
    spark: [
      { i: 0, v: 880 },
      { i: 1, v: 934 },
      { i: 2, v: 1010 },
      { i: 3, v: 986 },
      { i: 4, v: 1084 },
      { i: 5, v: 1152 },
      { i: 6, v: 1121 },
      { i: 7, v: 1208 },
      { i: 8, v: 1264 },
      { i: 9, v: 1233 },
      { i: 10, v: 1301 },
      { i: 11, v: 1372 },
    ],
  },
  {
    id: "speed",
    title: "Скорость сбора (сообщений/мин)",
    value: "1 640",
    delta: -3.2,
    hint: "два источника на паузе",
    spark: [
      { i: 0, v: 1780 },
      { i: 1, v: 1812 },
      { i: 2, v: 1755 },
      { i: 3, v: 1798 },
      { i: 4, v: 1720 },
      { i: 5, v: 1688 },
      { i: 6, v: 1731 },
      { i: 7, v: 1702 },
      { i: 8, v: 1665 },
      { i: 9, v: 1690 },
      { i: 10, v: 1652 },
      { i: 11, v: 1640 },
    ],
  },
]

export const mentionsByHour = [
  { hour: "00:00", mentions: 312 },
  { hour: "01:00", mentions: 264 },
  { hour: "02:00", mentions: 198 },
  { hour: "03:00", mentions: 154 },
  { hour: "04:00", mentions: 131 },
  { hour: "05:00", mentions: 176 },
  { hour: "06:00", mentions: 258 },
  { hour: "07:00", mentions: 402 },
  { hour: "08:00", mentions: 588 },
  { hour: "09:00", mentions: 742 },
  { hour: "10:00", mentions: 869 },
  { hour: "11:00", mentions: 934 },
  { hour: "12:00", mentions: 1012 },
  { hour: "13:00", mentions: 968 },
  { hour: "14:00", mentions: 1043 },
  { hour: "15:00", mentions: 1128 },
  { hour: "16:00", mentions: 1204 },
  { hour: "17:00", mentions: 1156 },
  { hour: "18:00", mentions: 1082 },
  { hour: "19:00", mentions: 996 },
  { hour: "20:00", mentions: 903 },
  { hour: "21:00", mentions: 812 },
  { hour: "22:00", mentions: 621 },
  { hour: "23:00", mentions: 449 },
]

export const topKeywords: Keyword[] = [
  { word: "доставка", count: 1842 },
  { word: "тариф", count: 1516 },
  { word: "поддержка", count: 1284 },
  { word: "возврат", count: 1071 },
  { word: "приложение", count: 964 },
  { word: "оплата", count: 903 },
  { word: "скидка", count: 812 },
  { word: "интеграция", count: 744 },
  { word: "подписка", count: 690 },
  { word: "аналитика", count: 617 },
  { word: "склад", count: 548 },
  { word: "маркетплейс", count: 471 },
]

export const streamMessages: StreamMessage[] = [
  {
    id: "msg-01",
    time: "14:32:08",
    source: "@crypto_digest_ru",
    platform: "Telegram",
    author: "Марина К.",
    text: "Кто-нибудь сравнивал тарифы на доставку у двух крупных операторов за последний месяц?",
    sentiment: "neutral",
  },
  {
    id: "msg-02",
    time: "14:31:54",
    source: "discord.gg/devs-community",
    platform: "Discord",
    author: "art_dev",
    text: "Интеграция через API поднялась за полдня, документация неожиданно понятная.",
    sentiment: "positive",
  },
  {
    id: "msg-03",
    time: "14:31:37",
    source: "@retail_analytics",
    platform: "Telegram",
    author: "Сергей П.",
    text: "Возврат оформляли неделю, поддержка молчит. Осадок неприятный.",
    sentiment: "negative",
  },
  {
    id: "msg-04",
    time: "14:31:12",
    source: "@media_monitor",
    platform: "Telegram",
    author: "Newsroom Bot",
    text: "Отраслевой отчёт: рынок логистики вырос на 6% за квартал.",
    sentiment: "neutral",
  },
  {
    id: "msg-05",
    time: "14:30:48",
    source: "wa.me/logistics-open",
    platform: "WhatsApp",
    author: "Ольга В.",
    text: "Склад отгрузил вовремя, курьер приехал раньше слота. Всё отлично!",
    sentiment: "positive",
  },
  {
    id: "msg-06",
    time: "14:30:21",
    source: "discord.gg/gaming-hub",
    platform: "Discord",
    author: "nightowl",
    text: "Приложение падает при переключении аккаунтов, третий раз за день.",
    sentiment: "negative",
  },
  {
    id: "msg-07",
    time: "14:29:59",
    source: "@crypto_digest_ru",
    platform: "Telegram",
    author: "Илья Р.",
    text: "Подписка продлилась автоматически, уведомление пришло заранее — удобно.",
    sentiment: "positive",
  },
  {
    id: "msg-08",
    time: "14:29:33",
    source: "@retail_analytics",
    platform: "Telegram",
    author: "Данила Т.",
    text: "Кто на маркетплейсе считает юнит-экономику по когортам, а не по месяцу?",
    sentiment: "neutral",
  },
  {
    id: "msg-09",
    time: "14:29:04",
    source: "@pharma_news",
    platform: "Telegram",
    author: "Аптека Дайджест",
    text: "Обновились правила маркировки, срок перехода продлили до конца квартала.",
    sentiment: "neutral",
  },
  {
    id: "msg-10",
    time: "14:28:41",
    source: "discord.gg/devs-community",
    platform: "Discord",
    author: "kate.builds",
    text: "Оплата картой отклоняется без внятной ошибки — это только у меня?",
    sentiment: "negative",
  },
  {
    id: "msg-11",
    time: "14:28:15",
    source: "wa.me/open-retail",
    platform: "WhatsApp",
    author: "Тимур А.",
    text: "Скидка по промокоду применилась корректно, спасибо команде.",
    sentiment: "positive",
  },
  {
    id: "msg-12",
    time: "14:27:52",
    source: "@media_monitor",
    platform: "Telegram",
    author: "Пресс-служба",
    text: "Аналитика по упоминаниям бренда за неделю опубликована в открытом доступе.",
    sentiment: "neutral",
  },
  {
    id: "msg-13",
    time: "14:27:20",
    source: "@crypto_digest_ru",
    platform: "Telegram",
    author: "Вера С.",
    text: "Поддержка ответила за четыре минуты и решила вопрос сразу.",
    sentiment: "positive",
  },
  {
    id: "msg-14",
    time: "14:26:58",
    source: "discord.gg/gaming-hub",
    platform: "Discord",
    author: "mrx",
    text: "Тариф вырос почти вдвое, при этом лимиты остались прежними.",
    sentiment: "negative",
  },
]

/** Заготовки, из которых собирается «живой» поток на странице /dashboard/stream. */
export const streamTemplates: Omit<StreamMessage, "id" | "time">[] = [
  {
    source: "@crypto_digest_ru",
    platform: "Telegram",
    author: "Артём Л.",
    text: "Появился новый тариф для малых команд, лимиты выглядят адекватно.",
    sentiment: "positive",
  },
  {
    source: "discord.gg/devs-community",
    platform: "Discord",
    author: "sam_codes",
    text: "Кто-нибудь тянет вебхуки через очередь? Ищу пример на проде.",
    sentiment: "neutral",
  },
  {
    source: "@retail_analytics",
    platform: "Telegram",
    author: "Наталья Ж.",
    text: "Доставка снова опоздала на два дня, второй заказ подряд.",
    sentiment: "negative",
  },
  {
    source: "wa.me/logistics-open",
    platform: "WhatsApp",
    author: "Павел Д.",
    text: "Склад подтвердил отгрузку, трек-номер пришёл моментально.",
    sentiment: "positive",
  },
  {
    source: "@media_monitor",
    platform: "Telegram",
    author: "Newsroom Bot",
    text: "Свежая сводка: упоминания категории выросли на 9% за сутки.",
    sentiment: "neutral",
  },
  {
    source: "discord.gg/gaming-hub",
    platform: "Discord",
    author: "vortex",
    text: "Приложение опять выкидывает из аккаунта после обновления.",
    sentiment: "negative",
  },
  {
    source: "@pharma_news",
    platform: "Telegram",
    author: "Ирина М.",
    text: "Интеграция с учётной системой заработала без правок на нашей стороне.",
    sentiment: "positive",
  },
  {
    source: "@crypto_digest_ru",
    platform: "Telegram",
    author: "Глеб Н.",
    text: "Обсуждаем подписку на аналитику — кто уже пробовал годовой план?",
    sentiment: "neutral",
  },
  {
    source: "wa.me/open-retail",
    platform: "WhatsApp",
    author: "Ксения Б.",
    text: "Возврат висит в обработке пятый день, статус не меняется.",
    sentiment: "negative",
  },
  {
    source: "@retail_analytics",
    platform: "Telegram",
    author: "Максим О.",
    text: "Маркетплейс выкатил новый отчёт по когортам, данные сходятся с нашими.",
    sentiment: "positive",
  },
]

export const datasets: Dataset[] = [
  {
    id: "ds-01",
    name: "Упоминания бренда · неделя 34",
    source: "@crypto_digest_ru",
    rows: 48210,
    format: "CSV",
    createdAt: "28 авг 2026",
    size: "12,4 МБ",
  },
  {
    id: "ds-02",
    name: "Тональность обсуждений доставки",
    source: "@retail_analytics",
    rows: 21764,
    format: "JSON",
    createdAt: "27 авг 2026",
    size: "8,1 МБ",
  },
  {
    id: "ds-03",
    name: "Каналы Discord · сырые сообщения",
    source: "discord.gg/devs-community",
    rows: 132090,
    format: "JSON",
    createdAt: "25 авг 2026",
    size: "44,7 МБ",
  },
  {
    id: "ds-04",
    name: "Ключевые слова · логистика",
    source: "wa.me/logistics-open",
    rows: 9312,
    format: "CSV",
    createdAt: "24 авг 2026",
    size: "2,3 МБ",
  },
  {
    id: "ds-05",
    name: "Поток упоминаний (стрим)",
    source: "Все источники",
    rows: 512400,
    format: "API",
    createdAt: "22 авг 2026",
    size: "поток",
  },
  {
    id: "ds-06",
    name: "Медиа-повестка · август",
    source: "@media_monitor",
    rows: 63870,
    format: "CSV",
    createdAt: "20 авг 2026",
    size: "16,9 МБ",
  },
  {
    id: "ds-07",
    name: "Негативные обращения · выборка",
    source: "Все источники",
    rows: 7405,
    format: "JSON",
    createdAt: "18 авг 2026",
    size: "3,2 МБ",
  },
]

export const currentUser = {
  name: "Максим Орлов",
  email: "maxim@onixdata.io",
  initials: "МО",
  role: "Владелец рабочей области",
}

export const notificationsCount = 5

export const demoApiKey = "onix_sk_demo_4f2b91c07ae54d18bd3c6a0f7e15"

export const exportFormats: DatasetFormat[] = ["CSV", "JSON", "API"]
