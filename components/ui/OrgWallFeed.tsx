'use client'

/**
 * OrgWallFeed — P0: стена организации, видимая ЧЛЕНАМ.
 *
 * Аудит взаимодействия ролей: посты с видимостью «members» не мог увидеть
 * ни один член — /org/wall закрыт гейтом role === 'organization', а публичная
 * страница организации фильтрует только public. При этом RLS-политика
 * «wall_posts: members read» на проде УЖЕ разрешает активным членам чтение —
 * обрыв был чисто в UI. Этот виджет — первый работающий канал
 * организация → атлет/тренер внутри продукта.
 *
 * Видимость постов (visible_to text[]) энфорсится RLS — клиент не фильтрует
 * сам. Скрывается целиком, если пользователь не член организации или постов нет.
 */
import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { Card } from '@/components/ui/metronic'

function sb() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

interface Post {
  id: string
  title: string
  body: string
  is_pinned: boolean
  created_at: string
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

export function OrgWallFeed({ userId }: { userId: string }) {
  const [orgName, setOrgName] = useState<string | null>(null)
  const [posts, setPosts] = useState<Post[]>([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = sb() as any
      const { data: mem } = await client
        .from('org_members')
        .select('org_id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle()
      if (!mem?.org_id || cancelled) return

      const [{ data: org }, { data: rows }] = await Promise.all([
        client.from('organizations').select('org_name').eq('id', mem.org_id).maybeSingle(),
        client.from('wall_posts')
          .select('id, title, body, is_pinned, created_at')
          .eq('org_id', mem.org_id)
          .is('deleted_at', null)
          .order('is_pinned', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(3),
      ])
      if (cancelled) return
      setOrgName((org?.org_name as string | undefined) ?? null)
      setPosts((rows ?? []) as Post[])
    }
    load()
    return () => { cancelled = true }
  }, [userId])

  if (posts.length === 0) return null

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <i className="ki-filled ki-office-bag text-sm" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-navy-500">Новости клуба</h3>
            {orgName && <p className="text-2xs text-muted-foreground">{orgName}</p>}
          </div>
        </div>
      </div>
      <div className="divide-y divide-border">
        {posts.map(p => (
          <div key={p.id} className="px-5 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-1.5">
                {p.is_pinned && <i className="ki-filled ki-pin shrink-0 text-[11px] text-orange-500" />}
                <span className="truncate text-sm font-semibold text-foreground">{p.title}</span>
              </div>
              <span className="shrink-0 text-2xs text-muted-foreground">{fmtDate(p.created_at)}</span>
            </div>
            {p.body && <p className="mt-1 line-clamp-2 text-2xs leading-relaxed text-muted-foreground">{p.body}</p>}
          </div>
        ))}
      </div>
    </Card>
  )
}
