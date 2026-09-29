# Деплой на GCP (docker compose + Caddy)

Панель собирается из этого репозитория на VM (`/home/kkurzau/onixdata-app`)
и запускается сервисом `onixdata-client` в общем compose рядом с Viber-parser,
эмуляторами и Caddy. Caddy терминирует HTTPS и проксирует домен панели в
`onixdata-client:3000`.

## Сервис в compose

```yaml
  onixdata-client:
    build:
      context: /home/kkurzau/onixdata-app
      dockerfile: Dockerfile
    container_name: onixdata-client
    restart: unless-stopped
    env_file:
      - /home/kkurzau/onixdata-app/.env
    extra_hosts:
      # scrcpy-web (8000) и emulator-agent (9000) опубликованы на хосте VM
      - "host.docker.internal:host-gateway"
```

- Файл переменных подключается через `env_file`. Строка
  `environment: - /path/.env` файл **не** читает: она объявляет переменную с
  таким именем.
- `.env` лежит в контексте сборки, поэтому Next.js при `next build`
  запекает его в образ (и `NEXT_PUBLIC_*` тоже). После правки `.env` образ
  нужно пересобрать: `docker compose up -d --build onixdata-client`.
- Порт 3000 наружу не публикуется — к панели ходит только Caddy.

## Caddy

WebSocket Caddy проксирует сам, отдельная настройка не нужна:

```caddyfile
panel.example.com {
    reverse_proxy onixdata-client:3000
}
```

## Переменные (`/home/kkurzau/onixdata-app/.env`)

```dotenv
# REST API Viber-parser: имя сервиса в compose и порт ВНУТРИ его контейнера
VIBER_PARSER_URL=http://viber-parser-api:8080

# emulator-agent (управление инстансами) и его секрет
EMULATOR_AGENT_URL=http://host.docker.internal:9000
VPS_AGENT_SECRET=...

# scrcpy-web: куда панель проксирует /scrcpy/ (изнутри контейнера)...
SCRCPY_URL=http://host.docker.internal:8000
# ...и адрес для прямой ссылки из браузера (запасной вариант)
SCRCPY_PUBLIC_URL=http://<внешний IP VM>:8000

NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Экран в панели открывается через `https://<домен>/scrcpy/…`, поэтому порт 8000
в firewall GCP нужен только для прямой ссылки; его можно закрыть.

На стороне emulator-agent задайте `HOST_PUBLIC_IP` (в `docker-compose.vps.yml`
это `VPS_PUBLIC_IP`) внешним IP VM — иначе агент отдаёт ссылки на `localhost`.
Панель их исправляет, но другим клиентам агента это не поможет.

## Обновление

```bash
cd ~/onixdata-app
git fetch origin && git checkout <ветка> && git pull
cd <каталог с docker-compose.yml>
docker compose up -d --build onixdata-client
docker compose logs -f --tail=50 onixdata-client
```

Проверка связности изнутри контейнера:

```bash
docker compose exec onixdata-client wget -qO- http://host.docker.internal:8000/ | head -c 200
docker compose exec onixdata-client wget -qO- "$VIBER_PARSER_URL/api/viber/status"
```

Контейнер стартует командой `node server/start.cjs` (см. Dockerfile): это
стандартный `server.js` Next.js плюс WebSocket-прокси экрана. Запуск через
`node server.js` оставит экран без трансляции.
