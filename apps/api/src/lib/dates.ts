/** All period boundaries are computed in UTC to keep the server stateless and predictable. */

export function startOfUtcDay(date: Date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function endOfUtcDay(date: Date = new Date()): Date {
  const start = startOfUtcDay(date);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

/** ISO week (Monday start), returned as the Monday 00:00 UTC of the given date's week. */
export function startOfUtcWeek(date: Date = new Date()): Date {
  const start = startOfUtcDay(date);
  const day = start.getUTCDay(); // 0 = Sunday
  const diffToMonday = day === 0 ? 6 : day - 1;
  return new Date(start.getTime() - diffToMonday * 24 * 60 * 60 * 1000);
}

export function endOfUtcWeek(date: Date = new Date()): Date {
  const start = startOfUtcWeek(date);
  return new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
}

/** Stable per-day key, e.g. "2026-09-17", used to scope daily task completion. */
export function dailyPeriodKey(date: Date = new Date()): string {
  return startOfUtcDay(date).toISOString().slice(0, 10);
}

export function msUntilNextUtcMidnight(date: Date = new Date()): number {
  return endOfUtcDay(date).getTime() - date.getTime();
}
