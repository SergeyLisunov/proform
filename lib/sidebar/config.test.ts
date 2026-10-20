import { describe, expect, it } from 'vitest'
import { filterSidebarForRole, SIDEBAR_CONFIG, type GlobalRole, type EffectiveRole } from './config'

/**
 * Регрессия: клубная роль не должна отнимать пункты глобальной.
 *
 * Дефект. useEffectiveRole выбирает роль как `scopedOrgRole ?? globalRole`,
 * а фильтр для org_admin сопоставлял только ['org_admin', 'organization'].
 * Тренер, которого владелец клуба назначил админом, терял из меню «Мои
 * атлеты», «Планы тренировок», «Шаблоны», «Циклы» и «Дневник тренера»;
 * врач — «Допуски», «Травмы» и своих пациентов. Главная при этом
 * продолжала показывать тренерскую панель (она ветвится по users.role), то
 * есть меню и главная противоречили друг другу.
 */
function ids(role: EffectiveRole | undefined, globalRole: GlobalRole | undefined): string[] {
  return filterSidebarForRole({ role, globalRole, childCount: 0 })
    .flatMap(s => s.items.map(i => i.id))
}

describe('смешанная роль: глобальная + клубная', () => {
  it('тренер, назначенный админом клуба, сохраняет тренерские разделы', () => {
    const v = ids('org_admin', 'coach')
    expect(v).toContain('coach.athletes')
    expect(v).toContain('coach.plans')
    expect(v).toContain('training.diary_coach')
    // и получает клубные
    expect(v).toContain('club.dashboard')
    expect(v).toContain('club.members')
  })

  it('врач, назначенный админом клуба, сохраняет медицинские разделы', () => {
    const v = ids('org_admin', 'doctor')
    expect(v).toContain('medical.clearances')
    expect(v).toContain('medical.injuries')
    expect(v).toContain('club.dashboard')
  })

  it('спортсмен-админ клуба видит и свой дневник, и клуб', () => {
    const v = ids('org_admin', 'athlete')
    expect(v).toContain('training.diary_athlete')
    expect(v).toContain('club.dashboard')
  })
})

describe('чистые роли не изменились', () => {
  it('владелец клуба видит клуб и не видит тренерских разделов', () => {
    const v = ids('org_owner', 'organization')
    expect(v).toContain('club.dashboard')
    expect(v).not.toContain('coach.athletes')
  })

  it('тренер без клуба не видит клубных разделов', () => {
    const v = ids('coach', 'coach')
    expect(v).toContain('coach.athletes')
    expect(v).not.toContain('club.dashboard')
  })

  it('роль ещё не загружена — ролевых пунктов нет', () => {
    const v = ids(undefined, undefined)
    expect(v).not.toContain('coach.athletes')
    expect(v).not.toContain('club.dashboard')
  })
})

describe('совпадающий адрес: какая подпись остаётся', () => {
  // /calendar есть и у тренера («Календарь»), и у клуба («Расписание
  // клуба»). Страница ветвится по ГЛОБАЛЬНОЙ роли: тренеру-админу она
  // покажет тренерский календарь. Подпись «Расписание клуба» обманула бы.
  it('тренеру-админу остаётся «Календарь», а не «Расписание клуба»', () => {
    const v = ids('org_admin', 'coach')
    expect(v).toContain('training.calendar')
    expect(v).not.toContain('club.schedule')
  })

  it('владельцу клуба остаётся «Расписание клуба»', () => {
    const v = ids('org_owner', 'organization')
    expect(v).toContain('club.schedule')
  })
})

describe('специалист', () => {
  // Меню специалиста — только разделы, которые у него уже работают. Пункт,
  // ведущий на «Доступ ограничен» или в медицинский раздел врача, хуже, чем
  // отсутствие пункта.
  const SPECIALIST_ITEMS = ['global.dashboard', 'specialist.messages', 'specialist.notes', 'network.contacts']

  it('видит ровно свой набор пунктов', () => {
    expect(ids('specialist', 'specialist')).toEqual(SPECIALIST_ITEMS)
  })

  it('платный тариф не добавляет пунктов', () => {
    const v = filterSidebarForRole({ role: 'specialist', globalRole: 'specialist', childCount: 0, plan: 'pro' })
      .flatMap(s => s.items.map(i => i.id))
    expect(v).toEqual(SPECIALIST_ITEMS)
  })

  it('мобильная панель: «Сообщения» среди вкладок', () => {
    // MobileBottomNav берёт первый пункт каждой секции — порядок в конфиге
    // и решает, что попадёт в нижнюю панель телефона.
    const tabs = filterSidebarForRole({ role: 'specialist', globalRole: 'specialist', childCount: 0 })
      .flatMap(s => (s.items[0] ? [s.items[0].id] : []))
    expect(tabs).toEqual(['global.dashboard', 'specialist.messages', 'network.contacts'])
  })

  it('не видит ни одного пункта, предназначенного только врачу', () => {
    const doctorOnly = SIDEBAR_CONFIG
      .flatMap(s => s.items)
      .filter(i => i.roles?.length === 1 && i.roles[0] === 'doctor')
      .map(i => i.id)
    expect(doctorOnly.length).toBeGreaterThan(0)
    const v = ids('specialist', 'specialist')
    for (const id of doctorOnly) expect(v, id).not.toContain(id)
  })

  it('не получает разделов, которые для него не работают', () => {
    // /athletes — «Доступ ограничен», /analytics — аналитика спортсмена,
    // /calendar — календарь тренировок, остальное — разделы врача.
    const hrefs = filterSidebarForRole({ role: 'specialist', globalRole: 'specialist', childCount: 0 })
      .flatMap(s => s.items.map(i => i.href))
    for (const href of ['/athletes', '/analytics', '/calendar', '/doctor/clearances', '/injuries']) {
      expect(hrefs, href).not.toContain(href)
    }
  })

  it('у остальных ролей «Сообщения» и «Заметки» остались на месте', () => {
    expect(ids('coach', 'coach')).toEqual(expect.arrayContaining(['training.messages', 'training.notes']))
    expect(ids('doctor', 'doctor')).toEqual(expect.arrayContaining(['training.messages', 'training.notes']))
    expect(ids('athlete', 'athlete')).toContain('training.messages')
    for (const role of ['athlete', 'coach', 'doctor'] as const) {
      expect(ids(role, role).filter(id => id.startsWith('specialist.')), role).toEqual([])
    }
  })
})

describe('меню без повторов', () => {
  // Смешанная роль собирает пункты двух ролей; один и тот же адрес не должен
  // появиться в меню дважды под разными подписями.
  for (const [role, globalRole] of [
    ['org_admin', 'coach'], ['org_admin', 'doctor'], ['org_admin', 'athlete'],
    ['org_owner', 'organization'], ['coach', 'coach'], ['doctor', 'doctor'],
    ['specialist', 'specialist'],
  ] as const) {
    it(`${globalRole} + ${role}: каждый href встречается один раз`, () => {
      const hrefs = filterSidebarForRole({ role, globalRole, childCount: 0 })
        .flatMap(s => s.items.map(i => i.href))
      const dup = hrefs.filter((h, i) => hrefs.indexOf(h) !== i)
      expect(dup, `повторы: ${dup.join(', ')}`).toEqual([])
    })
  }
})
