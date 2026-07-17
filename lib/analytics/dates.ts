/**
 * Хелперы дат для движка аналитики. Все даты — ISO-строки (YYYY-MM-DD) в UTC,
 * как хранятся `date`-колонки в Supabase (event_date, wellness_checkins.date).
 */

export function parseDateOnly(value: string): Date {
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
}

export function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(value: string, days: number): string {
  const date = parseDateOnly(value);
  date.setUTCDate(date.getUTCDate() + days);
  return toDateOnly(date);
}

export function daysBetween(start: string, end: string): number {
  return Math.round(
    (parseDateOnly(end).getTime() - parseDateOnly(start).getTime()) / 86_400_000,
  );
}

export function listDatesInclusive(start: string, end: string): string[] {
  const total = daysBetween(start, end);
  const dates: string[] = [];
  for (let offset = 0; offset <= total; offset += 1) {
    dates.push(addDays(start, offset));
  }
  return dates;
}
