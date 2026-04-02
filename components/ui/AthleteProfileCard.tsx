'use client'
import { useEffect, useState, useRef } from 'react'
import { useToast } from '@/lib/hooks/useToast'
import Link from 'next/link'
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
    img.src = objUrl.current
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      URL.revokeObjectURL(objUrl.current)
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
    ctx.strokeStyle = '#F97316'; ctx.lineWidth = 3; ctx.stroke()
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
            <div style={{ width:36,height:36,borderRadius:10,background:'linear-gradient(135deg,#F97316,#EA580C)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
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
            style={{ flex:1,accentColor:'#F97316',cursor:'pointer' }} />
          <i className="ki-filled ki-plus text-xs text-muted-foreground" />
          <span style={{ fontSize:11,fontWeight:700,color:'var(--muted-foreground)',minWidth:32,textAlign:'right' }}>{zoom.toFixed(1)}×</span>
        </div>
        {/* Hint */}
        <div style={{ padding:'10px 22px',display:'flex',alignItems:'center',gap:8 }}>
          <i className="ki-filled ki-information-5 text-xs" style={{ color:'#94A3B8',flexShrink:0 }} />
          <p style={{ fontSize:11,color:'var(--muted-foreground)',margin:0 }}>Перетаскивайте фото и масштабируйте слайдером. Оранжевый круг — область аватарки.</p>
        </div>
        {/* Footer */}
        <div style={{ padding:'12px 22px 20px',display:'flex',gap:10 }}>
          <button onClick={handleApply} disabled={saving} style={{ flex:1,padding:'12px 0',borderRadius:12,border:'none',background:'linear-gradient(135deg,#F97316,#EA580C)',color:'white',fontSize:14,fontWeight:700,cursor:saving?'not-allowed':'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8,boxShadow:'0 2px 8px rgba(249,115,22,0.35)',opacity:saving?0.7:1,transition:'all 0.15s' }}>
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
  const [ig, setIg] = useState(profile.instagram_url ?? '')
  const [tw, setTw] = useState(profile.twitter_url ?? '')
  const [th, setTh] = useState(profile.threads_url ?? '')
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!user) return
    setSaving(true)
    await getSB().from('athletes').upsert({
      id: user.id,
      instagram_url: ig || null, twitter_url: tw || null, threads_url: th || null,
    }, { onConflict: 'id' })
    onSaved({ instagram_url: ig || null, twitter_url: tw || null, threads_url: th || null })
    setSaving(false); onClose()
  }

  return (
    <div style={{ position:'fixed',inset:0,zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:20 }}>
      <div onClick={onClose} style={{ position:'absolute',inset:0,background:'rgba(15,23,42,0.65)',backdropFilter:'blur(6px)' }} />
      <div style={{ position:'relative',background:'var(--card)',border:'1px solid var(--border)',borderRadius:20,width:400,maxWidth:'95vw',zIndex:1,overflow:'hidden',boxShadow:'0 32px 80px rgba(0,0,0,0.18)' }}>
        <div style={{ padding:'20px 24px 16px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between' }}>
          <div>
            <p style={{ fontSize:10,fontWeight:700,color:'#f97316',textTransform:'uppercase',letterSpacing:'0.12em',margin:0 }}>Профиль</p>
            <h3 style={{ fontSize:17,fontWeight:800,color:'var(--foreground)',margin:'3px 0 0' }}>Социальные сети</h3>
          </div>
          <button onClick={onClose} className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost"><i className="ki-filled ki-cross text-sm" /></button>
        </div>
        <div style={{ padding:'20px 24px',display:'flex',flexDirection:'column',gap:14 }}>
          {[
            { label:'Instagram', value:ig, set:setIg, placeholder:'https://instagram.com/username', emoji:'📸' },
            { label:'Twitter / X', value:tw, set:setTw, placeholder:'https://x.com/username', emoji:'🐦' },
            { label:'Threads', value:th, set:setTh, placeholder:'https://threads.net/@username', emoji:'🧵' },
          ].map(f => (
            <div key={f.label}>
              <label style={{ fontSize:10,fontWeight:700,color:'var(--muted-foreground)',textTransform:'uppercase',letterSpacing:'0.1em',display:'block',marginBottom:6 }}>{f.emoji} {f.label}</label>
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
              : 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f97316 100%)',
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
                  <img src={profile.avatar_url} alt={profile.name} style={{
                    width:80, height:80, borderRadius:'50%',
                    border:'4px solid var(--card)', objectFit:'cover', display:'block',
                  }} />
                ) : (
                  <div style={{
                    width:80, height:80, borderRadius:'50%',
                    border:'4px solid var(--card)',
                    background:'linear-gradient(135deg,#f97316,#ea580c)',
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
                        <i className="ki-filled ki-camera text-white text-sm" />
                        <span style={{ fontSize:9, color:'white', fontWeight:700 }}>Изменить</span>
                      </>
                  }
                </div>
                {/* Crop badge */}
                {!uploadingAvatar && (
                  <div style={{
                    position:'absolute', bottom:-2, right:-2,
                    width:22, height:22, borderRadius:'50%',
                    background:'#F97316', border:'2px solid var(--card)',
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
              <h2 style={{ fontSize:22, fontWeight:900, color:'var(--foreground)', margin:0, letterSpacing:'-0.02em' }}>{profile.name}</h2>
              {profile.sport_type && (
                <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20, background:'#fff7ed', color:'#ea580c', border:'1px solid #fed7aa' }}>
                  {profile.sport_type}
                </span>
              )}
            </div>
            {profile.bio && (
              <p style={{ fontSize:13, color:'var(--muted-foreground)', margin:'5px 0 0', lineHeight:1.55 }}>{profile.bio}</p>
            )}
            {(profile.height_cm || profile.weight_kg) && (
              <div style={{ display:'flex', gap:14, marginTop:7 }}>
                {profile.height_cm && <span style={{ fontSize:12, color:'var(--muted-foreground)', display:'flex', alignItems:'center', gap:4 }}><span>📏</span>{profile.height_cm} см</span>}
                {profile.weight_kg && <span style={{ fontSize:12, color:'var(--muted-foreground)', display:'flex', alignItems:'center', gap:4 }}><span>⚖️</span>{profile.weight_kg} кг</span>}
              </div>
            )}

            {/* Соцсети — под именем */}
            <div style={{ display:'flex', gap:8, marginTop:12, alignItems:'center' }}>
              {/* Instagram */}
              {profile.instagram_url ? (
                <a href={profile.instagram_url} target="_blank" rel="noopener noreferrer" title="Instagram"
                  style={{ width:36,height:36,borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',background:'linear-gradient(135deg,#f09433,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888)',border:'none',cursor:'pointer',flexShrink:0,textDecoration:'none',boxShadow:'0 2px 8px rgba(220,39,67,0.3)',transition:'all 0.18s' }}
                  onMouseEnter={e=>(e.currentTarget as HTMLAnchorElement).style.transform='scale(1.1)'}
                  onMouseLeave={e=>(e.currentTarget as HTMLAnchorElement).style.transform='scale(1)'}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="white" stroke="none"/></svg>
                </a>
              ) : (
                <button onClick={() => setShowSocial(true)} title="Добавить Instagram"
                  style={{ width:36,height:36,borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',background:'var(--accent)',border:'1.5px dashed #CBD5E1',cursor:'pointer',flexShrink:0,transition:'all 0.18s' }}
                  onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.borderColor='#f09433';(e.currentTarget as HTMLButtonElement).style.background='#FFF7ED'}}
                  onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.borderColor='#CBD5E1';(e.currentTarget as HTMLButtonElement).style.background='var(--accent)'}}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="#CBD5E1" stroke="none"/></svg>
                </button>
              )}
              {/* X / Twitter */}
              {profile.twitter_url ? (
                <a href={profile.twitter_url} target="_blank" rel="noopener noreferrer" title="X / Twitter"
                  style={{ width:36,height:36,borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',background:'#000',border:'none',cursor:'pointer',flexShrink:0,textDecoration:'none',boxShadow:'0 2px 8px rgba(0,0,0,0.25)',transition:'all 0.18s' }}
                  onMouseEnter={e=>(e.currentTarget as HTMLAnchorElement).style.transform='scale(1.1)'}
                  onMouseLeave={e=>(e.currentTarget as HTMLAnchorElement).style.transform='scale(1)'}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="white"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.259 5.63 5.905-5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                </a>
              ) : (
                <button onClick={() => setShowSocial(true)} title="Добавить X / Twitter"
                  style={{ width:36,height:36,borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',background:'var(--accent)',border:'1.5px dashed #CBD5E1',cursor:'pointer',flexShrink:0,transition:'all 0.18s' }}
                  onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.borderColor='#94A3B8';(e.currentTarget as HTMLButtonElement).style.background='#F8FAFC'}}
                  onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.borderColor='#CBD5E1';(e.currentTarget as HTMLButtonElement).style.background='var(--accent)'}}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#CBD5E1"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.259 5.63 5.905-5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                </button>
              )}
              {/* Threads */}
              {profile.threads_url ? (
                <a href={profile.threads_url} target="_blank" rel="noopener noreferrer" title="Threads"
                  style={{ width:36,height:36,borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',background:'#101010',border:'none',cursor:'pointer',flexShrink:0,textDecoration:'none',boxShadow:'0 2px 8px rgba(0,0,0,0.25)',transition:'all 0.18s' }}
                  onMouseEnter={e=>(e.currentTarget as HTMLAnchorElement).style.transform='scale(1.1)'}
                  onMouseLeave={e=>(e.currentTarget as HTMLAnchorElement).style.transform='scale(1)'}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="white"><path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.471 12.01v-.017c.029-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.293-1.806-1.817-.436 3.048-2.266 4.878-5.309 5.056-2.329.138-4.518-.988-4.62-3.411-.026-.634.032-1.219.17-1.742.422-1.578 1.674-2.564 3.492-2.773.852-.098 1.713-.09 2.562-.038l.018.002c-.051-.543-.186-.997-.4-1.35-.311-.513-.83-.81-1.647-.81-.607 0-1.127.153-1.543.454l-1.218-1.59C9.94 7.867 10.93 7.5 12.1 7.5c2.9 0 4.578 1.71 4.615 4.76.006.498-.002.998-.025 1.498-.021.465-.046.932-.08 1.395.532.175 1.002.391 1.398.65 1.37.888 2.086 2.146 2.086 3.637 0 3.42-2.875 5.56-7.906 5.56zm1.054-8.14c-1.134-.073-1.96.26-2.24 1.063-.069.2-.096.448-.073.752.097 1.3 1.206 1.63 2.317 1.63.184 0 .37-.01.553-.03 1.633-.178 2.474-1.128 2.613-2.962-.37-.05-.742-.087-1.113-.117a18.43 18.43 0 0 0-2.057-.336z"/></svg>
                </a>
              ) : (
                <button onClick={() => setShowSocial(true)} title="Добавить Threads"
                  style={{ width:36,height:36,borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',background:'var(--accent)',border:'1.5px dashed #CBD5E1',cursor:'pointer',flexShrink:0,transition:'all 0.18s' }}
                  onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.borderColor='#94A3B8';(e.currentTarget as HTMLButtonElement).style.background='#F8FAFC'}}
                  onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.borderColor='#CBD5E1';(e.currentTarget as HTMLButtonElement).style.background='var(--accent)'}}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="#CBD5E1"><path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.471 12.01v-.017c.029-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.293-1.806-1.817-.436 3.048-2.266 4.878-5.309 5.056-2.329.138-4.518-.988-4.62-3.411-.026-.634.032-1.219.17-1.742.422-1.578 1.674-2.564 3.492-2.773.852-.098 1.713-.09 2.562-.038l.018.002c-.051-.543-.186-.997-.4-1.35-.311-.513-.83-.81-1.647-.81-.607 0-1.127.153-1.543.454l-1.218-1.59C9.94 7.867 10.93 7.5 12.1 7.5c2.9 0 4.578 1.71 4.615 4.76.006.498-.002.998-.025 1.498-.021.465-.046.932-.08 1.395.532.175 1.002.391 1.398.65 1.37.888 2.086 2.146 2.086 3.637 0 3.42-2.875 5.56-7.906 5.56zm1.054-8.14c-1.134-.073-1.96.26-2.24 1.063-.069.2-.096.448-.073.752.097 1.3 1.206 1.63 2.317 1.63.184 0 .37-.01.553-.03 1.633-.178 2.474-1.128 2.613-2.962-.37-.05-.742-.087-1.113-.117a18.43 18.43 0 0 0-2.057-.336z"/></svg>
                </button>
              )}
              {/* Карандаш — редактировать */}
              <button onClick={() => setShowSocial(true)} title="Редактировать соцсети"
                style={{ width:32,height:32,borderRadius:9,display:'flex',alignItems:'center',justifyContent:'center',background:'var(--accent)',border:'1px solid var(--border)',cursor:'pointer',flexShrink:0,transition:'all 0.18s',marginLeft:2 }}
                onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.borderColor='#F97316';(e.currentTarget as HTMLButtonElement).style.background='#FFF7ED'}}
                onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.borderColor='var(--border)';(e.currentTarget as HTMLButtonElement).style.background='var(--accent)'}}>
                <i className="ki-filled ki-pencil" style={{ fontSize:11, color:'var(--muted-foreground)' }} />
              </button>
            </div>
          </div>

          {/* Stats grid */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:1, marginTop:20, background:'var(--border)', borderRadius:16, overflow:'hidden', border:'1px solid var(--border)' }}>
            {[
              { label:'Тренировок', value:stats.total, icon:'ki-abstract-26', color:'#2563EB', bg:'#EFF6FF', href:'/diary' },
              { label:'Часов', value:fmtHours(stats.totalMinutes), icon:'ki-time', color:'#F97316', bg:'#FFF7ED', href:'/diary' },
              { label:'Ср. нагрузка', value:stats.avgStrain || '—', icon:'ki-chart-line-up', color:'#DC2626', bg:'#FEF2F2', href:'/calendar' },
              { label:'На неделе', value:stats.thisWeek, icon:'ki-calendar', color:'#16A34A', bg:'#F0FDF4', href:'/diary' },
            ].map((s,i) => (
              <Link key={i} href={s.href} style={{ display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'16px 8px',background:'var(--card)',gap:6,textDecoration:'none',transition:'background 0.15s',cursor:'pointer' }}
                className="hover:bg-accent/50">
                <div style={{ width:34,height:34,borderRadius:10,background:s.bg,display:'flex',alignItems:'center',justifyContent:'center' }}>
                  <i className={`ki-filled ${s.icon} text-sm`} style={{ color:s.color }} />
                </div>
                <div className="pf-num" style={{ fontSize:22,fontWeight:900,color:'var(--foreground)',lineHeight:1 }}>{s.value}</div>
                <div style={{ fontSize:10,color:'var(--muted-foreground)',fontWeight:500,textAlign:'center' }}>{s.label}</div>
              </Link>
            ))}
          </div>

          {/* CTA */}
          <div style={{ display:'flex', gap:10, marginTop:16 }}>
            <Link href="/diary/new" style={{
              flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:7, padding:'11px 0',
              borderRadius:12, textDecoration:'none',
              background:'linear-gradient(135deg,#F97316,#EA580C)', color:'white',
              fontSize:13, fontWeight:700, boxShadow:'0 2px 8px rgba(249,115,22,0.3)',
            }}>
              <i className="ki-filled ki-plus text-sm" />Новая тренировка
            </Link>
            <Link href="/settings" style={{
              display:'flex', alignItems:'center', justifyContent:'center', gap:7, padding:'11px 18px',
              borderRadius:12, textDecoration:'none', border:'1px solid var(--border)',
              background:'var(--card)', color:'var(--muted-foreground)',
              fontSize:13, fontWeight:600, transition:'all 0.15s',
            }}
              onMouseEnter={e=>{(e.currentTarget as HTMLAnchorElement).style.borderColor='#F97316';(e.currentTarget as HTMLAnchorElement).style.color='#F97316'}}
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
