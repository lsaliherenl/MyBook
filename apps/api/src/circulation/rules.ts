/** Pure circulation rules — no database, easy to unit test. */

const DAY_MS = 24 * 60 * 60 * 1000;

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

/** Istanbul has stayed on UTC+3 all year since 2016, so a fixed offset finds local calendar days. */
const LIBRARY_UTC_OFFSET_MS = 3 * 60 * 60 * 1000;

/** The moment the library's calendar day containing `date` began. */
export function libraryDayStart(date: Date): Date {
  return new Date(Math.floor((date.getTime() + LIBRARY_UTC_OFFSET_MS) / DAY_MS) * DAY_MS - LIBRARY_UTC_OFFSET_MS);
}

/** The library's calendar date of `date`, as YYYY-MM-DD. */
export function libraryDate(date: Date): string {
  return new Date(date.getTime() + LIBRARY_UTC_OFFSET_MS).toISOString().slice(0, 10);
}

/** Monday 00:00 (library time) of the week containing `date`. */
export function libraryWeekStart(date: Date): Date {
  const today = libraryDayStart(date);
  const weekday = new Date(today.getTime() + LIBRARY_UTC_OFFSET_MS).getUTCDay() || 7;
  return addDays(today, 1 - weekday);
}

/**
 * When a held copy must be collected: `hours` after `from`, not counting Sundays, when the library
 * is closed. Every Sunday the window touches pushes the deadline back by a day.
 */
export function pickupDeadline(from: Date, hours: number): Date {
  let end = from.getTime() + hours * 60 * 60 * 1000;
  const firstLocalMidnight = Math.floor((from.getTime() + LIBRARY_UTC_OFFSET_MS) / DAY_MS) * DAY_MS - LIBRARY_UTC_OFFSET_MS;
  for (let day = firstLocalMidnight; day < end; day += DAY_MS) {
    if (new Date(day + LIBRARY_UTC_OFFSET_MS).getUTCDay() === 0) end += DAY_MS;
  }
  return new Date(end);
}

/** Started days past the due moment: one minute late counts as one day. */
export function daysOverdue(dueAt: Date, at: Date): number {
  const late = at.getTime() - dueAt.getTime();
  return late > 0 ? Math.ceil(late / DAY_MS) : 0;
}

/** Fine in lira, rounded to kuruş. */
export function overdueFine(days: number, finePerDay: number): number {
  return Math.round(days * finePerDay * 100) / 100;
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I

/** Short pickup code a member reads out or shows as a QR code, e.g. "MB-4K7Q". */
export function reservationCode(random: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < 4; i++) code += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
  return `MB-${code}`;
}

/** Copies in these states are part of the lending collection. */
export const CIRCULATING_STATUSES = ['AVAILABLE', 'ON_HOLD', 'ON_LOAN'] as const;
