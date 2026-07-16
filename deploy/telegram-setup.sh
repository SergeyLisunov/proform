#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────
# telegram-setup.sh — настройка Telegram-бота Sporteo одной командой (P2).
#
# Что делает:
#   1. Проверяет токен (getMe) и совпадение username с TELEGRAM_BOT_USERNAME.
#   2. Регистрирует вебхук на ваш домен с secret_token (+drop_pending_updates).
#   3. Ставит меню команд бота (setMyCommands).
#   4. Показывает getWebhookInfo для контроля.
#
# Использование:
#   TELEGRAM_BOT_TOKEN=123:ABC \
#   TELEGRAM_BOT_USERNAME=SporteoBot \
#   TELEGRAM_WEBHOOK_SECRET=<случайная строка> \
#   APP_URL=https://proform-delta.vercel.app \
#     bash deploy/telegram-setup.sh
#
#   или: bash deploy/telegram-setup.sh /srv/sporteo/.env   (подхватит env-файл)
#
# Снять вебхук (например, перед переездом домена):
#   bash deploy/telegram-setup.sh --delete-webhook
#
# Полный runbook: docs/deploy/TELEGRAM-BOT.md
# ──────────────────────────────────────────────────────────────────────────
set -euo pipefail

# Подхват env-файла, если передан первым аргументом
if [[ "${1:-}" != "" && "${1:-}" != --* && -f "${1:-}" ]]; then
  set -a; # shellcheck disable=SC1090
  source "$1"; set +a
  shift || true
fi

: "${TELEGRAM_BOT_TOKEN:?Задайте TELEGRAM_BOT_TOKEN (токен из @BotFather)}"
API="https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}"

say()  { printf '\n\033[1m%s\033[0m\n' "$*"; }
fail() { printf '\033[31mОШИБКА: %s\033[0m\n' "$*" >&2; exit 1; }

# ── Режим удаления вебхука ────────────────────────────────────────────────
if [[ "${1:-}" == "--delete-webhook" ]]; then
  say "Снимаю вебхук…"
  curl -fsS "${API}/deleteWebhook?drop_pending_updates=true" | python3 -m json.tool
  exit 0
fi

: "${TELEGRAM_BOT_USERNAME:?Задайте TELEGRAM_BOT_USERNAME (имя бота без @)}"
: "${TELEGRAM_WEBHOOK_SECRET:?Задайте TELEGRAM_WEBHOOK_SECRET (openssl rand -hex 32)}"
: "${APP_URL:?Задайте APP_URL (https://домен приложения, без слэша в конце)}"

WEBHOOK_URL="${APP_URL%/}/api/telegram/webhook"

# ── 1. Токен валиден? Username совпадает? ────────────────────────────────
say "1/4 Проверяю токен (getMe)…"
ME_JSON=$(curl -fsS --max-time 15 "${API}/getMe") \
  || fail "api.telegram.org недоступен или токен неверный. С RU-хостинга Telegram может фильтроваться — проверяйте с EU-сервера или локальной машины."
echo "$ME_JSON" | python3 -m json.tool

ACTUAL_USERNAME=$(echo "$ME_JSON" | python3 -c 'import sys,json;print(json.load(sys.stdin)["result"]["username"])')
if [[ "$ACTUAL_USERNAME" != "$TELEGRAM_BOT_USERNAME" ]]; then
  fail "username бота у Telegram = '$ACTUAL_USERNAME', а в TELEGRAM_BOT_USERNAME задано '$TELEGRAM_BOT_USERNAME'. Ссылки привязки будут вести не туда — исправьте env."
fi

# ── 2. Вебхук ─────────────────────────────────────────────────────────────
say "2/4 Регистрирую вебхук: ${WEBHOOK_URL}"
curl -fsS "${API}/setWebhook" \
  -d "url=${WEBHOOK_URL}" \
  -d "secret_token=${TELEGRAM_WEBHOOK_SECRET}" \
  -d "drop_pending_updates=true" \
  -d 'allowed_updates=["message"]' | python3 -m json.tool

# ── 3. Меню команд ────────────────────────────────────────────────────────
say "3/4 Ставлю меню команд…"
curl -fsS "${API}/setMyCommands" \
  -H 'Content-Type: application/json' \
  -d '{"commands":[
        {"command":"start",  "description":"Привязать аккаунт Sporteo"},
        {"command":"unlink", "description":"Отвязать Telegram"},
        {"command":"help",   "description":"Справка"}
      ]}' | python3 -m json.tool

# ── 4. Контроль ───────────────────────────────────────────────────────────
say "4/4 Итоговое состояние вебхука (getWebhookInfo):"
curl -fsS "${API}/getWebhookInfo" | python3 -m json.tool

say "Готово. Дальше по runbook: привязка из «Настройки → Уведомления» и crontab для /api/telegram/process-queue."
