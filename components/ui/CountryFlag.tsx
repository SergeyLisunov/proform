/**
 * CountryFlag — маленький SVG-флаг страны (замена emoji-флагам).
 *
 * Нативный <select> не умеет рендерить графику в <option> (только текст),
 * поэтому флаг показывается как adornment рядом с выпадающим списком —
 * отражает ВЫБРАННУЮ страну. SVG берутся из /public/assets/flags/ (набор
 * flag-icons, скопирован статически — без рантайм-зависимости).
 *
 * Для '', 'OTHER' и неизвестных кодов — нейтральный значок геолокации.
 */
const FLAG_CODES = new Set(['ru', 'by', 'kz', 'ua', 'us', 'de', 'fr', 'gb'])

interface CountryFlagProps {
  code: string | null | undefined
  /** Доп. классы (размер задаётся через className, дефолт h-[15px] w-5). */
  className?: string
}

export function CountryFlag({ code, className }: CountryFlagProps) {
  const c = (code ?? '').trim().toLowerCase()
  if (!FLAG_CODES.has(c)) {
    return (
      <i
        className={`ki-filled ki-geolocation text-muted-foreground ${className ?? ''}`}
        aria-hidden="true"
      />
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/assets/flags/${c}.svg`}
      alt=""
      aria-hidden="true"
      width={20}
      height={15}
      className={`inline-block shrink-0 rounded-[2px] ${className ?? 'h-[15px] w-5'}`}
    />
  )
}
