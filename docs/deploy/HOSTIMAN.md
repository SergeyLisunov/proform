# Деплой Sporteo на Hostiman (P2)

Гайд переезда с Vercel на VPS Hostiman. Основан на исследовании
июля 2026 (тарифы Hostiman, RU-специфика Telegram, self-hosted Next.js 16).

## 0. Что заказывать

**RVDS2 (~1 100 ₽/мес): 2 ядра, 2 GB DDR4, 40 GB NVMe, локация ЕВРОПА.**

Почему именно так:

- **Shared-хостинг не подходит**: устойчивого Node.js-процесса там нет
  (тарифная страница обещает только PHP+MySQL+Cron); нужен VPS с root.
- **Локация Европа — обязательна**, не опция:
  1. `api.telegram.org` с 2025–2026 фильтруется из российских ЦОД
     (задокументировано для Selectel, Reg.ru и др.; ситуация меняется
     неделя к неделе) — бот на RU-локации может умереть в любой момент;
  2. Supabase живёт в eu-central-1 (Франкфурт): из EU ~10–25 мс на
     запрос, из RU — 50–80+ мс с риском трансграничной фильтрации,
     а SSR-страницы делают по несколько запросов подряд;
  3. в Европе канал 1 Gbps против 100 Mbps в RU.
- 2 GB хватает: standalone-сервер (~200–400 MB RSS) + nginx.
  **`next build` на этой машине НЕ запускать** (OOM) — билд в CI.
- У Hostiman есть 14-дневный бесплатный триал VDS — проверьте с сервера
  `curl https://api.telegram.org/bot<TOKEN>/getMe`, `curl -sI
  https://ollama.com` (AI-провайдер) и латентность до
  `hhyjihbctidtucvpgjzv.supabase.co` ДО оплаты.

## 1. Первичная настройка сервера (Ubuntu 24.04)

```bash
adduser deploy && usermod -aG sudo deploy   # не работаем под root
ufw allow 22 && ufw allow 80 && ufw allow 443 && ufw enable

# Node 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs nginx certbot python3-certbot-nginx
npm i -g pm2

mkdir -p /srv/sporteo /var/log/sporteo
chown -R deploy:deploy /srv/sporteo /var/log/sporteo
```

## 2. Билд — в CI, не на сервере

`next.config.mjs` уже содержит `output: 'standalone'` (на Vercel ключ
безвреден). В GitHub Actions (или локально):

```bash
npm ci --legacy-peer-deps
npm run build
# Артефакт = .next/standalone + статика внутрь него:
cp -r .next/static .next/standalone/.next/static
cp -r public       .next/standalone/public
cd .next/standalone && npm i sharp   # оптимизация изображений self-hosted
```

**NEXT_PUBLIC_\*-переменные запекаются при билде** — задавайте их в CI,
на сервере менять поздно.

## 3. Раскладка релизов

```
/srv/sporteo/
  releases/2026-07-16T18-00/   ← rsync артефакта сюда
  current -> releases/…        ← симлинк
  .env                         ← runtime-секреты, chmod 600
```

Деплой: rsync нового релиза → переключить симлинк → `pm2 reload sporteo`
(graceful, без даунтайма). `.next/cache` держите на постоянном диске
(ISR/fetch-кэш переживает релизы).

## 4. Процесс и прокси

- PM2 (секреты — через окружение шелла, PM2 снимет снапшот; .env-файлы
  сам он не читает):

  ```bash
  set -a; source /srv/sporteo/.env; set +a
  pm2 start deploy/ecosystem.config.js
  pm2 startup systemd && pm2 save
  ```

  Изменили `.env` → тот же `source` + `pm2 restart sporteo --update-env`.

- ecosystem поднимает **два** процесса: `sporteo` (веб) и
  `sporteo-tg-worker` (очередь Telegram каждые 15с + аварийный
  polling-режим; ~30 MB RSS). Воркер — один файл вне
  standalone-артефакта, перед первым стартом:

  ```bash
  cp deploy/telegram-worker.mjs /srv/sporteo/
  ```

  Подробности и аварийный режим — `docs/deploy/TELEGRAM-BOT.md`.
