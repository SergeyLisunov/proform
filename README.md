# ProForm — Training Diary for Athletes & Coaches

Professional sports training management platform. Track workouts, manage training cycles, monitor strain/recovery, and collaborate with coaches.

**Live:** [proform-delta.vercel.app](https://proform-delta.vercel.app)

---

## Tech Stack

- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS
- **UI Kit:** Metronic Tailwind v4 (KtUI components)
- **Backend:** Supabase (PostgreSQL, Auth, RLS, Storage)
- **Hosting:** Vercel (auto-deploy from `main`)
- **Fonts:** DM Sans + Bebas Neue

## Roles

| Role         | Description                                           |
|-------------|-------------------------------------------------------|
| Athlete     | Logs workouts, views calendar, manages training cycles |
| Coach       | Observes athletes, leaves marks, writes observations   |
| Organization| Manages members, newsletters, event wall               |
| Admin       | Full system access, user management, audit logs        |

## Project Structure

```
proform/
├── app/                 # Next.js App Router pages
│   ├── (auth)/          # Login, Register
│   ├── (dashboard)/     # Authenticated pages
│   │   ├── dashboard/   # Main dashboard
│   │   ├── diary/       # Workout diary
│   │   ├── calendar/    # Calendar + cycles
│   │   ├── coach/       # Coach panel
│   │   ├── org/         # Organization panel
│   │   ├── messages/    # Chat (TBD)
│   │   └── settings/    # User settings
│   └── api/             # Route handlers
├── components/          # React components
├── lib/                 # Supabase clients, utils
├── services/            # Data access layer
├── types/               # TypeScript types
├── supabase/migrations/ # SQL migrations
└── public/assets/       # Static assets, Metronic CSS/JS
```

## Database

26 tables in Supabase with Row Level Security on all tables. Key conventions:

- `users` table (not `profiles`) — bridges to `auth.users` via `auth_id`
- `workouts.athlete_id` (not `user_id`)
- `calendar_events.owner_id` (not `user_id`)
- Helper function `get_my_user_id()` maps `auth.uid()` to `users.id`
- Schema cache reload: `NOTIFY pgrst, 'reload schema'`

## Getting Started

```bash
git clone git@github.com:SergeyLisunov/proform.git
cd proform
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

Полный список с комментариями — в [`.env.example`](./.env.example).
Сгруппировано по назначению:

| Группа | Переменные | Когда нужны |
|---|---|---|
| **Core (обязательно)** | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SITE_URL` | Авторизация, чтение БД, серверные роуты |
| **AI** | `ANTHROPIC_API_KEY` | `/api/ai/adaptive-plan`, `/api/diary/weekly-summary`, разборы тренировок. Без — все AI-эндпоинты возвращают `503 AI_NOT_CONFIGURED` |
| **Email** | `RESEND_API_KEY`, `RESEND_FROM`, `CRON_SECRET` | Digest-рассылки, инвайты, newsletters, Vercel Cron |
| **Billing (ЮKassa)** | `YOOKASSA_SHOP_ID`, `YOOKASSA_SECRET_KEY`, `YOOKASSA_API_URL`, `YOOKASSA_RETURN_URL`, `YOOKASSA_TEST_MODE`, `PAYMENTS_PROVIDER` | Подписки, СБП, Mir Pay, 54-ФЗ. Без — `/api/billing/checkout` возвращает 503 |
| **Wearables** | `WHOOP_CLIENT_ID`/`SECRET`, `GARMIN_CONSUMER_KEY`/`SECRET` | OAuth для Whoop / Garmin. Apple Health работает без env (file-upload) |
| **AI search (опц.)** | `HF_API_TOKEN`, `HF_EMBED_MODEL` | Семантический поиск по дневнику |
| **Sentry (опц.)** | `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN` | Error tracking. SDK вшит, но `init()` пропускается без DSN |

### Setting envs in Vercel

```
Vercel → Project Settings → Environment Variables
  ↳ Production / Preview / Development (set all three)
```

После добавления `ANTHROPIC_API_KEY` нужно передеплоить — Vercel
переподключит env только при новом билде.

## Deployment

Push to `main` → automatic Vercel deployment (~30 sec).

## License

Private — all rights reserved.
