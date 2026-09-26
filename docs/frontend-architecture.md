# Архитектура Frontend и история изменений OnixData

Этот документ фиксирует актуальное состояние кодовой базы frontend (`onixdata-app`) после перехода от старого UI-прототипа к полноценной интеграции.

---

## 1. Авторизация (Supabase Auth)

В старой версии формы `/login`, `/register`, `/forgot-password` были заглушками, которые просто показывали тост и перенаправляли на дашборд.

### Текущая реализация:
- **Библиотека**: `@supabase/supabase-js`.
- **Конфигурация** (`.env.local`):
  ```dotenv
  NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
  ```
- **Клиент**: [`lib/supabase/client.ts`](file:///c:/Coding/Projects/onixdata-app/lib/supabase/client.ts) с `persistSession: true`, `autoRefreshToken: true`.
- **Провайдер и контекст**: [`lib/supabase/auth-context.tsx`](file:///c:/Coding/Projects/onixdata-app/lib/supabase/auth-context.tsx) (`AuthProvider`, хук `useAuth()`). Подключён в корневом [`app/layout.tsx`](file:///c:/Coding/Projects/onixdata-app/app/layout.tsx). Имеет fallback для безопасного изолированного рендеринга и тестов.
- **Страницы**:
  - [`app/(auth)/login/page.tsx`](file:///c:/Coding/Projects/onixdata-app/app/(auth)/login/page.tsx): реальный вызов `signIn(email, password)`, индикация загрузки, обработка ошибок, переход в `/dashboard`.
  - [`app/(auth)/register/page.tsx`](file:///c:/Coding/Projects/onixdata-app/app/(auth)/register/page.tsx): реальный вызов `signUp(email, password, name)`, сохранение `full_name` в метаданных, поддержка подтверждения почты.
  - [`app/(auth)/forgot-password/page.tsx`](file:///c:/Coding/Projects/onixdata-app/app/(auth)/forgot-password/page.tsx): реальный сброс пароля через `resetPassword(email)`.
  - [`components/auth/oauth-buttons.tsx`](file:///c:/Coding/Projects/onixdata-app/components/auth/oauth-buttons.tsx): вызовы `signInWithOAuth` для Google и GitHub.
  - [`components/dashboard/topbar.tsx`](file:///c:/Coding/Projects/onixdata-app/components/dashboard/topbar.tsx): динамическое отображение профиля (имя, email, аватар с инициалами) и рабочий `signOut()`.

---

## 2. API-клиент Swagger Viber Parser

Сервис автоматизации и парсинга Viber перенесён на Kotlin 2.1 / Ktor 3.5 с OpenAPI / Swagger (`C:\Coding\Projects\Viber-parser`, порт `8080`).

### Структура API-клиента:
- **Папка**: [`lib/viber-parser-api/`](file:///c:/Coding/Projects/onixdata-app/lib/viber-parser-api/)
  - `types.ts`: Строгая типизация моделей данных Ktor/Swagger:
    - `ViberStartRequest`, `ViberStatusResponse`
    - `ViberLoginRequest`, `ViberLoginResponse`, `ViberCodeRequest` (ввод номера и кода авторизации Viber)
    - `GroupSummary`, `GroupDetail`, `ParticipantModel`, `CollectParticipantsRequest`, `OnlineStatusItem`
    - `TaskSummary`, `TaskDetail`, `TaskStep`, `StopTaskResponse`
    - `DatabaseStats`, `SyncResult`, `DecodeRequest`, `DecodeResult`
    - `StartMonitorRequest`, `MonitorStatus`, `MonitoredMessage`
    - `Campaign`, `CreateCampaignRequest`, `BroadcastStatus`, `SendHistoryEntry`
    - `ViberUserRow`, `UsersPage`, `UsersSyncResult`
  - `client.ts`: Класс `ViberParserApiClient` и синглтон `viberParserApi`:
    - Модули: `viber`, `auth`, `groups`, `participants`, `tasks`, `database`, `messages`, `broadcast`, `users`.
  - `client.test.ts`: Unit-тесты для клиента.
  - `index.ts`: Реэкспорт типов и клиента.

### Проксирование через Next.js Route Handlers:
Чтобы исключить CORS в браузере и централизовать таймауты:
- URL бэкенда задаётся в `VIBER_PARSER_URL` (`http://127.0.0.1:8080`).
- В [`app/api/viber/[...path]/route.ts`](file:///c:/Coding/Projects/onixdata-app/app/api/viber/[...path]/route.ts) и [`lib/viber-parser/proxy.ts`](file:///c:/Coding/Projects/onixdata-app/lib/viber-parser/proxy.ts) добавлены маршруты:
  - `POST /api/auth/phone`
  - `POST /api/auth/code`
  - `GET /api/viber/status`
  - `POST /api/viber/start`
  - `GET /api/users`
  - `POST /api/users/sync/group/:id`
  - `POST /api/users/sync/task/:id`
  - Существующие маршруты задач, групп, мониторинга и рассылки.

---

## 3. Запуск и тестирование

```bash
npm run dev        # Next.js dev сервер (http://localhost:3000)
npm run typecheck  # Проверка TypeScript
npm run test       # Запуск Vitest (19 тест-сьютов, 185 тестов)
```
