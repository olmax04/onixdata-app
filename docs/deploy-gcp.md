# Деплой на GCP (compose Viber-parser + Caddy)

Панель — клиент Viber-parser. Она собирается из этого репозитория на VM
(`/home/kkurzau/onixdata-app`) и запускается сервисом `onixdata-client` в
`docker-compose.yml` проекта Viber-parser (`/home/kkurzau/Viber-parser`).
Caddy терминирует HTTPS и проксирует домен панели в `onixdata-client:3000`.

Все сервисы compose сидят в одной сети (`viber-parser_default`), поэтому панель
обращается к ним по именам сервисов.

## Сервис в `Viber-parser/docker-compose.yml`

```yaml
  onixdata-client:
    build:
      context: /home/kkurzau/onixdata-app
      dockerfile: Dockerfile
    container_name: onixdata-client
    restart: unless-stopped
    env_file:
      - /home/kkurzau/onixdata-app/.env
    depends_on:
      - viber-parser-api
      - emulator-agent
      - scrcpy-web
```

- Файл переменных подключается через `env_file`. Строка
  `environment: - /path/.env` файл **не** читает: она объявляет переменную с
  таким именем.
- `.env` лежит в контексте сборки, и Next.js при `next build` запекает его в
  образ (`NEXT_PUBLIC_*` — только так). После правки `.env` образ нужно
  пересобрать.
- Порт 3000 наружу не публикуется: к панели ходит только Caddy (на хосте
  `127.0.0.1:3000` занят Grafana).

## Caddy

WebSocket Caddy проксирует сам, отдельная настройка для `/scrcpy/` не нужна:

```caddyfile
panel.example.com {
    reverse_proxy onixdata-client:3000
}
```

## Переменные панели (`/home/kkurzau/onixdata-app/.env`)

```dotenv
# REST API Viber-parser
VIBER_PARSER_URL=http://viber-parser-api:8080

# emulator-agent; секрет — как VPS_AGENT_SECRET в .env Viber-parser
EMULATOR_AGENT_URL=http://emulator-agent:9000
VPS_AGENT_SECRET=viber-secret-agent-token

# scrcpy-web: куда панель проксирует /scrcpy/ (обязательно: из адреса агента
# его не вывести)...
SCRCPY_URL=http://scrcpy-web:8000
# ...и адрес для прямой ссылки из браузера (запасной вариант)
SCRCPY_PUBLIC_URL=http://<внешний IP VM>:8000

NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Экран в панели открывается через `https://<домен>/scrcpy/…`, поэтому порт 8000
в firewall GCP нужен только для прямой ссылки; его можно закрыть.

## Переменные Viber-parser (`/home/kkurzau/Viber-parser/.env`)

```dotenv
HOST_PUBLIC_IP=<внешний IP VM>
```

Без неё emulator-agent строит ссылки на экран с `localhost`
(`HOST_PUBLIC_IP=${HOST_PUBLIC_IP:-localhost}` в compose). Панель такие
ссылки исправляет сама, но другим клиентам агента это не поможет.

## Обновление панели

```bash
cd ~/onixdata-app
git fetch origin && git checkout <ветка> && git pull
cd ~/Viber-parser
docker compose up -d --build onixdata-client
docker compose logs -f --tail=50 onixdata-client
```

Проверка связности изнутри контейнера:

```bash
docker compose exec onixdata-client wget -qO- http://scrcpy-web:8000/ | head -c 200
docker compose exec onixdata-client wget -qO- http://viber-parser-api:8080/api/viber/status
```

Контейнер стартует командой `node server/start.cjs` (см. Dockerfile): это
стандартный `server.js` Next.js плюс WebSocket-прокси экрана. Запуск через
`node server.js` оставит экран без трансляции.
