/**
 * <SecuritySection /> — Sprint W14 Day 69.
 *
 * Trust block — критично для B2B sales + parent trust. Объясняет
 * role-based access без жаргона.
 *
 * Visual: dark navy background (контраст с белыми соседними секциями),
 * акцентирует важность блока. Inside: 4 trust principles (cards) +
 * access matrix table (кто что видит / не видит).
 */
import { Database, Lock, ShieldCheck, UserCheck } from 'lucide-react'

interface AccessRow {
  role:     string
  sees:     string
  doesNotSee: string
}

const ACCESS_MATRIX: AccessRow[] = [
  {
    role:       '🎯 Тренер',
    sees:       'Своих спортсменов, тренировки, готовность, отзывы',
    doesNotSee: 'Спортсменов других тренеров; частные заметки врача',
  },
  {
    role:       '💪 Спортсмен',
    sees:       'Свой прогресс, план, отзывы тренера, видимые рекомендации',
    doesNotSee: 'Дневник тренера, других спортсменов, частные данные',
  },
  {
    role:       '🩺 Врач',
    sees:       'Назначенных пациентов, их медицинскую историю',
    doesNotSee: 'Тренировочный план (если не shared); других спортсменов',
  },
  {
    role:       '👨‍👩‍👧 Родитель',
    sees:       'Прогресс только своего ребёнка, расписание, ограничения',
    doesNotSee: 'Других детей, тренерские заметки',
  },
  {
    role:       '🏛 Организация',
    sees:       'Управленческую картину: тренеры, спортсмены, активность',
    doesNotSee: 'Частные тренерские заметки; deperson. медданные',
  },
]

const PRINCIPLES = [
  {
    icon:  UserCheck,
    title: 'Доступ по роли',
    body:  'Никакая роль не видит чужие данные — это контролируется на уровне базы данных, не приложения.',
  },
  {
    icon:  Lock,
    title: 'Изоляция медицинских данных',
    body:  'Врачи имеют отдельный контур доступа. Тренеры видят только то, что врач явно расшарил.',
  },
  {
    icon:  ShieldCheck,
    title: 'Прозрачность для родителя',
    body:  'Родитель видит данные только своего ребёнка. Это не настройка privacy — это default.',
  },
  {
    icon:  Database,
    title: 'Аудит действий',
    body:  'Организация видит, кто что менял и когда — для compliance и расследования инцидентов.',
  },
]

export default function SecuritySection() {
  return (
    <section className="w-full bg-slate-900 text-white py-20 px-4 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="max-w-3xl">
          <p className="text-2xs font-bold uppercase tracking-[0.24em] text-orange-400">
            Безопасность данных
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Доступ — только тем, кому положено
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-300">
            Каждая роль видит только нужные ей данные. Это не настройка администратора —
            это архитектура платформы.
          </p>
        </div>

        {/* 4 principles */}
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PRINCIPLES.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-orange-400">
                <Icon size={18} />
              </div>
              <h3 className="mt-4 text-sm font-bold uppercase tracking-wider">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">{body}</p>
            </div>
          ))}
        </div>

        {/* Access matrix table */}
        <div className="mt-12 overflow-hidden rounded-3xl border border-white/10 bg-white/5">
          <div className="border-b border-white/10 px-5 py-4 sm:px-7">
            <h3 className="text-base font-bold">Кто что видит</h3>
            <p className="mt-1 text-xs text-slate-400">
              Полная матрица доступа по ролям. Применяется на уровне базы данных через RLS-политики.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-2xs font-bold uppercase tracking-wider text-slate-400">
                  <th className="px-5 py-3 sm:px-7">Роль</th>
                  <th className="px-5 py-3">Видит</th>
                  <th className="px-5 py-3 pr-5 sm:pr-7">Не видит</th>
                </tr>
              </thead>
              <tbody>
                {ACCESS_MATRIX.map((row) => (
                  <tr key={row.role} className="border-t border-white/10 align-top">
                    <td className="px-5 py-4 font-semibold whitespace-nowrap sm:px-7">{row.role}</td>
                    <td className="px-5 py-4 text-emerald-200">{row.sees}</td>
                    <td className="px-5 py-4 pr-5 text-slate-400 sm:pr-7">{row.doesNotSee}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Trust footer */}
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-xs leading-relaxed text-slate-400">
            <span className="font-semibold text-slate-200">Инфраструктура.</span>{' '}
            Хостинг данных в Supabase (EU-Central-1, Frankfurt) ·
            Шифрование at-rest и в transit ·
            RLS-политики на каждой таблице · Аудит изменений критичных данных.
          </p>
        </div>
      </div>
    </section>
  )
}
