'use client'

/**
 * Показ медицинских вложений: подписанные ссылки на файлы закрытого
 * бакета. Сам бакет и пути — lib/medical-storage.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MEDICAL_BUCKET, type StoredAttachment } from '@/lib/medical-storage'

export { MEDICAL_BUCKET, attachmentHref, buildMedicalPath } from '@/lib/medical-storage'

/**
 * Сколько живёт ссылка на файл. Ссылка — это пропуск на время: отозвал
 * врач показ записи — уже выданная ссылка работает до конца срока. Поэтому
 * срок короткий, а открытую страницу хук переподписывает сам.
 */
export const SIGNED_URL_TTL_SEC = 10 * 60
const RENEW_AFTER_MS = SIGNED_URL_TTL_SEC * 1000 * 0.8
/** Сколько путей подписывать одним запросом. */
const SIGN_CHUNK = 100

export type SignStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface SignedUrls {
  /** Путь → подписанная ссылка. Пока идёт переподпись, прежние ссылки
   *  остаются: они действуют до конца своего срока. */
  urls: Record<string, string>
  status: SignStatus
  retry: () => void
}

async function signAll(paths: string[]): Promise<Record<string, string>> {
  const storage = createClient().storage.from(MEDICAL_BUCKET)
  const urls: Record<string, string> = {}
  for (let i = 0; i < paths.length; i += SIGN_CHUNK) {
    const { data, error } = await storage.createSignedUrls(paths.slice(i, i + SIGN_CHUNK), SIGNED_URL_TTL_SEC)
    if (error) throw error
    for (const item of data ?? []) {
      if (item.path && item.signedUrl) urls[item.path] = item.signedUrl
    }
  }
  return urls
}

/**
 * Подписанные ссылки на закрытые файлы — один запрос на весь набор.
 * Файлы, на которые прав нет, просто не попадают в ответ.
 */
export function useSignedUrls(attachments: readonly StoredAttachment[] | null | undefined): SignedUrls {
  const key = useMemo(
    () => Array.from(new Set((attachments ?? []).map(a => a.path).filter((p): p is string => !!p))).sort().join('\n'),
    [attachments],
  )
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<SignStatus>('idle')
  // Меняется при ручном повторе и перед истечением срока — запускает
  // новую подпись того же набора.
  const [round, setRound] = useState(0)
  const retry = useCallback(() => setRound(r => r + 1), [])

  useEffect(() => {
    if (!key) return
    let cancelled = false
    const renew = setTimeout(() => { if (!cancelled) setRound(r => r + 1) }, RENEW_AFTER_MS)
    Promise.resolve()
      .then(() => { if (!cancelled) setStatus('loading') })
      .then(() => signAll(key.split('\n')))
      .then(next => {
        if (cancelled) return
        setUrls(prev => ({ ...prev, ...next }))
        setStatus('ready')
      })
      .catch(() => { if (!cancelled) setStatus('error') })
    return () => { cancelled = true; clearTimeout(renew) }
  }, [key, round])

  return { urls, status: key ? status : 'idle', retry }
}
