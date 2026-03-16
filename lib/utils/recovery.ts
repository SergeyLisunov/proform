export function recoveryColor(v: number): string {
  return v >= 67 ? '#16A34A' : v >= 34 ? '#F97316' : '#DC2626'
}
export function recoveryLabel(v: number): string {
  return v >= 67 ? 'Ready to train' : v >= 34 ? 'Moderate effort' : 'Take it easy'
}
export function strainColor(v: number): string {
  return v >= 14 ? '#DC2626' : v >= 10 ? '#F97316' : '#2563EB'
}
export function strainLabel(v: number): string {
  return v >= 18 ? 'All Out' : v >= 14 ? 'Strenuous' : v >= 10 ? 'Moderate' : v >= 6 ? 'Light' : 'Easy'
}
export function initials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}
export function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
