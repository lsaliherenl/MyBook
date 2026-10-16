import { foldForSearch } from '@mybook/shared';

/** "Kürk Mantolu Madonna" matches "Kurk mantolu madonna (Ciltli)"; a different book does not. */
export function titlesMatch(a: string, b: string): boolean {
  const fa = foldForSearch(a);
  const fb = foldForSearch(b);
  if (!fa || !fb) return false;
  return fa === fb || fa.startsWith(`${fb} `) || fb.startsWith(`${fa} `);
}

const NAME_SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii']);

/** True when the two author lists share a surname ("Oğuz Atay" / "Oguz Atay", "Brooks Jr." / "Brooks"). */
export function authorsOverlap(a: string[], b: string[]): boolean {
  const surname = (name: string) =>
    foldForSearch(name)
      .split(' ')
      .filter((t) => !NAME_SUFFIXES.has(t))
      .pop();
  const surnames = (names: string[]) => new Set(names.map(surname).filter(Boolean));
  const sa = surnames(a);
  return [...surnames(b)].some((s) => sa.has(s));
}

export function isbn10To13(isbn10: string): string {
  const core = `978${isbn10.slice(0, 9)}`;
  const sum = core.split('').reduce((acc, d, i) => acc + Number(d) * (i % 2 === 0 ? 1 : 3), 0);
  return core + ((10 - (sum % 10)) % 10);
}
