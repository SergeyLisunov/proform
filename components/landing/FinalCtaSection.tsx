/**
 * <FinalCtaSection /> — Sprint W14 Day 71.
 *
 * Last conversion push на landing. Repeats hero CTAs более urgent
 * framing + добавляет «свяжитесь с нами» fallback для тех, кому нужно
 * обсудить тариф клуба перед регистрацией.
 *
 * Visual: gradient bg (warm orange→white), centered content, 2 CTAs.
 */
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export default function FinalCtaSection() {
  return (
    <section className="w-full bg-gradient-to-br from-orange-50 via-white to-orange-50/50 py-20 px-4 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-2xs font-bold uppercase tracking-[0.24em] text-orange-700">
          Готовы попробовать?
        </p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          ProForm в вашем клубе — через 10 минут
        </h2>
        <p className="mt-5 text-base leading-relaxed text-muted-foreground sm:text-lg">
          10 минут на регистрацию организации. 5 минут на первого тренера. Дальше —
          обычный рабочий день, только с одной системой вместо пяти.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/auth/register"
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-orange-500/20 transition-all hover:bg-orange-600 hover:shadow-xl sm:w-auto no-underline"
          >
            Создать организацию
            <ArrowRight size={18} />
          </Link>
          <Link
            href="/auth/login?demo=org"
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-orange-200 bg-white px-6 py-3.5 text-base font-semibold text-orange-700 transition-all hover:border-orange-300 hover:bg-orange-50 sm:w-auto no-underline"
          >
            Demo как организация
          </Link>
        </div>

        <p className="mt-6 text-sm text-muted-foreground">
          Доступ для тренеров, спортсменов и врачей создаётся внутри организации.
          Никаких отдельных регистраций для каждой роли.
        </p>
      </div>
    </section>
  )
}