- nginx: `deploy/nginx.conf.sample` → sites-available, поправить домен.
  Статику `_next/static` nginx отдаёт сам с `immutable` (CDN больше нет).
- TLS: `certbot --nginx -d <домен>` — Let's Encrypt, автопродление.
  **CA-signed сертификат обязателен**: self-signed молча ломает
  callback'и Альфа-Банка и вебхук Telegram.

## 5. Кроны

`deploy/crontab.sample` — все расписания vercel.json 1:1 (тот же
`Authorization: Bearer $CRON_SECRET`, код роутов не менялся) плюс
**новое, чего Vercel не умел**: `/api/telegram/process-queue` раз в
минуту и healthcheck Telegram API.

## 6. Runtime-секреты (/srv/sporteo/.env)

Скопировать значения из Vercel → Project Settings → Environment
Variables. Критичные для новых P2-фич:

```
SUPABASE_SERVICE_ROLE_KEY=…
CRON_SECRET=…
RESEND_API_KEY=…
OLLAMA_API_KEY=…            # единственный AI-ключ: Gemma 4 (Ollama Cloud)
ALFABANK_USERNAME=… / ALFABANK_PASSWORD=… / ALFABANK_CALLBACK_TOKEN=…
ALFABANK_API_URL=…            # прод-URL выдаёт поддержка банка!
PAYMENTS_PROVIDER=alfabank
PLATFORM_FEE_BPS=250
TELEGRAM_BOT_TOKEN=… / TELEGRAM_BOT_USERNAME=… / TELEGRAM_WEBHOOK_SECRET=…
```

## 7. Пост-деплой чеклист

1. `curl -I https://<домен>` → 200, HSTS-заголовки на месте.
2. Callback-URL Альфы в ЛК шлюза → `https://<домен>/api/webhooks/alfabank`
   (+ «симметричная» подпись включена, токен = ALFABANK_CALLBACK_TOKEN).
3. Telegram: `bash deploy/telegram-setup.sh` с новым `APP_URL`
   (полный runbook бота — `docs/deploy/TELEGRAM-BOT.md`); вручную —
   `setWebhook` на `https://<домен>/api/telegram/webhook`
   с `secret_token` + `drop_pending_updates=true`; `/start` из настроек.
4. Кроны: `grep sporteo /var/log/sporteo/cron.log` наутро.
5. AI: с сервера `curl -sI https://ollama.com` → соединение есть. Gemma
   ходит наружу по HTTPS так же, как Telegram, — из RU-локации трафик
   может фильтроваться (ещё одна причина брать ЕВРОПУ). Затем в UI ни
   один AI-эндпоинт не должен отдавать `503 AI_NOT_CONFIGURED`.
6. DNS-переключение с Vercel — последним шагом; Vercel оставить живым
   на неделю как rollback.

## 8. Что теряем после Vercel и чем компенсируем

| Теряем | Компенсация |
|---|---|
| CDN/edge-кэш статики | nginx `immutable` для `_next/static` (глобальная латентность хуже — аудитория RU, приемлемо) |
| Vercel Cron | crontab (богаче: минутные интервалы) |
| Preview-деплои и мгновенный rollback | versioned-релизы + симлинк + `pm2 reload` |
| DDoS/WAF | опционально Cloudflare перед nginx (Full-strict с LE-сертификатом) |
| Auto-scaling | 1 VPS: следить за RAM (`pm2 monit`), апгрейд до RVDS3 (4 GB) при росте |

Риски одним списком: единая точка отказа (бэкапы!, БД в Supabase — вне
сервера), обновления безопасности теперь наши, `edge`-runtime роутов в
кодовой базе нет (проверено), фильтрация Telegram/трансграничного
трафика — мониторится healthcheck-строкой crontab.
