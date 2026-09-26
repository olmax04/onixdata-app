/**
 * Тайминги опроса и потока событий сервиса сбора.
 *
 * Живут отдельно от компонента, потому что от них зависит логика состояния
 * связи (`connection.ts`): порог «данные устарели» обязан быть больше, чем
 * цикл опроса плюс клиентский таймаут запроса.
 */

/** Интервал фонового опроса статуса. */
export const STATUS_POLL_MS = 2_500

/** Клиентский таймаут запроса статуса (чуть больше таймаута прокси — 20 с). */
export const STATUS_REQUEST_TIMEOUT_MS = 25_000

/** Клиентский таймаут запроса деталей задачи (прокси ждёт апстрим до 65 с). */
export const TASK_DETAIL_REQUEST_TIMEOUT_MS = 70_000

/** Пересчёт «свежести» связи между опросами. */
export const CONNECTION_TICK_MS = 3_000

/** Переподключение потока событий после обрыва. */
export const SSE_RETRY_BASE_MS = 1_500
export const SSE_RETRY_MAX_MS = 20_000
export const SSE_MAX_ATTEMPTS = 8

/** Соединение, прожившее столько, считаем рабочим и обнуляем счётчик попыток. */
export const SSE_HEALTHY_MS = 30_000

/** Дотягивание финального stepHistory после завершения задачи. */
export const FINALIZE_ATTEMPTS = 5
export const FINALIZE_RETRY_MS = 1_500
