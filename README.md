# OnixData

Интерфейс продукта **OnixData** (сервис парсинга публичных данных из
мессенджеров): экраны авторизации, дашборд и управление Viber Parser.

Собран на Next.js 14 (App Router) + TypeScript + Tailwind CSS + готовых
компонентах **shadcn/ui** (стиль `new-york`, исходники лежат в
`components/ui/`).

## Запуск

```bash
npm install
Copy-Item .env.example .env.local
npm run dev
```

Приложение поднимется на <http://localhost:3000> и сразу перенаправит на
`/login`.

Прочие команды:

```bash
npm run build       # продакшен-сборка
npm run start       # запуск собранного приложения
npm run lint        # ESLint (next/core-web-vitals)
npm run typecheck   # проверка типов
npm run test        # vitest
npm run mock:viber  # мок-бэкенд Viber Parser для разработки
```

> Для первой сборки нужен интернет: шрифт **Inter Tight** подключён через
> `next/font/google` и скачивается на этапе сборки.

Для Unix-подобной оболочки вместо `Copy-Item` используйте
`cp .env.example .env.local`.

## Подключение Viber Parser

Разделы `/dashboard/viber`, `/dashboard/stream` и `/dashboard/broadcast`
работают с NestJS-сервисом `viber-bot` (соседний проект
`C:\Coding\Projects\viber-bot`; более старая сборка без модуля рассылки лежит в
`Viber-parser/viber-bot`). Панели ходят не в бэкенд напрямую, а через прокси
Next.js `app/api/viber/[...path]/route.ts`. Адрес бэкенда задаётся серверной
переменной `VIBER_PARSER_URL` (по умолчанию `http://127.0.0.1:3001`), префикс
`NEXT_PUBLIC_` ей не нужен:

```dotenv
VIBER_PARSER_URL=http://127.0.0.1:3001
```

Запустите `viber-bot` согласно его README, затем откройте раздел
**Группы Viber** в навигации OnixData.

### Бэкенд на VM в GCP (Compute Engine)

Браузер в VM не ходит: запросы отправляет сервер Next.js, поэтому бэкенд
должен быть доступен **с машины, где запущен OnixData**, а не из браузера.

| Переменная | Пример | Что делает |
| --- | --- | --- |
| `VIBER_PARSER_URL` | `http://34.118.10.20:3001` | внешний IP VM и порт viber-bot |
| | `https://api.example.com/viber-bot` | бэкенд за nginx; префикс пути сохраняется |
| | `https://user:pass@api.example.com` | basic auth: логин и пароль уходят заголовком `Authorization: Basic` |
| `VIBER_PARSER_TOKEN` | `длинная-случайная-строка` | уходит с каждым запросом как `Authorization: Bearer …` |

Логин в URL и `VIBER_PARSER_TOKEN` одновременно указать нельзя. После
изменения `.env.local` перезапустите `npm run dev` / `npm run start`.

Порядок настройки:

1. **Статический внешний IP.** Эфемерный IP меняется после остановки VM.
   Закрепите его: VPC network → IP addresses → Reserve (или
   `gcloud compute addresses create …`).
2. **viber-bot слушает `0.0.0.0`**, а не `127.0.0.1`, иначе снаружи порт
   закрыт даже при открытом firewall. Проверка на VM:
   `ss -ltnp | grep 3001`.
3. **Правило firewall.** Откройте порт только для IP сервера OnixData, не
   для `0.0.0.0/0`: бэкенд отдаёт номера телефонов и сам запросы не
   авторизует.

   ```bash
   gcloud compute firewall-rules create allow-viber-bot \
     --network=default --direction=INGRESS --action=ALLOW \
     --rules=tcp:3001 --source-ranges=<IP_СЕРВЕРА_ONIXDATA>/32 \
     --target-tags=viber-bot
   gcloud compute instances add-tags <VM_NAME> --zone=<ZONE> --tags=viber-bot
   ```

4. **Проверка** с машины OnixData: `curl http://<EXTERNAL_IP>:3001/api/tasks`
   должен вернуть JSON-массив. Затем `curl http://localhost:3000/api/viber/status`.

Если IP сервера OnixData заранее неизвестен (Vercel, домашний интернет),
поставьте перед viber-bot nginx с HTTPS и проверкой токена, а порт 3001
оставьте закрытым снаружи. Буферизацию нужно отключить, а таймауты поднять:
иначе рвутся SSE и долгие операции (дешифровка идёт до 6 минут).

```nginx
location /viber-bot/ {
    if ($http_authorization != "Bearer <VIBER_PARSER_TOKEN>") { return 401; }
    proxy_pass http://127.0.0.1:3001/;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_buffering off;
    proxy_read_timeout 600s;
    proxy_send_timeout 600s;
}
```

```dotenv
VIBER_PARSER_URL=https://api.example.com/viber-bot
VIBER_PARSER_TOKEN=<тот же токен>
```

Если вместо nginx используется HTTP(S) Load Balancer GCP, поднимите таймаут
backend service (по умолчанию 30 с) минимум до 600 с по той же причине.

