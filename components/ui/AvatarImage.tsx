import Image from 'next/image'
import { cn } from '@/lib/utils'

/**
 * AvatarImage — аватар через next/image.
 *
 * ЗАЧЕМ. Аватары показываются в каждом списке — состав клуба, лента, чаты,
 * выдача тренеров. Раньше это были голые <img>: без конвертации в WebP, без
 * подгонки под реальный размер (в вёрстке 36–80 px, а с сервера приходит
 * оригинал) и без ленивой загрузки. На экране со списком из двадцати человек
 * это два десятка полноразмерных картинок.
 *
 * ПРО RELATIVE. Обёртка ставит position: relative сама. Контейнеры аватаров в
 * коде — это flex-коробки с фоном и инициалами, relative у них нет, а
 * next/image с fill без него растянулся бы до ближайшего позиционированного
 * предка, то есть уехал бы по всей странице.
 *
 * ПРО ЗАПАСНОЙ ПУТЬ. next/image работает только с доменами из remotePatterns
 * (сейчас там **.supabase.co, куда и складываются загруженные аватары). Если
 * в базе окажется ссылка с другого домена — например, импортированная из
 * старой системы, — оптимизатор ответил бы ошибкой и аватар просто не
 * отрисовался. Поэтому неизвестный домен и blob:-ссылки уходят в обычный
 * <img>: хуже по весу, но картинка на месте.
 */
const OPTIMIZED_HOSTS = [/\.supabase\.co$/]

function canOptimize(src: string): boolean {
  if (src.startsWith('/')) return true // локальная статика
  try {
    const { hostname, protocol } = new URL(src)
    if (protocol !== 'https:') return false // blob:, data:, http:
    return OPTIMIZED_HOSTS.some(re => re.test(hostname))
  } catch {
    return false
  }
}

export function AvatarImage({
  src,
  alt,
  className,
  sizes = '80px',
}: {
  src: string
  /** Пустая строка — если рядом уже есть имя человека текстом. */
  alt: string
  className?: string
  /** Реальный размер в вёрстке: по нему выбирается ширина с сервера. */
  sizes?: string
}) {
  const wrapper = cn('relative block h-full w-full overflow-hidden', className)

  if (!canOptimize(src)) {
    return (
      <span className={wrapper}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="h-full w-full object-cover" />
      </span>
    )
  }

  return (
    <span className={wrapper}>
      <Image src={src} alt={alt} fill sizes={sizes} className="object-cover" />
    </span>
  )
}
