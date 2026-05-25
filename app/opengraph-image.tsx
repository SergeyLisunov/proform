/**
 * app/opengraph-image.tsx — W15 Day 73.
 *
 * Default site-wide OG image. Renders 1200×630 PNG at request time via
 * Next.js Edge `next/og` ImageResponse. Child route segments inherit
 * unless they define their own opengraph-image.
 *
 * Design rationale:
 *   - Matches Hero gradient (warm orange wash on white) — visual continuity
 *   - System fonts only (no font fetch — keeps edge runtime resilient)
 *   - 4 lines max: eyebrow, tagline, persona chips, domain
 *   - Visual balance: text-block left, brand mark right
 *
 * If a route needs a tailored OG image (e.g. /pricing showing top tariff),
 * add `app/<route>/opengraph-image.tsx` — it overrides this one for that
 * subtree only.
 */
import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'ProForm — спортивная платформа для клубов, академий и команд'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px 80px',
          background:
            'radial-gradient(circle at 90% 10%, rgba(249,115,22,0.20) 0%, transparent 45%), linear-gradient(180deg, #FFFFFF 0%, #FFF7ED 100%)',
          fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
        }}
      >
        {/* Top row: wordmark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 18,
              background: '#F97316',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(249,115,22,0.30)',
              color: 'white',
              fontSize: 28,
              fontWeight: 800,
            }}
          >
            P
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 32, fontWeight: 800, color: '#0F172A', letterSpacing: -0.5 }}>
              ProForm
            </span>
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: '#C2410C',
                letterSpacing: 4,
                textTransform: 'uppercase',
              }}
            >
              Спортивная платформа
            </span>
          </div>
        </div>

        {/* Middle: headline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 980 }}>
          <span
            style={{
              fontSize: 64,
              fontWeight: 800,
              color: '#0F172A',
              lineHeight: 1.05,
              letterSpacing: -1.5,
            }}
          >
            Тренер, спортсмен, врач{' '}
            <span style={{ color: '#F97316' }}>и клуб</span> —
            <br />работают в одной системе
          </span>
          <span style={{ fontSize: 24, color: '#475569', lineHeight: 1.35, maxWidth: 880 }}>
            Прогресс спортсмена видят все, кому это нужно — и только они.
          </span>
        </div>

        {/* Bottom: persona chips + domain */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            width: '100%',
          }}
        >
          <div style={{ display: 'flex', gap: 12 }}>
            {[
              { label: 'Тренер',     bg: '#DCFCE7', fg: '#166534' },
              { label: 'Спортсмен',  bg: '#FFEDD5', fg: '#9A3412' },
              { label: 'Врач',       bg: '#FEE2E2', fg: '#991B1B' },
              { label: 'Клуб',       bg: '#DBEAFE', fg: '#1E40AF' },
              { label: 'Родитель',   bg: '#EDE9FE', fg: '#5B21B6' },
            ].map((chip) => (
              <div
                key={chip.label}
                style={{
                  background: chip.bg,
                  color: chip.fg,
                  padding: '10px 18px',
                  borderRadius: 999,
                  fontSize: 18,
                  fontWeight: 700,
                  display: 'flex',
                }}
              >
                {chip.label}
              </div>
            ))}
          </div>
          <span style={{ fontSize: 18, color: '#64748B', fontWeight: 600 }}>
            proform-delta.vercel.app
          </span>
        </div>
      </div>
    ),
    { ...size },
  )
}