Токен и basic auth по голому `http://` передаются открытым текстом, поэтому
вместе с ними используйте HTTPS. Локально авторизацию проверяет
`MOCK_TOKEN=secret npm run mock:viber` вместе с `VIBER_PARSER_TOKEN=secret`.

### Что делает прокси

**Консолидированный статус.** `GET /api/viber/status` — единственный запрос,
которым панель опрашивает бэкенд. Прокси сам ходит в `/api/tasks` (таймаут
15 с), выбирает активную задачу (`initializing | starting | running`, иначе
последнюю по `createdAt`), дозапрашивает её `/api/tasks/:id` и возвращает
`state`, `isDriverActive`, `taskId`, `task` (детали с историей шагов),
`tasks` (до 50 последних), `currentStep`, `progress`, `groupName`, `fetchedAt`.

Если бэкенд недоступен или не ответил вовремя, прокси отдаёт **503/504 с телом
`{ "error": "…" }`**, а не `200 { state: "ERROR" }`. Так клиент отличает
«бэкенд не поднят» от «последняя задача упала» и не сбрасывает экран. Если
список задач получен, а детали нет, возвращается `200` с `task: null`.

**SSE-прокси.** Потоки `GET /api/viber/tasks/:id/events` и
`GET /api/viber/messages/events` пробрасывают обрыв клиента в upstream
(соединение к бэкенду закрывается, утечек нет), проверяют, что upstream отдал
`text/event-stream`, и раз в 15 секунд вставляют в поток комментарий `: ping`.
У бэкенда heartbeat нет, а на шагах `restarting_viber` (до 60 с) и
`waiting_numbers_sync` (до 45 с) поток молчит — без heartbeat такое соединение
рвётся.

**Санитизация тел запросов.** Бэкенд поднят с
`ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })`: любое лишнее
поле в body — HTTP 400. Прокси отправляет строго разрешённые поля:

- `POST /api/viber/participants/collect` → `group, allowPartial, restartApp,
  idleTimeoutMs, numbersSyncTimeoutMs, syncLiveDbAfter, fetchOnlineStatus`
  (таймаут 65 с, 409 «эмулятор занят» пробрасывается с текстом). `group` —
  имя группы или числовой `conversationId`; группа без имени запускается по ID;
- `POST /api/viber/database/decode` → `dryRun, limit, restartApp,
  waitForSyncSeconds` (таймаут 6 минут);
- `POST /api/viber/database/sync` — таймаут 4 минуты (бут LDPlayer до 180 с).

**Allowlist маршрутов.** Проксирование произвольных путей убрано, `PUT` не
поддерживается. Разрешены только:

| Метод | Маршрут |
| --- | --- |
| GET | `status`, `groups`, `groups/:id`, `groups/:id/members` (`/participants`) |
| GET | `tasks`, `tasks/:id`, `tasks/:id/events`, `tasks/:id/participants` |
| GET | `database/stats` |
| GET | `messages/events`, `messages/monitor/events`, `messages/monitor/status`, `messages/monitor/groups`, `messages/monitored`, `messages/monitored/export` |
| GET | `broadcast/status`, `broadcast/campaigns[/:id]`, `broadcast/history[/last]` |
| POST | `participants/collect`, `participants/online-status`, `database/decode`, `database/sync`, `stop`, `tasks/:id/stop`, `messages/monitor/start|stop`, `messages/monitor/groups/:id/enable|disable`, `broadcast/campaigns`, `broadcast/campaigns/:id/start|stop` |
| PATCH / DELETE | `broadcast/campaigns/:id` |

Всё остальное — `404 { "error": "Маршрут не поддерживается" }`. Ошибки везде в
едином формате `{ "error": "…" }`: 502 — бэкенд недоступен, 504 — таймаут,
иначе статус upstream и его `message`/`error`. Роуты `/api/viber/*` ничем не
защищены (см. раздел ниже).

### Синхронизация на клиенте

Ядро — `lib/viber-parser/parser-sync.ts` (чистый редьюсер) и
`lib/viber-parser/use-parser-sync.ts` (хук `useViberParserSync`):

- **один** цикл опроса: цепочка `setTimeout`, `AbortController` на запрос,
  следующий тик только после ответа предыдущего;
- адаптивный интервал: 2 с при активной задаче, 5 с в покое, backoff 5→10→20 с
  при потере связи, 30 с на скрытой вкладке (возврат к вкладке и событие
  `online` дают немедленный опрос);
- sequence guard: устаревший ответ не перетирает свежий;
- **ошибка опроса ничего не сбрасывает** — статус, задача, история и участники
  остаются на экране, растёт счётчик ошибок. Шапка показывает три состояния:
  «Онлайн» → «Переподключение… (n)» (1–2 ошибки) → «Офлайн» (≥3 ошибок или
  более 12 с без успешного ответа);
- SSE активной задачи мержится в состояние (`status`, `step`, `progress`,
  `error`); `onerror` поток **не закрывает** — браузер переподключается сам, а
  первый успешный `onopen` после обрыва запускает добор данных опросом;
