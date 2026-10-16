import type { BookProvider, ExternalBookCandidate } from '@mybook/shared';

/**
 * One external book metadata source. Each implementation maps the provider's own format
 * to ExternalBookCandidate; ImportService combines them.
 */
export interface BookMetadataProvider {
  readonly id: BookProvider;
  /** Time budget for one call, including retries. */
  readonly timeoutMs: number;
  search(query: string, limit: number): Promise<ExternalBookCandidate[]>;
  findByIsbn(isbn: string): Promise<ExternalBookCandidate[]>;
}

export const BOOK_PROVIDERS_TOKEN = Symbol('BOOK_PROVIDERS');

export function stripHtml(text: string | null | undefined): string | null {
  if (!text) return null;
  const plain = text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return plain || null;
}

export function yearFrom(date: string | number | null | undefined): number | null {
  const match = String(date ?? '').match(/\d{4}/);
  return match ? Number(match[0]) : null;
}
