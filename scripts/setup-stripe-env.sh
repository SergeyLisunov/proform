#!/usr/bin/env bash
# Interactive Stripe env bootstrap for Vercel.
#
# Walks you through:
#   1) Secret key
#   2) Webhook signing secret (after creating endpoint)
#   3) Price IDs for Pro / Team plans
#
# For each variable:
#   - opens the relevant Stripe Dashboard URL
#   - prompts you to paste the value (hidden input for secrets)
#   - writes it to Vercel for production / preview / development
#
# At the end: optionally triggers a redeploy via an empty commit.

set -euo pipefail

# ── styling ─────────────────────────────────────────────────────────────────
bold=$'\033[1m'
dim=$'\033[2m'
green=$'\033[32m'
yellow=$'\033[33m'
blue=$'\033[34m'
red=$'\033[31m'
reset=$'\033[0m'

say()   { printf "%s%s%s\n" "$bold$blue" "$*" "$reset"; }
note()  { printf "%s%s%s\n" "$dim" "$*" "$reset"; }
ok()    { printf "%s✓ %s%s\n" "$green" "$*" "$reset"; }
warn()  { printf "%s⚠ %s%s\n" "$yellow" "$*" "$reset"; }
fail()  { printf "%s✗ %s%s\n" "$red" "$*" "$reset" >&2; }

# ── sanity checks ───────────────────────────────────────────────────────────
command -v vercel >/dev/null 2>&1 || { fail "Vercel CLI не найден. brew install vercel-cli"; exit 1; }
command -v git    >/dev/null 2>&1 || { fail "git не найден"; exit 1; }

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

if [ ! -d ".vercel" ]; then
  fail "В этом репозитории не залинкован Vercel-проект (нет .vercel/)."
  note "Запусти: vercel link"
  exit 1
fi

SITE_URL="${NEXT_PUBLIC_SITE_URL:-https://proform-delta.vercel.app}"
WEBHOOK_URL="$SITE_URL/api/webhooks/stripe"

# ── helpers ─────────────────────────────────────────────────────────────────
open_url() {
  local url="$1"
  if command -v open >/dev/null 2>&1; then
    open "$url" >/dev/null 2>&1 || true
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$url" >/dev/null 2>&1 || true
  fi
}

prompt_secret() {
  # prompt_secret <prompt>  →  echoes value to stdout (bash 3.2 compatible)
  local prompt="$1" val=""
  read -r -s -p "$prompt: " val </dev/tty
  printf "\n" >&2
  printf '%s' "$val"
}

prompt_value() {
  # prompt_value <prompt>  →  echoes value to stdout
  local prompt="$1" val=""
  read -r -p "$prompt: " val </dev/tty
  printf '%s' "$val"
}

remove_if_exists() {
  local name="$1" env="$2"
  if vercel env ls "$env" 2>/dev/null | awk '{print $1}' | grep -qx "$name"; then
    note "  · удаляю существующий $name ($env)"
    vercel env rm "$name" "$env" --yes >/dev/null 2>&1 || true
  fi
}

write_env() {
  # write_env <name> <value>
  local name="$1" value="$2"
  if [ -z "$value" ]; then
    warn "  Пропускаю $name (пустое значение)"
    return 0
  fi
  for env in production preview development; do
    note "  … $env: проверяю существующее значение"
    remove_if_exists "$name" "$env"
    note "  … $env: записываю"
    if printf '%s\n' "$value" | vercel env add "$name" "$env" >/dev/null 2>&1; then
      note "  · записано $name → $env"
    else
      warn "  ✗ не удалось записать $name в $env (см. vercel env ls $env)"
    fi
  done
  ok "$name установлен во всех окружениях"
}

divider() {
  printf "%s%s%s\n" "$dim" "────────────────────────────────────────────────────────────────" "$reset"
}

# ── intro ───────────────────────────────────────────────────────────────────
clear
say "Stripe ↔ Vercel bootstrap"
note "Site URL:    $SITE_URL"
note "Webhook URL: $WEBHOOK_URL"
echo
note "Скрипт будет открывать нужные страницы Stripe Dashboard."
note "Введённые секреты НЕ логируются и не сохраняются локально."
echo
read -r -p "Продолжить? [Y/n]: " go
case "${go:-Y}" in [yY]*) ;; *) exit 0 ;; esac

