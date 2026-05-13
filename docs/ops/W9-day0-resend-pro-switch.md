# W9 Day 0 — Resend Pro switch (ops note)

**When:** перед началом W9 feature work
**Who:** SergeyLisunov (Resend account holder)
**Why:** daily email volume превысит free tier лимит после W8 crons

## Volume projection post-W8

| Source | Daily est | Schedule |
|---|---|---|
| Drip cadence (W7 3-touch — `/api/cron/leads-digest`) | ~75 | Monday `0 8 * * 1` |
| Athlete daily digest (W6 — `/api/digest/daily`) | ~30 | Daily `0 4 * * *` |
| Adherence nudge (W8 Day 40 — `/api/cron/adherence-nudge`) | ~20 | Daily `0 9 * * *` |
| Org weekly digest (W8 Day 41 — `/api/cron/org-weekly-digest`) | ~2 | Sunday `0 18 * * 0` |
| Coach weekly digest (W6 — `/api/digest/weekly`) | ~5 | Sunday `0 17 * * 0` |
| Doctor inquiry notify + invites + manual sends (sporadic) | ~5 | on-demand |
| **Peak day (Monday)** | **~135** | drip + daily + adherence overlap |

**Free tier limit: 100/day.** Monday peaks above limit → emails будут rejected → user-facing breakage.

## Action plan (~10 min)

### Step 1 — Upgrade Resend plan

1. Open https://resend.com/settings/billing
2. Plan select: **Pro — $20/mo** (100K emails/mo, 5K/day cap)
3. Confirm + add card

### Step 2 — (Optional) Rotate API key

If you want a separate key for the Pro tier (audit trail):

1. https://resend.com/api-keys → New API key → name `proform-pro-2026-05`
2. Copy the new `re_*` value

If keeping same key — skip this step.

### Step 3 — Update Vercel env vars

Browser:
1. https://vercel.com/sergeylisunovs-projects/proform/settings/environment-variables
2. Find `RESEND_API_KEY`
3. Edit → paste new key (or keep existing) → Save for Production / Preview / Development

CLI alternative:
```bash
vercel env rm RESEND_API_KEY production
vercel env add RESEND_API_KEY production
# paste re_*** when prompted
```

### Step 4 — Trigger redeploy

```bash
git commit --allow-empty -m "chore: trigger redeploy after Resend Pro switch"
git push
```

OR via Vercel UI → Deployments → Redeploy latest.

### Step 5 — Smoke check

After redeploy завершён:

```bash
# Manually trigger digest cron to verify Resend accepts
CRON_SECRET=$(vercel env pull .env.production | grep CRON_SECRET | cut -d= -f2)
curl -X GET "https://proform-delta.vercel.app/api/digest/daily" \
  -H "Authorization: Bearer $CRON_SECRET" | jq

# Expected: { "ok": true, "sent": N, "skipped": M, ... }
# NOT: { "ok": false, "error": "RESEND_NOT_CONFIGURED" }
```

Verify Resend dashboard: https://resend.com/emails — должны видеть delivered emails в production.

## Rollback

Если Pro switch вызвал проблемы:

1. Resend → downgrade обратно на Free (теряем sending capability above 100/day)
2. Vercel env vars stay same (key works both tiers)
3. Disable noisiest cron temporarily: comment out entry в `vercel.json` → push

## Cost watch

Pro = $20/mo flat для 100K emails. Текущий volume ~135/day = ~4K/mo → comfortable headroom.
Если volume растёт >5K/day → нужен Business ($100/mo для 1M emails).

## After switch

Update vault note:
- `00-home/текущие приоритеты.md` — remove "⚠ Срочно — Resend volume bump" section
- Note актуальную capacity в W9 Day 0 session log
