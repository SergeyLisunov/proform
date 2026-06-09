'use client'
import { useEffect, useState, useRef } from 'react'
import { useToast } from '@/lib/hooks/useToast'
import Link from 'next/link'
import Image from 'next/image'
import ReactDOM from 'react-dom'
import { createBrowserClient } from '@supabase/ssr'
import { useUser } from '@/lib/hooks/useUser'

// ── Types ──────────────────────────────────────────────────────────────────────
type AthleteProfile = {
  name: string; email: string; sport_type: string | null
  weight_kg: number | null; height_cm: number | null
  avatar_url: string | null; background_url: string | null
  instagram_url: string | null; twitter_url: string | null
  threads_url: string | null; bio: string | null
  club: string | null
  telegram_url: string | null; youtube_url: string | null
  tiktok_url: string | null; website_url: string | null
}
type WorkoutStats = {
  total: number; totalMinutes: number; avgStrain: number; thisWeek: number
}

// ── Supabase ───────────────────────────────────────────────────────────────────
function getSB() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

function fmtHours(min: number) {
  if (min < 60) return `${min}м`
  return `${Math.floor(min / 60)}ч`
}

// ── Avatar Crop Modal (pure Canvas, no external deps) ─────────────────────────
function AvatarCropModal({ file, onClose, onCropped }: {
  file: File; onClose: () => void; onCropped: (f: File) => void
}) {
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  const { error: toastError } = useToast()
  const [zoom, setZoom] = useState(1)
  const [saving, setSaving] = useState(false)
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const imgRef     = useRef<HTMLImageElement | null>(null)
  const objUrl     = useRef(URL.createObjectURL(file))
  const cropRef    = useRef({ x: 0, y: 0, size: 0 })
  const dragRef    = useRef<{ sx: number; sy: number; cx: number; cy: number } | null>(null)

  useEffect(() => {
    const objectUrl = objUrl.current
    setMounted(true)
    requestAnimationFrame(() => setVisible(true))
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose() }
    window.addEventListener('keydown', onKey)
    const img = new window.Image()
    img.onload = () => {
      imgRef.current = img
      const side = Math.min(img.width, img.height)
      cropRef.current = { x: (img.width - side) / 2, y: (img.height - side) / 2, size: side }
      redraw()
    }
    img.src = objectUrl
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      URL.revokeObjectURL(objectUrl)
    }
  }, []) // eslint-disable-line

  function handleClose() { setVisible(false); setTimeout(onClose, 260) }

  function getScale() {
    const canvas = canvasRef.current!; const img = imgRef.current!
    const s = Math.min(canvas.width / img.width, canvas.height / img.height)
    return { scale: s, offX: (canvas.width - img.width * s) / 2, offY: (canvas.height - img.height * s) / 2 }
  }

  function redraw() {
    const canvas = canvasRef.current; const img = imgRef.current
    if (!canvas || !img) return
    const ctx = canvas.getContext('2d')!
    const W = canvas.width; const H = canvas.height
    const { scale, offX, offY } = getScale()
    const { x, y, size } = cropRef.current
    const cx = offX + x * scale; const cy = offY + y * scale; const cs = size * scale
    ctx.clearRect(0, 0, W, H)
    // Dimmed full image
    ctx.globalAlpha = 0.35
    ctx.drawImage(img, offX, offY, img.width * scale, img.height * scale)
    ctx.globalAlpha = 1
    // Bright crop circle
    ctx.save()
    ctx.beginPath(); ctx.arc(cx + cs / 2, cy + cs / 2, cs / 2, 0, Math.PI * 2); ctx.clip()
    ctx.drawImage(img, offX, offY, img.width * scale, img.height * scale)
    ctx.restore()
    // Orange border
    ctx.beginPath(); ctx.arc(cx + cs / 2, cy + cs / 2, cs / 2, 0, Math.PI * 2)
    ctx.strokeStyle = '#F35703'; ctx.lineWidth = 3; ctx.stroke()
  }

  function clamp() {
    const img = imgRef.current!; const { size } = cropRef.current
    cropRef.current.x = Math.max(0, Math.min(img.width - size, cropRef.current.x))
    cropRef.current.y = Math.max(0, Math.min(img.height - size, cropRef.current.y))
  }

  function evPos(e: React.PointerEvent) {
    const r = canvasRef.current!.getBoundingClientRect()
    const ratio = canvasRef.current!.width / r.width
    return { px: (e.clientX - r.left) * ratio, py: (e.clientY - r.top) * ratio }
  }

  function onDown(e: React.PointerEvent) {
    const { px, py } = evPos(e)
    dragRef.current = { sx: px, sy: py, cx: cropRef.current.x, cy: cropRef.current.y }
    canvasRef.current!.setPointerCapture(e.pointerId)
  }

  function onMove(e: React.PointerEvent) {
    if (!dragRef.current || !imgRef.current) return
    const { px, py } = evPos(e)
    const { scale } = getScale()
    cropRef.current.x = dragRef.current.cx - (px - dragRef.current.sx) / scale
    cropRef.current.y = dragRef.current.cy - (py - dragRef.current.sy) / scale
    clamp(); redraw()
  }

  function onUp() { dragRef.current = null }

  function applyZoom(z: number) {
    const img = imgRef.current!
    const side = Math.min(img.width, img.height)
    const newSize = side / z
    const cx = cropRef.current.x + cropRef.current.size / 2
    const cy = cropRef.current.y + cropRef.current.size / 2
    cropRef.current = { x: cx - newSize / 2, y: cy - newSize / 2, size: newSize }
    clamp(); setZoom(z); redraw()
  }

  async function handleApply() {
    if (!imgRef.current) return
    setSaving(true)
    try {
      const { x, y, size } = cropRef.current
      const img = imgRef.current
      const OUT = 400
      const c = document.createElement('canvas'); c.width = OUT; c.height = OUT
      c.getContext('2d')!.drawImage(img, x, y, size, size, 0, 0, OUT, OUT)
      const blob = await new Promise<Blob>((res, rej) =>
        c.toBlob(b => b ? res(b) : rej(new Error('blob failed')), 'image/jpeg', 0.92))
      onCropped(new File([blob], file.name, { type: 'image/jpeg' }))
      handleClose()
    } catch (e) { console.error(e); toastError('Ошибка кадрирования') }
    finally { setSaving(false) }
  }

  if (!mounted) return null

  return ReactDOM.createPortal(
    <div style={{ position:'fixed',inset:0,zIndex:10000,display:'flex',alignItems:'center',justifyContent:'center',padding:20 }}>
      <div onClick={handleClose} style={{ position:'absolute',inset:0,background:'rgba(15,23,42,0.75)',backdropFilter:'blur(8px)',opacity:visible?1:0,transition:'opacity 0.26s' }} />
      <div style={{ position:'relative',zIndex:1,background:'var(--card)',borderRadius:24,width:460,maxWidth:'95vw',overflow:'hidden',boxShadow:'0 40px 120px rgba(0,0,0,0.35)',transform:visible?'scale(1)':'scale(0.95)',opacity:visible?1:0,transition:'all 0.26s cubic-bezier(.32,.72,0,1)' }}>
        {/* Header */}
        <div style={{ padding:'18px 22px 14px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between' }}>
          <div style={{ display:'flex',alignItems:'center',gap:10 }}>
            <div style={{ width:36,height:36,borderRadius:10,background:'linear-gradient(135deg,#F35703,#D44A02)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
              <i className="ki-filled ki-picture text-white text-sm" />
            </div>
            <div>
              <p style={{ fontSize:10,fontWeight:700,color:'var(--muted-foreground)',textTransform:'uppercase',letterSpacing:'0.12em',margin:0 }}>Фото профиля</p>
              <h3 style={{ fontSize:16,fontWeight:800,color:'var(--foreground)',margin:'2px 0 0',letterSpacing:'-0.02em',lineHeight:1 }}>Кадрировать фото</h3>
            </div>
          </div>
          <button onClick={handleClose} className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost"><i className="ki-filled ki-cross text-sm" /></button>
        </div>
        {/* Canvas */}
        <canvas ref={canvasRef} width={420} height={420}
          style={{ display:'block',width:'100%',background:'#0f172a',cursor:'grab',touchAction:'none',userSelect:'none' }}
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} />
        {/* Zoom */}
        <div style={{ padding:'14px 22px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',gap:12 }}>
          <i className="ki-filled ki-minus text-xs text-muted-foreground" />
          <input type="range" min={1} max={4} step={0.05} value={zoom}
            onChange={e => applyZoom(Number(e.target.value))}
            style={{ flex:1,accentColor:'#F35703',cursor:'pointer' }} />
          <i className="ki-filled ki-plus text-xs text-muted-foreground" />
          <span style={{ fontSize:11,fontWeight:700,color:'var(--muted-foreground)',minWidth:32,textAlign:'right' }}>{zoom.toFixed(1)}×</span>
        </div>
        {/* Hint */}
        <div style={{ padding:'10px 22px',display:'flex',alignItems:'center',gap:8 }}>
          <i className="ki-filled ki-information-4 text-xs" style={{ color:'#94A3B8',flexShrink:0 }} />
          <p style={{ fontSize:11,color:'var(--muted-foreground)',margin:0 }}>Перетаскивайте фото и масштабируйте слайдером. Оранжевый круг — область аватарки.</p>
        </div>
        {/* Footer */}
        <div style={{ padding:'12px 22px 20px',display:'flex',gap:10 }}>
          <button onClick={handleApply} disabled={saving} style={{ flex:1,padding:'12px 0',borderRadius:12,border:'none',background:'linear-gradient(135deg,#F35703,#D44A02)',color:'white',fontSize:14,fontWeight:700,cursor:saving?'not-allowed':'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8,boxShadow:'0 2px 8px rgba(243,87,3,0.35)',opacity:saving?0.7:1,transition:'all 0.15s' }}>
            {saving ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Сохранение…</> : <><i className="ki-filled ki-check text-sm" />Применить</>}
          </button>
          <button onClick={handleClose} style={{ padding:'12px 18px',borderRadius:12,border:'1.5px solid var(--border)',background:'transparent',color:'var(--muted-foreground)',fontSize:14,fontWeight:600,cursor:'pointer' }}>Отмена</button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Social Edit Modal ──────────────────────────────────────────────────────────
function SocialEditModal({ profile, onClose, onSaved }: {
  profile: AthleteProfile; onClose: () => void; onSaved: (p: Partial<AthleteProfile>) => void
}) {
  const { user } = useUser()
  const [ig, setIg]  = useState(profile.instagram_url ?? '')
  const [tg, setTg]  = useState(profile.telegram_url  ?? '')
  const [yt, setYt]  = useState(profile.youtube_url   ?? '')
  const [tt, setTt]  = useState(profile.tiktok_url    ?? '')
  const [ws, setWs]  = useState(profile.website_url   ?? '')
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!user) return
    setSaving(true)
    await getSB().from('athletes').upsert({
      id: user.id,
      instagram_url: ig || null, telegram_url: tg || null,
      youtube_url: yt || null, tiktok_url: tt || null, website_url: ws || null,
    }, { onConflict: 'id' })
    onSaved({ instagram_url: ig || null, telegram_url: tg || null,
      youtube_url: yt || null, tiktok_url: tt || null, website_url: ws || null })
    setSaving(false); onClose()
  }

  const fields = [
    { label: 'Instagram', value: ig, set: setIg, placeholder: 'https://instagram.com/username' },
    { label: 'Telegram',  value: tg, set: setTg, placeholder: 'https://t.me/username'          },
    { label: 'YouTube',   value: yt, set: setYt, placeholder: 'https://youtube.com/@channel'   },
    { label: 'TikTok',    value: tt, set: setTt, placeholder: 'https://tiktok.com/@username'   },
    { label: 'Сайт',      value: ws, set: setWs, placeholder: 'https://yoursite.com'           },
  ]

  return (
    <div style={{ position:'fixed',inset:0,zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:20 }}>
      <div onClick={onClose} style={{ position:'absolute',inset:0,background:'rgba(15,23,42,0.65)',backdropFilter:'blur(6px)' }} />
      <div style={{ position:'relative',background:'var(--card)',border:'1px solid var(--border)',borderRadius:20,width:420,maxWidth:'95vw',zIndex:1,overflow:'hidden',boxShadow:'0 32px 80px rgba(0,0,0,0.18)' }}>
        <div style={{ padding:'20px 24px 16px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between' }}>
          <div>
            <p style={{ fontSize:10,fontWeight:700,color:'#F35703',textTransform:'uppercase',letterSpacing:'0.12em',margin:0 }}>Профиль</p>
            <h3 style={{ fontSize:17,fontWeight:800,color:'var(--foreground)',margin:'3px 0 0' }}>Социальные сети</h3>
          </div>
          <button onClick={onClose} className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost"><i className="ki-filled ki-cross text-sm" /></button>
        </div>
        <div style={{ padding:'20px 24px',display:'flex',flexDirection:'column',gap:12 }}>
          {fields.map(f => (
            <div key={f.label}>
              <label style={{ fontSize:10,fontWeight:700,color:'var(--muted-foreground)',textTransform:'uppercase',letterSpacing:'0.1em',display:'block',marginBottom:5 }}>{f.label}</label>
              <input type="url" value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.placeholder}
                className="w-full rounded-xl border border-input px-3 py-2.5 text-sm outline-none focus:border-orange-400" />
            </div>
          ))}
          <div style={{ display:'flex',gap:10,marginTop:4 }}>
            <button onClick={save} disabled={saving} className="kt-btn kt-btn-primary flex-1">
              {saving ? 'Сохранение…' : 'Сохранить'}
            </button>
            <button onClick={onClose} className="kt-btn kt-btn-outline">Отмена</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Simple upload button for backgrounds ───────────────────────────────────────
function UploadBtn({ onFile, children, accept = 'image/*' }: {
  onFile: (f: File) => void; children: React.ReactNode; accept?: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <>
      <input ref={ref} type="file" accept={accept} style={{ display:'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) { onFile(f); e.target.value = '' } }} />
      <button type="button" onClick={() => ref.current?.click()} style={{ background:'none',border:'none',cursor:'pointer',padding:0 }}>
        {children}
      </button>
    </>
  )
}

// ── Main Card ──────────────────────────────────────────────────────────────────
export default function AthleteProfileCard() {
  const { user } = useUser()
  const { error: toastError } = useToast()
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [profile, setProfile] = useState<AthleteProfile | null>(null)
  const [stats, setStats] = useState<WorkoutStats>({ total:0, totalMinutes:0, avgStrain:0, thisWeek:0 })
  const [loading, setLoading] = useState(true)
  const [showSocial, setShowSocial] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [uploadingBg, setUploadingBg] = useState(false)
  // Кроппер
  const [cropFile, setCropFile] = useState<File | null>(null)

  useEffect(() => {
    if (!user) return
    const sb = getSB()
    async function load() {
      const [{ data: ath }, { data: wks }] = await Promise.all([
        sb.from('athletes').select('*').eq('id', user!.id).maybeSingle(),
        sb.from('workouts').select('activity_duration_min,activity_strain,event_date').eq('athlete_id', user!.id),
      ])
      const p: AthleteProfile = {
        name: user!.name ?? user!.email ?? 'Атлет',
        email: user!.email ?? '',
        sport_type: ath?.primary_sport ?? null,
        weight_kg: ath?.weight_kg ?? null,
        height_cm: ath?.height_cm ?? null,
        avatar_url: ath?.avatar_url ?? null,
        background_url: ath?.background_url ?? null,
        instagram_url: ath?.instagram_url ?? null,
        twitter_url: ath?.twitter_url ?? null,
        threads_url: ath?.threads_url ?? null,
        bio: ath?.bio ?? null,
        club: ath?.club ?? null,
        telegram_url: ath?.telegram_url ?? null,
        youtube_url: ath?.youtube_url ?? null,
        tiktok_url: ath?.tiktok_url ?? null,
        website_url: ath?.website_url ?? null,
      }
      setProfile(p)
      if (wks) {
        const now = new Date(); now.setHours(0,0,0,0)
        const weekAgo = new Date(now.getTime() - 7*86400000)
        const week = wks.filter(w => w.event_date && new Date(w.event_date+'T00:00:00') >= weekAgo)
        const totalMin = wks.reduce((s,w) => s+(w.activity_duration_min??0), 0)
        const strains = wks.filter(w => w.activity_strain != null)
        const avg = strains.length ? strains.reduce((s,w) => s+Number(w.activity_strain),0)/strains.length : 0
        setStats({ total:wks.length, totalMinutes:totalMin, avgStrain:Math.round(avg*10)/10, thisWeek:week.length })
      }
      setLoading(false)
    }
    load()
  }, [user])

  // Выбор файла → открыть кроппер
  function handleAvatarFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    e.target.value = ''
    setCropFile(f)
  }

  // После кропа → загрузить
  async function handleCroppedAvatar(croppedFile: File) {
    if (!user) return
    setUploadingAvatar(true)
    try {
      const sb = getSB()
      const path = `${user.id}/${Date.now()}.jpg`
      const { error } = await sb.storage.from('avatars').upload(path, croppedFile, { upsert: true })
      if (error) throw error
      const { data: { publicUrl } } = sb.storage.from('avatars').getPublicUrl(path)
      const urlWithCache = `${publicUrl}?v=${Date.now()}`
      await sb.from('athletes').upsert({ id: user.id, avatar_url: urlWithCache }, { onConflict: 'id' })
      setProfile(p => p ? { ...p, avatar_url: urlWithCache } : p)
    } catch (err) {
      console.error('avatar upload error:', err)
      toastError('Ошибка загрузки аватарки')
    } finally {
      setUploadingAvatar(false)
    }
  }

  async function uploadBackground(file: File) {
    if (!user) return
    setUploadingBg(true)
    try {
      const sb = getSB()
      const ext = file.name.split('.').pop()
      const path = `${user.id}/${Date.now()}.${ext}`
      const { error } = await sb.storage.from('backgrounds').upload(path, file, { upsert: true })
      if (error) throw error
      const { data: { publicUrl } } = sb.storage.from('backgrounds').getPublicUrl(path)
      const urlWithCache = `${publicUrl}?v=${Date.now()}`
      await sb.from('athletes').upsert({ id: user.id, background_url: urlWithCache }, { onConflict: 'id' })
      setProfile(p => p ? { ...p, background_url: urlWithCache } : p)
    } catch (err) {
      console.error('bg upload error:', err)
      toastError('Ошибка загрузки фона')
    } finally {
      setUploadingBg(false)
    }
  }

  if (loading) return (
    <div className="bg-card border border-border rounded-2xl p-6 flex items-center justify-center" style={{ minHeight:280 }}>
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!profile) return null

  const initials = profile.name.split(' ').map(p => p[0]).join('').slice(0,2).toUpperCase()

  return (
    <>
      <div className="bg-card border border-border rounded-2xl overflow-hidden">

        {/* ── Background zone ── */}
        <div style={{ position:'relative', height:130 }}>
          <div style={{
            position:'absolute', inset:0,
            background: profile.background_url
              ? `url(${profile.background_url}) center/cover no-repeat`
              : 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #F35703 100%)',
          }} />
          <div style={{ position:'absolute',inset:0,background:'rgba(0,0,0,0.08)' }} />

          {/* Change background button */}
          <UploadBtn onFile={uploadBackground} accept="image/jpeg,image/png,image/webp">
            <div style={{
              position:'absolute', top:12, right:12,
              background:'rgba(0,0,0,0.45)', backdropFilter:'blur(6px)',
              borderRadius:10, padding:'6px 12px',
              display:'flex', alignItems:'center', gap:6,
              color:'white', fontSize:12, fontWeight:600,
              transition:'all 0.15s', cursor:'pointer',
            }} className="hover:bg-black/60">
              {uploadingBg
                ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <i className="ki-filled ki-pencil text-xs" />
              }
              {uploadingBg ? 'Загрузка…' : 'Изменить фон'}
            </div>
          </UploadBtn>
        </div>

        {/* ── Content zone ── */}
        <div style={{ padding:'0 24px 24px' }}>

          {/* Avatar row */}
          <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'flex-start', marginTop:-44 }}>

            {/* Avatar — клик открывает кроппер */}
            <div style={{ position:'relative' }}>
              {/* Скрытый input для выбора файла */}
              <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif"
                style={{ display:'none' }}
                onChange={handleAvatarFileSelect} />

              <button type="button" onClick={() => avatarInputRef.current?.click()}
                style={{ background:'none', border:'none', cursor:'pointer', padding:0, display:'block' }}
                className="group">
                {/* Avatar */}
                {profile.avatar_url ? (
                  <Image
                    src={profile.avatar_url}
                    alt={profile.name}
                    width={80}
                    height={80}
                    unoptimized
                    style={{
                      width:80, height:80, borderRadius:'50%',
                      border:'4px solid var(--card)', objectFit:'cover', display:'block',
                    }}
                  />
                ) : (
                  <div style={{
                    width:80, height:80, borderRadius:'50%',
                    border:'4px solid var(--card)',
                    background:'linear-gradient(135deg,#F35703,#D44A02)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:26, fontWeight:900, color:'white', letterSpacing:'-0.02em',
                  }}>
                    {initials}
                  </div>
                )}
                {/* Hover overlay */}
                <div style={{
                  position:'absolute', inset:0, borderRadius:'50%',
                  background:'rgba(0,0,0,0.5)',
                  display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:3,
                  opacity: uploadingAvatar ? 1 : 0, transition:'opacity 0.2s',
                  border:'4px solid transparent',
                }} className="group-hover:opacity-100">
                  {uploadingAvatar
                    ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <>
                        <i className="ki-filled ki-picture text-white text-sm" />
                        <span style={{ fontSize:9, color:'white', fontWeight:700 }}>Изменить</span>
                      </>
                  }
                </div>
                {/* Crop badge */}
                {!uploadingAvatar && (
                  <div style={{
                    position:'absolute', bottom:-2, right:-2,
                    width:22, height:22, borderRadius:'50%',
                    background:'#F35703', border:'2px solid var(--card)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                  }}>
                    <i className="ki-filled ki-picture text-white" style={{ fontSize:9 }} />
                  </div>
                )}
              </button>
              {/* Online dot */}
              <span style={{ position:'absolute', bottom:6, right:6, width:16, height:16, borderRadius:'50%', background:'#22c55e', border:'3px solid var(--card)' }} />
            </div>

          </div>

          {/* Name & meta */}
          <div style={{ marginTop:12 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
              <h2 className="pf-heading-sm" style={{ color:'var(--foreground)', margin:0 }}>{profile.name}</h2>
              {profile.sport_type && (
                <span className="pf-label" style={{ padding:'3px 10px', borderRadius:20, background:'#fef0e7', color:'#D44A02', border:'1px solid #fbc1a0', fontSize:11, letterSpacing:'0.1em' }}>
                  {profile.sport_type}
                </span>
              )}
            </div>
            {profile.club && (
              <p style={{ fontSize:12, color:'var(--muted-foreground)', margin:'4px 0 0', display:'flex', alignItems:'center', gap:4 }}>
                <i className="ki-filled ki-office-bag" style={{ fontSize:10 }} />{profile.club}
              </p>
            )}
            {profile.bio && (
              <p style={{ fontSize:13, color:'var(--muted-foreground)', margin:'5px 0 0', lineHeight:1.55 }}>{profile.bio}</p>
            )}
            {(profile.height_cm || profile.weight_kg) && (
              <div style={{ display:'flex', gap:14, marginTop:7 }}>
                {profile.height_cm && <span style={{ fontSize:12, color:'var(--muted-foreground)', display:'flex', alignItems:'center', gap:4 }}>{profile.height_cm} см</span>}
                {profile.weight_kg && <span style={{ fontSize:12, color:'var(--muted-foreground)', display:'flex', alignItems:'center', gap:4 }}>{profile.weight_kg} кг</span>}
              </div>
            )}

            {/* Соцсети — компактный inline-блок */}
            {(() => {
              const socials = [
                {
                  url: profile.instagram_url, label: 'Instagram',
                  hoverBg: '#fcedee', hoverColor: '#E1306C',
                  icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>,
                },
                {
                  url: profile.telegram_url, label: 'Telegram',
                  hoverBg: '#e8f4fd', hoverColor: '#0088cc',
                  icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.96 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>,
                },
                {
                  url: profile.youtube_url, label: 'YouTube',
                  hoverBg: '#fff0f0', hoverColor: '#FF0000',
                  icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M23.495 6.205a3.007 3.007 0 0 0-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 0 0 .527 6.205a31.247 31.247 0 0 0-.522 5.805 31.247 31.247 0 0 0 .522 5.783 3.007 3.007 0 0 0 2.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 0 0 2.088-2.088 31.247 31.247 0 0 0 .5-5.783 31.247 31.247 0 0 0-.5-5.805zM9.609 15.601V8.408l6.264 3.602z"/></svg>,
                },
                {
                  url: profile.tiktok_url, label: 'TikTok',
                  hoverBg: '#f0f0f0', hoverColor: '#111111',
                  icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.34 6.34 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.96a8.22 8.22 0 0 0 4.81 1.54V7.04a4.85 4.85 0 0 1-1.04-.35z"/></svg>,
                },
                {
                  url: profile.website_url, label: 'Сайт',
                  hoverBg: '#f0f7ff', hoverColor: '#0284C7',
                  icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
                },
              ].filter(s => !!s.url)

              const MAX = 5
              const visible = socials.slice(0, MAX)
              const overflow = socials.length - MAX

              return (
                <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:10, flexWrap:'wrap' }}>
                  {visible.map(s => (
                    <a key={s.label} href={s.url!} target="_blank" rel="noopener noreferrer" title={s.label}
                      style={{ width:28, height:28, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center',
                        background:'var(--accent)', border:'1px solid var(--border)', color:'#9CA3AF',
                        textDecoration:'none', flexShrink:0, transition:'all 0.15s' }}
                      onMouseEnter={e => {
                        const el = e.currentTarget as HTMLAnchorElement
                        el.style.background = s.hoverBg; el.style.color = s.hoverColor
                        el.style.borderColor = s.hoverColor + '55'; el.style.transform = 'translateY(-1px)'
                      }}
                      onMouseLeave={e => {
                        const el = e.currentTarget as HTMLAnchorElement
                        el.style.background = 'var(--accent)'; el.style.color = '#9CA3AF'
                        el.style.borderColor = 'var(--border)'; el.style.transform = 'translateY(0)'
                      }}>
                      {s.icon}
                    </a>
                  ))}
                  {overflow > 0 && (
                    <span style={{ fontSize:11, color:'var(--muted-foreground)', fontWeight:600,
                      padding:'3px 8px', background:'var(--accent)', borderRadius:8, border:'1px solid var(--border)' }}>
                      +{overflow}
                    </span>
                  )}
                  <button onClick={() => setShowSocial(true)} title="Редактировать соцсети"
                    style={{ width:26, height:26, borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center',
                      background:'transparent', border:'1px dashed #CBD5E1', cursor:'pointer', flexShrink:0,
                      transition:'all 0.15s', color:'#CBD5E1', marginLeft:2 }}
                    onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.borderColor='#F35703'; b.style.color='#F35703'; b.style.background='#FEF0E7' }}
                    onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.borderColor='#CBD5E1'; b.style.color='#CBD5E1'; b.style.background='transparent' }}>
                    <i className="ki-filled ki-pencil" style={{ fontSize:9 }} />
                  </button>
                </div>
              )
            })()}
          </div>

          {/* Stats grid */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:1, marginTop:20, background:'var(--border)', borderRadius:16, overflow:'hidden', border:'1px solid var(--border)' }}>
            {[
              { label:'Тренировок', value:stats.total, icon:'ki-abstract-26', color:'#2563EB', bg:'#EFF6FF', href:'/diary' },
              { label:'Часов', value:fmtHours(stats.totalMinutes), icon:'ki-time', color:'#F35703', bg:'#FEF0E7', href:'/diary' },
              { label:'Ср. нагрузка', value:stats.avgStrain || '—', icon:'ki-chart-line-up', color:'#DC2626', bg:'#FEF2F2', href:'/calendar' },
              { label:'На неделе', value:stats.thisWeek, icon:'ki-calendar', color:'#16A34A', bg:'#F0FDF4', href:'/diary' },
            ].map((s,i) => (
              <Link key={i} href={s.href} style={{ display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'16px 8px',background:'var(--card)',gap:6,textDecoration:'none',transition:'background 0.15s',cursor:'pointer' }}
                className="hover:bg-accent/50">
                <div style={{ width:34,height:34,borderRadius:10,background:s.bg,display:'flex',alignItems:'center',justifyContent:'center' }}>
                  <i className={`ki-filled ${s.icon} text-sm`} style={{ color:s.color }} />
                </div>
                <div className="pf-heading-sm" style={{ color:'var(--foreground)' }}>{s.value}</div>
                <div className="pf-label" style={{ color:'var(--muted-foreground)',textAlign:'center' }}>{s.label}</div>
              </Link>
            ))}
          </div>

          {/* CTA */}
          <div style={{ display:'flex', gap:10, marginTop:16 }}>
            <Link href="/diary/new" style={{
              flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:7, padding:'11px 0',
              borderRadius:12, textDecoration:'none',
              background:'linear-gradient(135deg,#F35703,#D44A02)', color:'white',
              fontSize:13, fontWeight:700, boxShadow:'0 2px 8px rgba(243,87,3,0.3)',
            }}>
              <i className="ki-filled ki-plus text-sm" />Новая тренировка
            </Link>
            <Link href="/settings" style={{
              display:'flex', alignItems:'center', justifyContent:'center', gap:7, padding:'11px 18px',
              borderRadius:12, textDecoration:'none', border:'1px solid var(--border)',
              background:'var(--card)', color:'var(--muted-foreground)',
              fontSize:13, fontWeight:600, transition:'all 0.15s',
            }}
              onMouseEnter={e=>{(e.currentTarget as HTMLAnchorElement).style.borderColor='#F35703';(e.currentTarget as HTMLAnchorElement).style.color='#F35703'}}
              onMouseLeave={e=>{(e.currentTarget as HTMLAnchorElement).style.borderColor='var(--border)';(e.currentTarget as HTMLAnchorElement).style.color='var(--muted-foreground)'}}>
              <i className="ki-filled ki-setting-2 text-sm" />Профиль
            </Link>
          </div>
        </div>
      </div>

      {/* Модал кропа */}
      {cropFile && (
        <AvatarCropModal
          file={cropFile}
          onClose={() => setCropFile(null)}
          onCropped={handleCroppedAvatar}
        />
      )}

      {/* Модал соцсетей */}
      {showSocial && (
        <SocialEditModal
          profile={profile}
          onClose={() => setShowSocial(false)}
          onSaved={updates => setProfile(p => p ? { ...p, ...updates } : p)}
        />
      )}
    </>
  )
}
