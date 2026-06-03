/**
 * app/icon.tsx — Sporteo favicon / tab icon.
 * Renders a 32×32 PNG (orange "S" mark) via next/og at request time.
 */
import { ImageResponse } from 'next/og'

export const runtime = 'nodejs'
export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#F35703',
          color: '#FBF3EC',
          fontSize: 24,
          fontWeight: 800,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        S
      </div>
    ),
    { ...size },
  )
}
