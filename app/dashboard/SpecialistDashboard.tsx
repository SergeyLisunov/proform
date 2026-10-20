'use client'

/**
 * Кабинет специалиста: физиотерапевт, массажист, нутрициолог, психолог.
 *
 * Здесь только своё — профиль, клиенты и запросы на связь. Медицинских
 * данных спортсменов в кабинете нет: доступ к ним — отдельный шаг, и только
 * по согласию спортсмена.
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle,
} from '@/components/reui/card'
import { Badge } from '@/components/reui/badge'
import { Button, buttonVariants } from '@/components/reui/button'
import { Skeleton } from '@/components/reui/skeleton'
import { Icon } from '@/components/ui/Icon'
import { AvatarImage } from '@/components/ui/AvatarImage'
import { ScopeList } from '@/components/specialist/ScopeList'
import { cn } from '@/lib/utils'
import { fmtDate, initials } from '@/lib/utils/recovery'
import { specialistTypesLabel } from '@/lib/specialist'
import {
  countPendingSpecialistRequests, getSpecialistProfile, listSpecialistClients, specialistProfileGaps,
  type PendingSpecialistRequests, type SpecialistClient, type SpecialistProfile,
} from '@/services/specialist.service'

// Сразу вкладка «По имени»: запрос на связь отправляется оттуда.
const FIND_ATHLETE_HREF = '/network?tab=find&type=people'
// Вкладку «Входящие» / «Исходящие» адресом пока не выбрать — ведём в
// «Сеть и контакты» и называем вкладку в подписи ссылки.
const CONTACTS_HREF = '/network'
const CLIENTS_PREVIEW = 8

interface DashboardData {
  /** null — профиля ещё нет; сбой загрузки сюда не попадает, это state 'error'. */
  profile: SpecialistProfile | null
  clients: SpecialistClient[]
  pending: PendingSpecialistRequests
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; data: DashboardData }