- побочные эффекты завершения (тост, обновление групп/участников/статистики)
  выполняются ровно один раз на задачу — неважно, пришёл терминальный статус по
  SSE или его первым увидел поллинг.

Загрузчики групп, участников, статистики и монитора при ошибке сохраняют
предыдущие данные и показывают inline-ошибку с кнопкой «Повторить». История
задач живёт в памяти процесса бэкенда и очищается при его перезапуске.

### Мок-бэкенд для отладки

Запускать эмулятор для проверки интерфейса не нужно:

```bash
npm run mock:viber
```

```bash
PORT=3001 MOCK_CHAOS=1 npm run mock:viber
```

```bash
PORT=3001 MOCK_NO_BROADCAST=1 npm run mock:viber
```

Первый вариант поднимает мок на порту 3001. `MOCK_CHAOS=1` роняет или
подвешивает на 8 с около четверти запросов к `/api/tasks`, `MOCK_NO_BROADCAST=1`
имитирует старую сборку без модуля рассылки (404 на `/api/broadcast/*`).

`scripts/mock-viber-backend.mjs` — чистый Node без зависимостей. Он повторяет
контракт бэкенда: валидирует тела как `ValidationPipe` (лишнее поле → 400),
проигрывает все 11 шагов сбора с реальными ключами прогресса, молчит 40 секунд
на шаге `waiting_numbers_sync` (именно это воспроизводило «бот выключился»),
отвечает 409 при занятом эмуляторе, закрывает SSE при завершении задачи и отдаёт
пустой поток для уже завершённой. Задачи живут в памяти процесса — после
перезапуска мока история пуста, как и у настоящего бэкенда.

## Важно: остальная часть интерфейса остаётся прототипом

- **Реальная интеграция есть только в разделах Viber.** «Группы Viber»,
  «Мониторинг Viber» и «Рассылка Viber» ходят в NestJS-сервис viber-bot; остальные экраны
  продолжают использовать демонстрационные данные и действия.
- **Авторизация — UI-only.** Формы входа, регистрации и восстановления пароля
  валидируются на клиенте (zod + react-hook-form), но никого не аутентифицируют:
  успешная отправка показывает тост и переводит на `/dashboard`. Роуты дашборда
  и `/api/viber/*` ничем не защищены, поэтому приложение нельзя публиковать в
  открытый доступ без добавления авторизации.
- **OAuth-кнопки — заглушки.** Google и GitHub показывают тост
  «Демо: OAuth не подключён».
- **Данные обзора — мок.** Источники, сообщения, метрики и график на
  `/dashboard` лежат в `lib/mock-data.ts`. Числа вымышленные и приведены только
  для демонстрации интерфейса, это не результаты реальных клиентов.
- **Действия вне разделов Viber — заглушки.** Поиск в топбаре, уведомления,
  диалог новой задачи парсинга, сохранение профиля и копирование API-ключа
  только показывают тосты.

## Страницы

| Маршрут                     | Назначение                                        |
| --------------------------- | ------------------------------------------------- |
| `/`                         | редирект на `/login`                              |
| `/login`                    | вход                                              |
| `/register`                 | регистрация                                       |
| `/forgot-password`          | восстановление пароля                             |
| `/dashboard`                | обзор: метрики, график, топ слов, последние сообщения |
| `/dashboard/viber`          | группы Viber: сессия, сбор участников, номера     |
| `/dashboard/stream`         | мониторинг Viber: поток сообщений и экспорт       |
| `/dashboard/broadcast`      | рассылка Viber: отправка по группам               |
| `/dashboard/settings`       | профиль / API / уведомления                       |
| `/design-system`            | живой стайлгайд: токены, шкалы, каталог компонентов |

## Тема и бренд

Приложение работает **только в тёмной теме**: на `<html>` жёстко стоит
`className="dark"`, а палитра продублирована в `:root` и `.dark`
(`app/globals.css`), поэтому переключатель тем не нужен и «вспышки» светлого
фона нет.

Бренд-акцент — коралловый `#ff8975` (переменная `--primary`). Он используется
точечно: ключевые кнопки, активные состояния и данные графика. Логотип —
`components/brand-logo.tsx`.

## Дизайн-система

Правила интерфейса зафиксированы в двух местах:

- [`docs/design-system.md`](docs/design-system.md) — принципы, токены, шкалы
  типографики и отступов, layout-паттерны, каталог компонентов, состояния,
  список do/don't и чек-лист для новых экранов.
- Маршрут [`/design-system`](http://localhost:3000/design-system) — живой
  стайлгайд: свотчи всех CSS-переменных, образцы типографики, шкалы, демо
  анимаций и галерея компонентов на реальных данных. Страница лежит вне
  групп `(auth)` и `(dashboard)`, в навигацию не добавлена; подкомпоненты —
  в `components/design-system/`.

HEX-значения продублированы только в `lib/design-tokens.ts` (для подписей на
странице и в документе). В компонентах цвет берётся Tailwind-классом или через
`hsl(var(--…))`.
