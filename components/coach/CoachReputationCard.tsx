/**
 * <CoachReputationCard /> — Sprint W9 Day 47.
 *
 * Server-rendered widget on the coach dashboard. Shows the coach
 * their own «trust footprint» at a glance:
 *   - Verified badge state (admin-issued, W9 Day 45)
 *   - Avg star rating + review count (UGC from athletes, W9 Day 44)
 *   - Active passes issued (W8 Day 39 + W9 Day 43)
 *
 * Why expose this to the coach? Surfaces the feedback loop that
 * marketplace browsers see — coach can react proactively (request
 * verification, respond to low-rated reviews, restock pass-plans).
 */
import Link from 'next/link'
import VerifiedBadge from '@/components/ui/VerifiedBadge'
import { Card, Badge } from '@/components/ui/metronic'

interface CoachReputationCardProps {
  isVerified:        boolean
  avgRating:         number | null
  reviewCount:       number
  activePassesCount: number
}

function pluralize(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return forms[0]
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1]
  return forms[2]
}

export default function CoachReputationCard({
  isVerified, avgRating, reviewCount, activePassesCount,
}: CoachReputationCardProps) {
  return (
    <Card className="rounded-3xl p-5 md:p-6">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div>
          <p className="text-2xs font-bold uppercase tracking-[0.24em] text-muted-foreground mb-1">Репутация</p>
          <h2 className="text-lg font-bold text-foreground">Ваш профиль глазами атлетов</h2>
        </div>
        <Link
          href="/coach/passes"
          className="text-xs font-semibold text-orange-600 hover:underline no-underline"
        >
          К абонементам →
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Verified */}
        <Card className="rounded-2xl bg-background/60 p-4">
          <div className="flex items-center gap-2 mb-1.5">
            {isVerified
              ? <VerifiedBadge size="md" />
              : <Badge variant="secondary" size="sm">
                  Не подтверждён
                </Badge>}
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {isVerified
              ? 'Бейдж выдан администратором — отображается на профиле и в marketplace.'
              : 'Напишите в поддержку для прохождения верификации.'}
          </p>
        </Card>

        {/* Rating */}
        <Card className="rounded-2xl bg-background/60 p-4">
          <div className="flex items-baseline gap-2 mb-1">
            <span className="pf-num text-2xl font-bold text-foreground">
              {avgRating !== null ? avgRating.toFixed(1) : '—'}
            </span>
            <span className="text-amber-500">{avgRating !== null ? '★' : ''}</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {reviewCount > 0
              ? `${reviewCount} ${pluralize(reviewCount, ['отзыв', 'отзыва', 'отзывов'])} от атлетов`
              : 'Пока нет отзывов — попросите атлетов поделиться впечатлением.'}
          </p>
        </Card>

        {/* Active passes */}
        <Card className="rounded-2xl bg-background/60 p-4">
          <div className="flex items-baseline gap-2 mb-1">
            <span className="pf-num text-2xl font-bold text-foreground">{activePassesCount}</span>
            <span className="text-xs text-muted-foreground">
              {pluralize(activePassesCount, ['активный пакет', 'активных пакета', 'активных пакетов'])}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Сессии списываются на странице «Списать сессию» после каждой тренировки.
          </p>
        </Card>
      </div>
    </Card>
  )
}
