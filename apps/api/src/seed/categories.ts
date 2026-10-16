/** Our bilingual category list. `shelf` is the shelf prefix used for demo copies (e.g. "TE-104"). */
export const SEED_CATEGORIES = [
  { slug: 'turkish-literature', nameTr: 'Türk Edebiyatı', nameEn: 'Turkish Literature', shelf: 'TE' },
  { slug: 'world-literature', nameTr: 'Dünya Edebiyatı', nameEn: 'World Literature', shelf: 'DE' },
  { slug: 'poetry', nameTr: 'Şiir', nameEn: 'Poetry', shelf: 'SI' },
  { slug: 'essays', nameTr: 'Deneme', nameEn: 'Essays', shelf: 'DN' },
  { slug: 'science-fiction-fantasy', nameTr: 'Bilimkurgu ve Fantastik', nameEn: 'Science Fiction & Fantasy', shelf: 'BF' },
  { slug: 'mystery-thriller', nameTr: 'Polisiye ve Gerilim', nameEn: 'Mystery & Thriller', shelf: 'PG' },
  { slug: 'history', nameTr: 'Tarih', nameEn: 'History', shelf: 'TA' },
  { slug: 'philosophy', nameTr: 'Felsefe', nameEn: 'Philosophy', shelf: 'FE' },
  { slug: 'psychology', nameTr: 'Psikoloji', nameEn: 'Psychology', shelf: 'PS' },
  { slug: 'science-nature', nameTr: 'Bilim ve Doğa', nameEn: 'Science & Nature', shelf: 'BD' },
  { slug: 'computer-science', nameTr: 'Bilgisayar Bilimleri', nameEn: 'Computer Science', shelf: 'BB' },
  { slug: 'mathematics', nameTr: 'Matematik', nameEn: 'Mathematics', shelf: 'MA' },
  { slug: 'economics-business', nameTr: 'Ekonomi ve İşletme', nameEn: 'Economics & Business', shelf: 'EI' },
  { slug: 'personal-growth', nameTr: 'Kişisel Gelişim', nameEn: 'Personal Growth', shelf: 'KG' },
  { slug: 'art-design', nameTr: 'Sanat ve Tasarım', nameEn: 'Art & Design', shelf: 'ST' },
  { slug: 'biography-memoir', nameTr: 'Biyografi ve Anı', nameEn: 'Biography & Memoir', shelf: 'BA' },
  { slug: 'children-young-adult', nameTr: 'Çocuk ve Gençlik', nameEn: 'Children & Young Adult', shelf: 'CG' },
] as const;

export type SeedCategorySlug = (typeof SEED_CATEGORIES)[number]['slug'];
