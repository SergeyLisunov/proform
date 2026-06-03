export function recoveryColor(v: number): string {
  return v >= 67 ? '#16A34A' : v >= 34 ? '#F35703' : '#DC2626'
}
export function recoveryLabel(v: number): string {
  return v >= 67 ? 'Готов к тренировке' : v >= 34 ? 'Умеренное усилие' : 'Лучше сбавить'
}
export function strainColor(v: number): string {
  return v >= 14 ? '#DC2626' : v >= 10 ? '#F35703' : '#2563EB'
}
export function strainLabel(v: number): string {
  return v >= 18 ? 'Предел' : v >= 14 ? 'Тяжело' : v >= 10 ? 'Умеренно' : v >= 6 ? 'Легко' : 'Очень легко'
}
export function initials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}
export function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
}
