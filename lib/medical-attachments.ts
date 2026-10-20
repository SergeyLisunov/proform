'use client'

/**
 * Показ медицинских вложений: подписанные ссылки на файлы закрытого
 * бакета. Сам бакет и пути — lib/medical-storage.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  /** Пути, которые сервер подписать отказался (файла нет или нет прав). */
  failed: ReadonlySet<string>
  status: SignStatus
  retry: () => void
}

interface SignResult {
  urls: Record<string, string>
  failed: Set<string>
}

async function signAll(paths: string[]): Promise<SignResult> {
  const storage = createClient().storage.from(MEDICAL_BUCKET)
  const urls: Record<string, string> = {}
  for (let i = 0; i < paths.length; i += SIGN_CHUNK) {
    const { data, error } = await storage.createSignedUrls(paths.slice(i, i + SIGN_CHUNK), SIGNED_URL_TTL_SEC)
    if (error) throw error
    for (const item of data ?? []) {
      if (item.path && item.signedUrl && !item.error) urls[item.path] = item.signedUrl
    }
  }
  return { urls, failed: new Set(paths.filter(p => !urls[p])) }
}

const NO_FAILED: ReadonlySet<string> = new Set()

/**
 * Подписанные ссылки на закрытые файлы — один запрос на весь набор.
 * Переподписывает сам: перед истечением срока и при возврате на вкладку,
 * если компьютер спал и таймер не сработал вовремя.
 */
export function useSignedUrls(attachments: readonly StoredAttachment[] | null | undefined): SignedUrls {
  const key = useMemo(
    () => Array.from(new Set((attachments ?? []).map(a => a.path).filter((p): p is string => !!p))).sort().join('\n'),
    [attachments],
  )
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [failed, setFailed] = useState<ReadonlySet<string>>(NO_FAILED)
  const [status, setStatus] = useState<SignStatus>('idle')
  // Меняется при ручном повторе и при переподписи — запускает новую
  // подпись того же набора.
  const [round, setRound] = useState(0)
  const retry = useCallback(() => setRound(r => r + 1), [])
  const signedAt = useRef(0)

  useEffect(() => {
    if (!key) return
    let cancelled = false
    const paths = key.split('\n')
    const renew = setTimeout(() => { if (!cancelled) setRound(r => r + 1) }, RENEW_AFTER_MS)
    Promise.resolve()
      .then(() => { if (!cancelled) setStatus('loading') })
      .then(() => signAll(paths))
      .then(result => {
        if (cancelled) return
        signedAt.current = Date.now()
        // Только ссылки текущего набора: убранные файлы не копятся.
        setUrls(prev => {
          const merged: Record<string, string> = {}
          for (const p of paths) {
            const url = result.urls[p] ?? (result.failed.has(p) ? undefined : prev[p])
            if (url) merged[p] = url
          }
          return merged
        })
        setFailed(result.failed.size ? result.failed : NO_FAILED)
        setStatus('ready')
      })
      .catch(() => { if (!cancelled) setStatus('error') })
    return () => { cancelled = true; clearTimeout(renew) }
  }, [key, round])

  useEffect(() => {
    if (!key) return
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      if (Date.now() - signedAt.current > RENEW_AFTER_MS) setRound(r => r + 1)
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [key])

  return key
    ? { urls, failed, status, retry }
    : { urls: {}, failed: NO_FAILED, status: 'idle', retry }
}
