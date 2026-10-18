import { describe, expect, it } from 'vitest'
import { filterSidebarForRole, type GlobalRole, type EffectiveRole } from './config'

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

describe('меню без повторов', () => {
  // Смешанная роль собирает пункты двух ролей; один и тот же адрес не должен
  // появиться в меню дважды под разными подписями.
  for (const [role, globalRole] of [
    ['org_admin', 'coach'], ['org_admin', 'doctor'], ['org_admin', 'athlete'],
    ['org_owner', 'organization'], ['coach', 'coach'], ['doctor', 'doctor'],
  ] as const) {
    it(`${globalRole} + ${role}: каждый href встречается один раз`, () => {
      const hrefs = filterSidebarForRole({ role, globalRole, childCount: 0 })
        .flatMap(s => s.items.map(i => i.href))
      const dup = hrefs.filter((h, i) => hrefs.indexOf(h) !== i)
      expect(dup, `повторы: ${dup.join(', ')}`).toEqual([])
    })
  }
})