export default function SpecialistDashboard({ userId, name }: { userId: string; name: string }) {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      getSpecialistProfile(userId),
      listSpecialistClients(userId),
      countPendingSpecialistRequests(userId),
    ])
      .then(([profile, clients, pending]) => {
        if (!cancelled) setState({ status: 'ready', data: { profile, clients, pending } })
      })
      .catch((err: unknown) => {
        console.error('[SpecialistDashboard.load]', err)
        if (!cancelled) setState({ status: 'error' })
      })
    return () => { cancelled = true }
  }, [userId, attempt])

  function retry() {
    setState({ status: 'loading' })
    setAttempt(a => a + 1)
  }

  const firstName = name.trim().split(/\s+/)[0] || 'коллега'
  const loading = state.status === 'loading'
  const data = state.status === 'ready' ? state.data : null

  return (
    <div className="pf-enter">
      {/* Вне aria-busy: занятое поддерево не озвучивается. Первая загрузка
          приходит в уже пустой регион — иначе скринридер её не заметит. */}
      <p role="status" className="sr-only">{statusMessage(state, attempt)}</p>

      <div className="flex flex-col gap-5" aria-busy={loading}>
        <Hero firstName={firstName} data={data} loading={loading} />

        {state.status === 'error' ? (
          <LoadError onRetry={retry} />
        ) : (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <ClientsCard data={data} className="lg:col-span-2" />
            <div className="flex flex-col gap-5">
              <ProfileCard data={data} />
              <ScopeCard />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/** Ошибку озвучивает role="alert" в LoadError, здесь её не дублируем. */
function statusMessage(state: LoadState, attempt: number): string {
  if (state.status === 'ready') return 'Кабинет загружен'
  if (state.status === 'loading' && attempt > 0) return 'Загрузка кабинета…'
  return ''
}

// ── Шапка ───────────────────────────────────────────────────────────────────

function Hero({ firstName, data, loading }: { firstName: string; data: DashboardData | null; loading: boolean }) {
  const today = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <section
      aria-labelledby="specialist-hero-title"
      className="rounded-2xl border border-sky-600/15 bg-sky-50 p-5 md:p-6 dark:border-sky-400/20 dark:bg-sky-500/10"
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-col gap-1.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-sky-700 dark:text-sky-400">{today}</p>
          <h2 id="specialist-hero-title" className="pf-num text-3xl leading-tight text-foreground md:text-4xl">
            Здравствуйте, <span className="text-sky-700 dark:text-sky-400">{firstName}</span>
          </h2>
          {loading ? (
            <Skeleton className="h-5 w-48" />
          ) : (
            <p className="text-sm text-muted-foreground md:text-base">
              {specialistTypesLabel(data?.profile?.specialist_types)}
            </p>
          )}
        </div>

        <dl className="grid grid-cols-2 gap-2">
          <HeroStat label="Клиенты" value={data?.clients.length} loading={loading} />
          <HeroStat label="Ждут вашего ответа" value={data?.pending.incoming} loading={loading} />
        </dl>
      </div>
    </section>
  )
}

function HeroStat({ label, value, loading }: { label: string; value: number | undefined; loading: boolean }) {
  return (
    <div className="min-w-28 rounded-xl border border-border bg-card px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="pf-num text-xl text-foreground">
        {loading ? <Skeleton className="mt-1 h-6 w-8" /> : (value ?? '—')}
      </dd>
    </div>
  )
}

// ── Клиенты и запросы ───────────────────────────────────────────────────────

function ClientsCard({ data, className }: { data: DashboardData | null; className?: string }) {
  const clients = data?.clients ?? []
  const hidden = clients.length - CLIENTS_PREVIEW

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle><h3>Мои клиенты</h3></CardTitle>
        <CardDescription>Спортсмены, с которыми у вас активная связь</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {data && <PendingRequests pending={data.pending} />}
        {!data ? (
          <ClientsSkeleton />
        ) : clients.length === 0 ? (
          <ClientsEmpty />
        ) : (
          <ul className="flex flex-col gap-2" aria-label="Клиенты">
            {clients.slice(0, CLIENTS_PREVIEW).map(c => <ClientRow key={c.connectionId} client={c} />)}
          </ul>
        )}
      </CardContent>

      {clients.length > 0 && (
        <CardFooter className="flex-wrap gap-2">
          <Link href={FIND_ATHLETE_HREF} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-1.5')}>
            <Icon name="ki-magnifier" />
            Найти спортсмена
          </Link>
          {hidden > 0 && (
            // Клиенты — на вкладке «Активные», она открывается по умолчанию.
            <Link href={CONTACTS_HREF} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
              Все клиенты: {clients.length}
            </Link>
          )}
        </CardFooter>
      )}
    </Card>
  )
}

/**
 * Запросы на связь в обе стороны. Связь появляется только с согласия
 * спортсмена, но запрос может прийти и от него — тогда отвечает специалист.
 */
function PendingRequests({ pending }: { pending: PendingSpecialistRequests }) {
  if (pending.incoming === 0 && pending.outgoing === 0) return null
  return (
    <ul className="flex flex-col gap-2" aria-label="Запросы на связь">
      {pending.incoming > 0 && (
        <RequestRow icon="ki-entrance-right" label="Ждут вашего ответа" count={pending.incoming} tab="Входящие"
          href="/network?tab=incoming" urgent />
      )}
      {pending.outgoing > 0 && (
        <RequestRow icon="ki-exit-right" label="Ждут ответа спортсменов" count={pending.outgoing} tab="Исходящие"
          href="/network?tab=outgoing" />
      )}
    </ul>
  )
}

function RequestRow({ icon, label, count, tab, href, urgent = false }: {
  icon: string
  label: string
  count: number
  tab: string
  href: string
  urgent?: boolean
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5 transition-colors hover:bg-muted"
      >
        <span
          aria-hidden="true"
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-full',
            urgent
              ? 'bg-warning/10 text-warning-foreground dark:bg-warning/15 dark:text-warning'
              : 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
          )}
        >
          <Icon name={icon} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-sm font-medium text-foreground">{label}: {count}</span>
          <span className="text-xs text-muted-foreground">Сеть и контакты → вкладка «{tab}»</span>
        </span>
        <Icon name="ki-right" className="text-sm text-muted-foreground" />
      </Link>
    </li>
  )
}

function ClientRow({ client }: { client: SpecialistClient }) {
  const meta = [client.sport, `клиент с ${fmtDate(client.since)}`].filter(Boolean).join(' · ')
  return (
    <li>
      <Link
        href={`/profile/${client.id}`}
        className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5 transition-colors hover:bg-muted"
      >
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-sky-50 text-xs font-semibold text-sky-700 dark:bg-sky-500/15 dark:text-sky-300"
        >
          {client.avatar_url
            ? <AvatarImage src={client.avatar_url} alt="" className="size-10 rounded-full" sizes="40px" />
            : initials(client.name)}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium text-foreground">{client.name}</span>
          <span className="truncate text-xs text-muted-foreground">{meta}</span>
        </span>
        <Icon name="ki-right" className="text-sm text-muted-foreground" />
      </Link>
    </li>
  )
}

