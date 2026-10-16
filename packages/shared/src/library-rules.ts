/** Defaults for the LibrarySettings row; the librarian can change them in the admin panel. */
export const DEFAULT_LIBRARY_RULES = {
  loanDays: 14,
  maxActiveLoans: 5,
  maxRenewals: 1,
  pickupWindowHours: 48,
  finePerDay: 2.5,
  fineBlockThreshold: 50,
} as const;
