'use client'

/**
 * Счётчики непрочитанного для каркаса кабинета: сообщения и уведомления.
 *
 * ЗАЧЕМ ПРОВАЙДЕР. Сайдбар и шапка считали непрочитанные уведомления каждый
 * сам: два одинаковых запроса при каждой загрузке и два одинаковых
 * realtime-канала на одну и ту же таблицу. Провайдер стоит в AppShell —
 * единственном месте, где оба компонента живут вместе, — и держит один
 * запрос и один канал на счётчик.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useUser } from '@/lib/hooks/useUser'

interface UnreadCounts {
  messages: number
  notifications: number
}

const Ctx = createContext<UnreadCounts>({ messages: 0, notifications: 0 })

function sb() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

export function UnreadCountsProvider({ children }: { children: ReactNode }) {
  const { user } = useUser()
  const [messages, setMessages] = useState(0)
  const [notifications, setNotifications] = useState(0)

  // Сообщения: чаты в этой модели — между спортсменом и тренером, поэтому
  // счётчик осмыслен только для этих двух ролей.
  useEffect(() => {
    if (!user || (user.role !== 'athlete' && user.role !== 'coach')) {
      setMessages(0)
      return
    }
    const client = sb()
    let mounted = true

    async function load() {
      const { data: chats } = await client
        .from('chats')
        .select('id')
        .or(`athlete_id.eq.${user!.id},coach_id.eq.${user!.id}`)
      if (!mounted) return
      if (!chats?.length) { setMessages(0); return }

      const { count } = await client
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .in('chat_id', chats.map((c: { id: string }) => c.id))
        .eq('is_read', false)
        .neq('sender_id', user!.id)
      if (mounted) setMessages(count ?? 0)
    }

    load()
    const channel = client
      .channel(`unread-messages-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, load)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, load)
      .subscribe()

    return () => { mounted = false; client.removeChannel(channel) }
  }, [user])

  useEffect(() => {
    if (!user) { setNotifications(0); return }
    const client = sb()
    let mounted = true

    async function load() {
      const { count } = await client
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user!.id)
        .eq('is_read', false)
        .eq('is_archived', false)
      if (mounted) setNotifications(count ?? 0)
    }

    load()
    const channel = client
      .channel(`unread-notifications-${user.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}`,
      }, load)
      .subscribe()

    return () => { mounted = false; client.removeChannel(channel) }
  }, [user])

  return <Ctx.Provider value={{ messages, notifications }}>{children}</Ctx.Provider>
}

export function useUnreadCounts(): UnreadCounts {
  return useContext(Ctx)
}

/** Подпись бейджа: больше 99 — «99+». */
export function badgeLabel(n: number): string {
  return n > 99 ? '99+' : String(n)
}
