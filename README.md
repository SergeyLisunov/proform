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

See `.env.example` for the full list. Required:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key |

## Deployment

Push to `main` → automatic Vercel deployment (~30 sec).

## License

Private — all rights reserved.
