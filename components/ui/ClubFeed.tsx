'use client'

/**
 * ClubFeed — закрытая лента тренировок клуба + «респект» (P1 соц-ядро).
 *
 * Strava-модель kudos, адаптированная под детскую платформу (policy
 * child-privacy-defaults): лента видна только членам клуба, конечна
 * (20 записей, «вы всё посмотрели»), без публичных счётчиков популярности —
 * реакции видны только внутри клуба (RLS 094). Реакция тренера подсвечивается
 * отдельно — одобрение авторитета ценнее лайка (петля TrainingPeaks).
 *
 * Скрывается целиком, если пользователь не член клуба или лента пуста.
 */
import { useCallback, useEffect, useState } from 'react'
import { Card } from '@/components/ui/metronic'
import { fetchClubFeed, toggleRespect, type ClubFeedItem } from '@/services/club-feed.service'

function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

export function ClubFeed({ userId, userName }: { userId: string; userName: string | null }) {
  const [items, setItems] = useState<ClubFeedItem[]>([])
  const [orgName, setOrgName] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchClubFeed().then(feed => {
      if (cancelled) return
      setItems(feed.items)
      setOrgName(feed.org?.name ?? null)
      setLoaded(true)
    })
    return () => { cancelled = true }
  }, [userId])

  const onRespect = useCallback(async (item: ClubFeedItem) => {
    // Оптимистичный toggle; при ошибке RLS откатываем.
    setItems(prev => prev.map(i => i.id === item.id
      ? { ...i, reacted_by_me: !i.reacted_by_me, respects: i.respects + (i.reacted_by_me ? -1 : 1) }
      : i))
    const ok = await toggleRespect(item, userId, userName)
    if (!ok) {
      setItems(prev => prev.map(i => i.id === item.id
        ? { ...i, reacted_by_me: item.reacted_by_me, respects: item.respects }
        : i))
    }
  }, [userId, userName])

  if (!loaded || items.length === 0) return null

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
            <i className="ki-filled ki-people text-sm" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-navy-500">Лента клуба</h3>
            {orgName && <p className="text-2xs text-muted-foreground">{orgName} · последние тренировки</p>}
          </div>
        </div>
      </div>
      <div className="divide-y divide-border">
        {items.map(item => (
          <div key={item.id} className="flex items-center gap-3 px-5 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-50 text-xs font-bold text-orange-600 pf-num">
              {item.athlete_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 text-sm">
                <span className="font-semibold text-foreground">{item.is_mine ? 'Вы' : item.athlete_name}</span>
                <span className="text-muted-foreground">·</span>
                <span className="truncate text-muted-foreground">{item.name ?? item.activity_type ?? 'Тренировка'}</span>
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-2xs text-muted-foreground">
                <span>{fmtDate(item.event_date)}</span>
                {item.activity_duration_min != null && <span>· {item.activity_duration_min} мин</span>}
                {item.coach_respect && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 font-semibold text-green-700">
                    <i className="ki-filled ki-check-circle text-[9px]" />
                    респект тренера
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onRespect(item)}
              disabled={item.is_mine}
              aria-pressed={item.reacted_by_me}
              aria-label={item.reacted_by_me ? 'Убрать респект' : 'Респект'}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-default disabled:opacity-50 ${
                item.reacted_by_me
                  ? 'border-orange-300 bg-orange-500 text-white'
                  : 'border-border bg-background text-muted-foreground hover:border-orange-200 hover:text-orange-600'
              }`}
            >
              <i className="ki-filled ki-like text-xs" />
              {item.respects > 0 ? item.respects : ''}
            </button>
          </div>
        ))}
      </div>
      <div className="border-t border-border px-5 py-2.5 text-center text-2xs text-muted-foreground">
        Вы посмотрели все свежие тренировки клуба
      </div>
    </Card>
  )
}
