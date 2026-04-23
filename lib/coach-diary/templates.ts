import type {
  DiaryEntryType, RiskLevel, DiaryCategory,
  SessionData, CompetitionData, ScheduleData,
} from '@/services/coach-diary.service'

/**
 * Готовые шаблоны записей. При выборе шаблон префилит поля в форме.
 * Автор может изменить всё перед сохранением.
 */

export interface DiaryTemplate {
  id: string
  name: string
  icon: string
  description: string
  entry_type: DiaryEntryType
  title?: string
  note?: string
  tags?: string[]
  risk_level?: RiskLevel
  category?: DiaryCategory
  session_data?: SessionData
  competition_data?: CompetitionData
  schedule_data?: ScheduleData
}

export const DIARY_TEMPLATES: DiaryTemplate[] = [
  {
    id: 'base-run',
    name: 'Базовая тренировка — бег',
    icon: 'ki-abstract-26',
    description: 'Восстановительный / базовый бег, пульс 2 зона',
    entry_type: 'session_summary',
    title: 'Базовый бег',
    note: 'Километраж: …\nСредний пульс: …\nСамочувствие: …\nТехника: …\nЧто заметил тренер: …',
    tags: ['база', 'аэробная'],
    category: 'performance',
    session_data: {
      intensity: 'low',
      load_score: 3,
      key_metrics: 'Дистанция: ___ км\nТемп: ___\nСр. пульс: ___\nКаденс: ___',
    },
  },
  {
    id: 'interval',
    name: 'Интервальная тренировка',
    icon: 'ki-flash-circle',
    description: 'VO2max / лактат, высокий темп',
    entry_type: 'session_summary',
    title: 'Интервалы',
    note: 'Сет: …\nТемп по интервалам: …\nВосстановление: …\nКомментарий: …',
    tags: ['интервалы', 'vo2max'],
    category: 'performance',
    session_data: {
      intensity: 'high',
      load_score: 8,
      key_metrics: 'Сет: ___ × ___м @ ___\nВосст.: ___\nСр. пульс: ___\nЛактат (если есть): ___',
    },
  },
  {
    id: 'cross',
    name: 'Кросс / длительная',
    icon: 'ki-geolocation',
    description: 'Длительная аэробная работа 60+ мин',
    entry_type: 'session_summary',
    title: 'Длительная',
    note: 'Маршрут: …\nСамочувствие на финише: …\nПитьё/питание: …\nЧто нужно учесть: …',
    tags: ['длительная', 'объём'],
    category: 'performance',
    session_data: {
      intensity: 'moderate',
      load_score: 6,
      key_metrics: 'Дистанция: ___ км\nВремя: ___\nСр. пульс: ___\nТемп на финише: ___',
    },
  },
  {
    id: 'strength',
    name: 'Силовая тренировка',
    icon: 'ki-abstract-45',
    description: 'Приседы / тяги / жим',
    entry_type: 'session_summary',
    title: 'Силовая',
    note: 'Упражнения: …\nТехника: …\nПрогресс весов: …\nВосстановление между подходами: …',
    tags: ['сила'],
    category: 'technique',
    session_data: {
      intensity: 'high',
      load_score: 7,
      key_metrics: 'Присед: ___ × ___ кг\nТяга: ___ × ___ кг\nЖим: ___ × ___ кг',
    },
  },
  {
    id: 'competition',
    name: 'Отчёт о соревновании',
    icon: 'ki-medal-star',
    description: 'Стартовый протокол + разбор',
    entry_type: 'competition_report',
    title: 'Соревнование',
    note: 'Разминка: …\nТактика на дистанции: …\nЧто получилось: …\nЧто не получилось: …\nВыводы и план корректировки: …',
    tags: ['соревнование'],
    category: 'performance',
    competition_data: {
      event_name: '',
      result: '',
      placement: '',
    },
  },
  {
    id: 'state-check',
    name: 'Проверка состояния атлета',
    icon: 'ki-heart-circle',
    description: 'Самочувствие, восстановление, нагрузка',
    entry_type: 'observation',
    title: 'Состояние',
    note: 'Настрой: …\nСон: …\nАппетит: …\nБоли / дискомфорт: …\nГотовность к нагрузке: …',
    tags: ['состояние', 'recovery'],
    category: 'health',
    risk_level: 'low',
  },
  {
    id: 'injury-watch',
    name: 'Наблюдение за травмой',
    icon: 'ki-health',
    description: 'Отслеживание восстановления после травмы',
    entry_type: 'observation',
    title: 'Наблюдение за травмой',
    note: 'Локализация: …\nБолевой синдром (0–10): …\nОграничения в движении: …\nПланируемая нагрузка: …\nКонсультация с врачом: …',
    tags: ['травма', 'rehab'],
    category: 'health',
    risk_level: 'high',
  },
  {
    id: 'planned-session',
    name: 'Запланировать занятие',
    icon: 'ki-calendar-tick',
    description: 'Создаёт запись расписания → попадает в календарь',
    entry_type: 'schedule',
    title: 'Занятие',
    note: 'Цели занятия: …\nКлючевые упражнения: …\nЧто взять с собой: …',
    tags: ['план'],
    schedule_data: {
      start_time: '18:00',
      duration_min: 90,
    },
  },
  {
    id: 'microcycle-plan',
    name: 'План микроцикла',
    icon: 'ki-compass',
    description: 'Недельный / двухнедельный план',
    entry_type: 'plan',
    title: 'План на неделю',
    note: 'Понедельник: …\nВторник: …\nСреда: …\nЧетверг: …\nПятница: …\nСуббота: …\nВоскресенье: …\n\nАкцент недели: …',
    tags: ['микроцикл'],
  },
]
