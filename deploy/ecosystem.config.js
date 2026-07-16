/**
 * PM2 ecosystem — Sporteo на Hostiman VPS (P2 deploy pack).
 *
 * Артефакт standalone-билда разворачивается в /srv/sporteo/current
 * (versioned-релизы + симлинк, см. docs/deploy/HOSTIMAN.md §6).
 * Runtime-секреты — в /srv/sporteo/.env (chmod 600), НЕ в этом файле
 * и не в репозитории. NEXT_PUBLIC_* переменные запекаются на этапе
 * билда в CI — менять их в .env на сервере бессмысленно.
 *
 * PM2 НЕ читает .env-файлы сам (env_file — не его опция, dotenv в
 * зависимостях приложения нет). Секреты подгружаются в окружение шелла
 * ПЕРЕД стартом — PM2 снимет снапшот env процесса:
 *
 *   set -a; source /srv/sporteo/.env; set +a
 *   pm2 start deploy/ecosystem.config.js
 *   pm2 startup systemd && pm2 save        # автозапуск после ребута
 *
 * После изменения .env: тот же source + `pm2 restart sporteo --update-env`.
 * Обычный деплой релиза: `pm2 reload sporteo` (graceful).
 */
module.exports = {
  apps: [
    {
      name:   'sporteo',
      cwd:    '/srv/sporteo/current',
      script: 'server.js',            // .next/standalone/server.js
      env: {
        NODE_ENV: 'production',
        PORT:     3000,
        HOSTNAME: '127.0.0.1',        // наружу смотрит только nginx
      },
      instances: 1,                   // RVDS2 (2 ядра): 1 инстанс + nginx
      max_memory_restart: '900M',
      out_file:  '/var/log/sporteo/out.log',
      error_file: '/var/log/sporteo/err.log',
      merge_logs: true,
      time: true,
    },
    {
      // Telegram-воркер (P2): очередь уведомлений каждые 15с + аварийный
      // long-polling (TELEGRAM_MODE=polling в .env, если вебхук-трафик
      // начнут фильтровать). Zero-dependency: файл копируется из репо —
      //   cp deploy/telegram-worker.mjs /srv/sporteo/
      // ЗАМЕНЯЕТ crontab-строку про process-queue (см. crontab.sample).
      name:   'sporteo-tg-worker',
      cwd:    '/srv/sporteo',
      script: 'telegram-worker.mjs',
      interpreter: 'node',
      env: {
        NODE_ENV: 'production',
        APP_INTERNAL_URL: 'http://127.0.0.1:3000',
      },
      max_memory_restart: '150M',
      out_file:  '/var/log/sporteo/tg-worker.log',
      error_file: '/var/log/sporteo/tg-worker.log',
      merge_logs: true,
      time: true,
    },
  ],
}
