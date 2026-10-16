/** Pure circulation rules — no database, easy to unit test. */

const DAY_MS = 24 * 60 * 60 * 1000;

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
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
