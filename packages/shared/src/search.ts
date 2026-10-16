const TURKISH_FOLD: Record<string, string> = { ı: 'i', ş: 's', ğ: 'g', ü: 'u', ö: 'o', ç: 'c' };

/**
 * Folds text for accent- and case-insensitive search: "İnce Memed", "ince memed" and "INCE MEMED"
 * all become "ince memed". Used for the books.search_text column and for search queries.
 */
export function foldForSearch(text: string): string {
  return text
    .toLocaleLowerCase('tr')
    .replace(/[ışğüöç]/g, (ch) => TURKISH_FOLD[ch] ?? ch)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
    .trim();
}

/** URL-safe slug that keeps Turkish words readable: "Kürk Mantolu Madonna" → "kurk-mantolu-madonna". */
export function slugify(text: string): string {
  return foldForSearch(text).replace(/\s+/g, '-').slice(0, 80).replace(/-+$/, '');
}