function ClientsEmpty() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-4 py-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400">
        <Icon name="ki-people" className="text-xl" />
      </span>
      <div className="flex max-w-sm flex-col gap-1">
        <p className="text-sm font-medium text-foreground">Клиентов пока нет</p>
        <p className="text-xs text-muted-foreground">
          Спортсмен появится здесь, когда примет ваш запрос на связь. Без его согласия связи не будет.
        </p>
      </div>
      <Link href={FIND_ATHLETE_HREF} className={cn(buttonVariants({ variant: 'outline' }), 'gap-1.5')}>
        <Icon name="ki-magnifier" />
        Найти спортсмена
      </Link>
    </div>
  )
}

function ClientsSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {[0, 1, 2].map(i => (
        <div key={i} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5">
          <Skeleton className="size-10 rounded-full" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-28" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Профиль ─────────────────────────────────────────────────────────────────

function ProfileCard({ data }: { data: DashboardData | null }) {
  const profile = data?.profile ?? null
  const gaps = specialistProfileGaps(profile)
  // Пустой список недостающих полей у отсутствующего профиля — не «заполнен».
  const complete = profile !== null && gaps.length === 0

  return (
    <Card>
      <CardHeader>
        <CardTitle><h3>Профиль</h3></CardTitle>
        <CardDescription>Специализация, опыт и форматы работы</CardDescription>
        {data && (
          <CardAction>
            {complete
              ? <Badge variant="success-light">Заполнен</Badge>
              : <Badge variant="warning-light">{profile ? `Не хватает: ${gaps.length}` : 'Не создан'}</Badge>}
          </CardAction>
        )}
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {!data ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : !profile ? (
          <p className="text-sm text-foreground">Пока его нет, спортсмены не видят вашей специализации и опыта.</p>
        ) : null}
        {/* Скрытый профиль (так по умолчанию, 118) спортсмен не откроет —
            принимать запрос ему придётся вслепую. */}
        {profile && !profile.profile_public && (
          <p className="flex items-start gap-2 rounded-xl border border-warning/40 px-3 py-2 text-sm text-foreground">
            <Icon name="ki-eye-slash" className="mt-0.5 shrink-0 text-muted-foreground" />
            Профиль скрыт: спортсмены не увидят вашу специализацию и опыт, когда решают, принять ли запрос.
            Открыть его можно в настройках.
          </p>
        )}
        {profile && !complete && (
          <div className="flex flex-col gap-1.5">
            <p id="specialist-profile-gaps" className="text-xs text-muted-foreground">Не заполнено</p>
            <ul className="flex flex-col gap-1.5" aria-labelledby="specialist-profile-gaps">
              {gaps.map(g => (
                <li key={g} className="flex items-center gap-2 text-sm text-foreground">
                  <Icon name="ki-information-2" className="text-muted-foreground" />
                  {g}
                </li>
              ))}
            </ul>
          </div>
        )}
        <Link
          href="/settings"
          className={cn(buttonVariants({ variant: complete ? 'outline' : 'default', size: 'sm' }), 'w-fit gap-1.5')}
        >
          <Icon name="ki-pencil" />
          {complete ? 'Открыть профиль' : profile ? 'Заполнить профиль' : 'Создать профиль'}
        </Link>
      </CardContent>
    </Card>
  )
}

// ── Границы роли ────────────────────────────────────────────────────────────

function ScopeCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle><h3>Границы роли</h3></CardTitle>
        <CardDescription>Что специалист делает в Sporteo и чего не делает</CardDescription>
      </CardHeader>
      <CardContent>
        {/* На широком экране карточка в узкой колонке — списки друг под другом. */}
        <ScopeList className="lg:grid-cols-1" headingLevel="h4" />
      </CardContent>
    </Card>
  )
}

// ── Ошибка ──────────────────────────────────────────────────────────────────

function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/10 p-4 sm:flex-row sm:items-center"
    >
      <Icon name="ki-information-2" className="text-lg text-destructive" />
      <div className="flex flex-1 flex-col gap-0.5">
        <p className="text-sm font-medium text-foreground">Не удалось загрузить кабинет</p>
        <p className="text-xs text-muted-foreground">Проверьте соединение и попробуйте ещё раз.</p>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry}>Повторить</Button>
    </div>
  )
}
