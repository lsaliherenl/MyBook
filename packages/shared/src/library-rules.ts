/** Defaults for the LibrarySettings row; the librarian can change them in the admin panel. */
export const DEFAULT_LIBRARY_RULES = {
  loanDays: 14,
  maxActiveLoans: 5,
  maxRenewals: 1,
  pickupWindowHours: 48,
  finePerDay: 2.5,
  fineBlockThreshold: 50,
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;
/** Istanbul has stayed on UTC+3 all year since 2016, so a fixed offset finds local weekdays. */
const LIBRARY_UTC_OFFSET_MS = 3 * 60 * 60 * 1000;

/**
 * When a loan made (or renewed) at `from` falls due: `loanDays` later, or the Monday after at the
 * same clock time when that lands on a Sunday, when the library is closed. The API stores this and
 * the circulation desk previews it, so both use this one helper.
 */
export function dueDate(from: Date, loanDays: number): Date {
  const due = from.getTime() + loanDays * DAY_MS;
  const isSunday = new Date(due + LIBRARY_UTC_OFFSET_MS).getUTCDay() === 0;
  return new Date(isSunday ? due + DAY_MS : due);
}
