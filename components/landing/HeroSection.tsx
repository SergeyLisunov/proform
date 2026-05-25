/**
 * <HeroSection /> — Sprint W14 Day 71.
 *
 * Top-of-fold marketing hero. Answers «что это / для кого / что я могу
 * сделать прямо сейчас» в первом экране.
 *
 * Layout:
 *   - Left col (60%): eyebrow + H1 + subline + 2 CTAs + trust line
 *   - Right col (40%): visual mockup composition (3 layered cards
 *     suggesting athlete card + coach panel + doctor note)
 *
 * Mobile: stack vertical, mockup shrinks к single representative card.
 */
import Link from 'next/link'
import { ArrowRight, Building2, Heart, Stethoscope, Target, User } from 'lucide-react'

export default function HeroSection() {
  return (
    <section
      className="relative w-full overflow-hidden"
      style={{
        background:
          'radial-gradient(circle at top right, rgba(249,115,22,0.10), transparent 38%), linear-gradient(180deg, #FFFFFF 0%, #FFF7ED 100%)',
      }}
    >
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.2fr_1fr] lg:gap-12 lg:px-10 lg:py-24">
        {/* Left col — copy */}
        <div className="flex flex-col justify-center">
          <p className="text-2xs font-bold uppercase tracking-[0.24em] text-orange-700">
            Спортивная платформа
          </p>
          <h1 className="pf-num mt-3 text-[clamp(2.4rem,6vw,4.5rem)] font-bold leading-[0.95] tracking-tight text-foreground">
            Тренер, спортсмен, врач{' '}
            <span className="text-orange-500">и клуб</span> — работают в одной системе
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Спортивная подготовка без чатов, таблиц и потерянных данных.
            Прогресс спортсмена видят все, кому это нужно — и только они.
          </p>

          {/* CTAs */}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/auth/register"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-500 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-orange-500/20 transition-all hover:bg-orange-600 hover:shadow-xl no-underline"
            >
              Создать аккаунт
              <ArrowRight size={18} />
            </Link>
            <Link
              href="/auth/login?demo=coach"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-orange-200 bg-white px-6 py-3.5 text-base font-semibold text-orange-700 transition-all hover:border-orange-300 hover:bg-orange-50 no-underline"
            >
              Открыть demo как тренер
            </Link>
          </div>

          {/* Trust line */}
          <p className="mt-6 text-sm text-muted-foreground">
            Бесплатно во время закрытой беты · Подключение клуба за 10 минут ·
            Подходит для клубов, академий и performance-центров
          </p>
        </div>

        {/* Right col — layered visual composition (decorative — AT users
            already heard the headline + CTAs to the left) */}
        <div aria-hidden="true" className="relative hidden lg:block">
          {/* Background gradient orb */}
          <div className="absolute -right-12 top-12 h-72 w-72 rounded-full bg-orange-200/40 blur-3xl" />
          <div className="absolute -bottom-12 -left-12 h-64 w-64 rounded-full bg-blue-200/30 blur-3xl" />

          {/* Athlete card — main, foreground */}
          <div className="relative ml-10 mt-4 rounded-3xl border border-border bg-white p-5 shadow-2xl shadow-orange-500/10">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-100 text-orange-600">
                <User size={22} strokeWidth={2} />
              </div>
              <div>
                <div className="text-base font-bold text-foreground">Александр Иванов</div>
                <div className="text-xs text-muted-foreground">Атлет · Лёгкая атлетика · 19 лет</div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-emerald-50 px-2 py-2">
                <div className="pf-num text-xl font-bold text-emerald-700">82%</div>
                <div className="text-[9px] font-semibold uppercase tracking-wider text-emerald-700/70">готов</div>
              </div>
              <div className="rounded-xl bg-orange-50 px-2 py-2">
                <div className="pf-num text-xl font-bold text-orange-700">14.2</div>
                <div className="text-[9px] font-semibold uppercase tracking-wider text-orange-700/70">нагрузка</div>
              </div>
              <div className="rounded-xl bg-blue-50 px-2 py-2">
                <div className="pf-num text-xl font-bold text-blue-700">42 ms</div>
                <div className="text-[9px] font-semibold uppercase tracking-wider text-blue-700/70">HRV</div>
              </div>
            </div>
            <div className="mt-3 border-t border-border pt-3 text-xs">
              <div className="flex items-center justify-between text-muted-foreground">
                <span>На сегодня</span>
                <span className="font-semibold text-foreground">Темповая 6 км</span>
              </div>
            </div>
          </div>

          {/* Coach panel — mid-layer, partial */}
          <div className="absolute -left-2 top-32 w-56 rounded-2xl border border-border bg-white p-4 shadow-xl">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-green-100 text-green-600">
                <Target size={14} strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-foreground truncate">Отзыв тренера</div>
                <div className="text-[9px] text-muted-foreground">2 минуты назад</div>
              </div>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              Темп держал ровно. Готовность падает — снижаем интенсивность завтра.
            </p>
          </div>

          {/* Doctor note — back-layer */}
          <div className="absolute -right-4 top-52 w-48 rounded-2xl border border-border bg-white p-3 shadow-lg">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-100 text-red-600">
                <Stethoscope size={12} strokeWidth={2} />
              </div>
              <div className="text-[10px] font-bold text-foreground">Врач</div>
            </div>
            <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">
              Беговая нагрузка — ОК. Контроль на следующей неделе.
            </p>
          </div>

          {/* Organization chip */}
          <div className="absolute bottom-4 left-16 flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 shadow-sm">
            <Building2 size={12} className="text-blue-600" />
            <span className="text-[11px] font-semibold text-blue-700">Клуб «Спарта»</span>
          </div>

          {/* Parent chip */}
          <div className="absolute bottom-20 right-2 flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 shadow-sm">
            <Heart size={12} className="text-violet-600" />
            <span className="text-[11px] font-semibold text-violet-700">Родитель — прозрачность</span>
          </div>
        </div>
      </div>
    </section>
  )
}