# ── 1. STRIPE_SECRET_KEY ────────────────────────────────────────────────────
divider
say "1/4  STRIPE_SECRET_KEY"
note "Сейчас откроется страница с API-ключами. Скопируй Secret key (sk_live_... для прод)."
open_url "https://dashboard.stripe.com/apikeys"
echo
STRIPE_SECRET_KEY="$(prompt_secret "Вставь Stripe Secret Key")"
if [ -z "$STRIPE_SECRET_KEY" ]; then fail "Secret key не может быть пустым"; exit 1; fi
case "$STRIPE_SECRET_KEY" in
  sk_*) ;;
  *) warn "Значение не начинается с sk_ — уверен, что это правильный ключ?"; ;;
esac
write_env STRIPE_SECRET_KEY "$STRIPE_SECRET_KEY"

# ── 2. Webhook endpoint → STRIPE_WEBHOOK_SECRET ─────────────────────────────
divider
say "2/4  STRIPE_WEBHOOK_SECRET"
note "Сейчас откроется страница вебхуков."
note "Создай endpoint (Add endpoint) со следующим URL и событиями:"
echo
printf "  %sURL:%s    %s\n" "$bold" "$reset" "$WEBHOOK_URL"
printf "  %sEvents:%s checkout.session.completed\n" "$bold" "$reset"
printf "           customer.subscription.updated\n"
printf "           customer.subscription.deleted\n"
printf "           invoice.paid\n"
printf "           invoice.payment_failed\n"
echo
note "После создания endpoint-а нажми «Reveal» рядом с Signing secret (whsec_...) и скопируй."
open_url "https://dashboard.stripe.com/webhooks"
echo
STRIPE_WEBHOOK_SECRET="$(prompt_secret "Вставь Webhook Signing Secret (whsec_...)")"
if [ -z "$STRIPE_WEBHOOK_SECRET" ]; then fail "Webhook secret не может быть пустым"; exit 1; fi
case "$STRIPE_WEBHOOK_SECRET" in
  whsec_*) ;;
  *) warn "Не начинается с whsec_ — проверь значение"; ;;
esac
write_env STRIPE_WEBHOOK_SECRET "$STRIPE_WEBHOOK_SECRET"

# ── 3. STRIPE_PRICE_PRO / STRIPE_PRICE_TEAM ─────────────────────────────────
divider
say "3/4  STRIPE_PRICE_PRO / STRIPE_PRICE_TEAM"
note "Открою Products. Для каждого тарифа («Pro» и «Team») создай продукт"
note "с recurring-ценой (ежемесячно) и скопируй id цены (price_...)."
open_url "https://dashboard.stripe.com/products"
echo
STRIPE_PRICE_PRO="$(prompt_value  "STRIPE_PRICE_PRO  (price_...)")"
STRIPE_PRICE_TEAM="$(prompt_value "STRIPE_PRICE_TEAM (price_...)")"
case "$STRIPE_PRICE_PRO"  in price_*) ;; *) warn "PRO id не начинается с price_ — проверь"; ;; esac
case "$STRIPE_PRICE_TEAM" in price_*) ;; *) warn "TEAM id не начинается с price_ — проверь"; ;; esac
write_env STRIPE_PRICE_PRO  "$STRIPE_PRICE_PRO"
write_env STRIPE_PRICE_TEAM "$STRIPE_PRICE_TEAM"

# ── 4. Redeploy ─────────────────────────────────────────────────────────────
divider
say "4/4  Redeploy"
echo
read -r -p "Сделать empty-commit + git push, чтобы Vercel пересобрался? [Y/n]: " deploy
case "${deploy:-Y}" in
  [yY]*)
    if ! git diff --quiet || ! git diff --cached --quiet; then
      warn "Есть незакоммиченные изменения — сначала закоммить или stash, потом повтори."
    else
      git commit --allow-empty -m "chore(stripe): redeploy with new billing env vars"
      git push origin HEAD
      ok "Push отправлен. Vercel поднимет новый build."
      note "Следи: https://vercel.com/sergeylisunovs-projects/proform/deployments"
    fi
    ;;
  *) note "Пропускаю redeploy. Не забудь триггернуть вручную:"
     note "  git commit --allow-empty -m 'redeploy' && git push" ;;
esac

divider
ok "Готово. Проверь:"
note "  · https://dashboard.stripe.com/webhooks — endpoint активен"
note "  · $SITE_URL/pricing — клик по Pro открывает Stripe Checkout"
note "  · $SITE_URL/admin/commerce — появляются платежи после тестовой покупки"
