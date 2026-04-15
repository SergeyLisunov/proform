import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q) return NextResponse.json({ available: false, error: 'Missing q' }, { status: 400 })

  // Validate format
  const nicknameRegex = /^[a-zA-Z0-9][a-zA-Z0-9_-]{1,28}[a-zA-Z0-9]$|^[a-zA-Z0-9]{1,2}$/
  // More precise: 3-30 chars, starts/ends with alnum, no double special chars
  const clean = q.replace(/^@/, '').toLowerCase()

  if (clean.length < 3 || clean.length > 30) {
    return NextResponse.json({ available: false, error: 'Length must be 3-30' })
  }
  if (!/^[a-z0-9][a-z0-9_-]*[a-z0-9]$/.test(clean) && clean.length >= 2) {
    return NextResponse.json({ available: false, error: 'Invalid format' })
  }
  if (/[_-]{2}/.test(clean)) {
    return NextResponse.json({ available: false, error: 'No consecutive special chars' })
  }

  const supabase = await createClient()
  const { data } = await supabase
    .from('users')
    .select('id')
    .ilike('nickname', clean)
    .maybeSingle()

  return NextResponse.json({ available: !data })
}
