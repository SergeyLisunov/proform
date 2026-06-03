/**
 * <FaqSection /> — Sprint W14 Day 71.
 *
 * 7 FAQ items. `<details>` accordion wrapped в `<TrackedFaqItem />`
 * (W15 Day 76) что emit'ит `landing.faq_open` event на expand. Native
 * disclosure pattern preserved — only behaviour change = analytics
 * tracking.
 *
 * Контент честный — никаких overpromise, никаких vendor name-drops.
 */
import TrackedFaqItem from '@/components/analytics/TrackedFaqItem'

interface FaqItem {
  q: string
  a: string
}

const FAQ: FaqItem[] = [
  {
    q: 'Сколько стоит Sporteo?',
    a: 'Сейчас платформа в режиме закрытой беты — доступ бесплатный. Тарифы для команд и клубов сейчас в разработке. Если хотите подключить клуб — напишите нам, обсудим условия индивидуально.',
  },
  {
    q: 'Как быстро можно подключить клуб?',
    a: 'Базовая настройка — 10 минут (создать организацию, добавить тренеров и атлетов). Полное наполнение карточек атлетов и переход с Excel/чатов обычно занимает 1-2 недели работы по графику.',
  },
  // W16 Day 82 — anti-positioning objection (matches AntiPositioning section)
  {
    q: 'Чем вы отличаетесь от Bitrix24 и AmoCRM?',
    a: 'Bitrix24 и AmoCRM построены для sales-воронок: лиды, сделки, KPI менеджера. В Sporteo роли pre-built под спортивную организацию (Owner / Coach / Doctor / Athlete), защита данных на уровне базы (RLS), плюс встроенные сущности под спорт: тренировочные планы, athlete passes, рекомендации врача, ACWR. Bitrix24 — конструктор для продаж. Sporteo — готовая система для спорта.',
  },
  // W16 Day 82 — solo-coach objection («у меня нет команды»)
  {
    q: 'А если у меня нет тренеров на платформе — есть смысл?',
    a: 'Да, но не сразу. Если вы один тренер с 5-10 атлетами — функционал работает, но половина value (мульти-ролевая координация, контроль организации) спит. Имеет смысл если: 1) планируете добавить врача в свой процесс, 2) растёте к группе тренеров в следующие 3-6 месяцев, 3) хотите профессиональный workflow для презентации спонсорам / родителям. Если ничего из этого — попробуйте бесплатные AI-инструменты на /tools/, без регистрации.',
  },
  {
    q: 'Какие данные собирает Sporteo?',
    a: 'Только то, что вы вводите в карточки атлетов: тренировки, самочувствие, медицинские заметки, отзывы тренеров. Никакие данные не передаются третьим сторонам. Хостинг — Supabase в EU-Central-1 (Frankfurt), шифрование at-rest и в transit.',
  },
  {
    q: 'Что если родитель не хочет видеть лишнего?',
    a: 'Родитель видит только данные своего ребёнка по default — это архитектура платформы, не настройка. Что именно родитель видит (расписание, медданные, частные заметки) настраивается тренером в карточке атлета.',
  },
  {
    q: 'Можно ли использовать без врача?',
    a: 'Да. Роль врача опциональна. Если в клубе нет врача — медицинские поля просто остаются пустыми. Когда врач появится, ему можно дать доступ ретроактивно.',
  },
  {
    q: 'Какие носимые устройства поддерживаются?',
    a: 'Сейчас работает ручной импорт CSV. OAuth-интеграции с трекерами в работе — конкретный список устройств зависит от тарифа клуба и доступности vendor API. Мы не обещаем поддержку конкретных моделей до того, как это реально работает.',
  },
  {
    q: 'Можно ли экспортировать данные?',
    a: 'Да. Health Snapshot и индивидуальные отчёты экспортируются в PDF из любой роли. CSV-экспорт данных тренировок — по запросу через поддержку. Vendor lock-in вам не нужен — данные всегда ваши.',
  },
  // W16 Day 82 — beta-data continuity objection («что если бета закроется?»)
  {
    q: 'Что будет с моими данными после выхода из закрытой беты?',
    a: 'Все клубы, подключенные в закрытой бете, остаются на платформе с сохранением всех данных. После launch вы выбираете тариф (или остаётесь на специальных условиях beta-cohort — для первых 20 клубов). Если решите уйти — экспорт данных в CSV/PDF доступен на любом этапе, без vendor lock-in. Если Sporteo как продукт закроется (маловероятно, но честно говорю что не невозможно) — за 60 дней до shutdown даём полный экспорт + рекомендации по альтернативам.',
  },
]

export default function FaqSection() {
  return (
    <section className="w-full bg-slate-50 py-20 px-4 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="max-w-3xl">
          <p className="text-2xs font-bold uppercase tracking-[0.24em] text-orange-700">
            Часто задают
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-navy-500 sm:text-4xl">
            Вопросы перед подключением клуба
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            Если ваш вопрос не закрыт — напишите нам через форму обратной связи на странице регистрации.
          </p>
        </div>

        {/* Accordion — native details wrapped для analytics, zero-JS a11y preserved */}
        <div className="mt-10 space-y-3">
          {FAQ.map((item, idx) => (
            <TrackedFaqItem
              key={item.q}
              question={item.q}
              className="group rounded-2xl border border-border bg-white p-5 shadow-sm transition-all open:shadow-md"
            >
              <summary className="flex cursor-pointer items-start justify-between gap-3 list-none">
                <h3 className="text-base font-bold leading-tight text-navy-500">
                  <span className="mr-2 text-orange-600 font-normal">{String(idx + 1).padStart(2, '0')}.</span>
                  {item.q}
                </h3>
                <span
                  aria-hidden
                  className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-50 text-sm font-bold text-orange-600 transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
            </TrackedFaqItem>
          ))}
        </div>
      </div>
    </section>
  )
}
