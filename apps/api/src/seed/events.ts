import type { EventDetails, EventKind } from '@mybook/shared';
import type { PrismaService } from '../prisma/prisma.service.js';

interface SeedEvent {
  slug: string;
  kind: EventKind;
  titleTr: string;
  titleEn: string;
  descriptionTr: string;
  descriptionEn: string;
  locationTr: string;
  locationEn: string;
  /** Istanbul local time. */
  startsAt: string;
  endsAt?: string;
  capacity?: number;
  rsvpRequired?: boolean;
  /** Slug of the book to bring, if it is in the catalog. */
  bookSlug?: string;
  details?: EventDetails;
}

const t = (tr: string, en: string) => ({ tr, en });
const FREE_MEMBERS = { audience: t('Ücretsiz · yalnızca üyeler · Türkçe', 'Free · members only · in Turkish') };
const TO_READING_ROOM = t(
  'Doğu merdiveni ya da asansörle 2. kata çık, cam kapılardan sola dön. Basamaksız erişim var.',
  'East staircase or the lift to the 2nd floor, then left through the glass doors. Step-free access.',
);

const READING_ROOM = { locationTr: 'Okuma Salonu, 2. kat', locationEn: 'Reading Room, 2nd floor' };

/** Demo programme for autumn 2026; the same dates the design uses. */
export const SEED_EVENTS: SeedEvent[] = [
  {
    slug: 'finding-sources-for-your-thesis',
    kind: 'WORKSHOP',
    titleTr: 'Tezin için kaynak bulmak',
    titleEn: 'Finding sources for your thesis',
    descriptionTr: 'Veritabanlarında arama, atıf zincirini takip etme ve kaynakları düzenli tutma üzerine uygulamalı bir atölye.',
    descriptionEn: 'A hands-on workshop on searching databases, following citation trails and keeping your sources in order.',
    locationTr: 'Seminer Salonu B, 1. kat',
    locationEn: 'Seminar Room B, 1st floor',
    startsAt: '2026-10-20T14:00:00+03:00',
    endsAt: '2026-10-20T15:30:00+03:00',
    capacity: 20,
    details: {
      audience: t('Ücretsiz · lisansüstü öğrenciler öncelikli', 'Free · graduate students first'),
      host: { name: t('Kütüphane Araştırma Destek Ekibi', 'Library Research Support') },
      programme: [
        { time: '14:00', title: t('Veritabanlarında arama', 'Searching the databases') },
        { time: '14:45', title: t('Atıf zincirini takip etmek', 'Following citation trails') },
        { time: '15:15', title: t('Sorular', 'Questions') },
      ],
    },
  },
  {
    slug: 'how-search-engines-decide-what-you-read',
    kind: 'TALK',
    titleTr: 'Arama motorları ne okuyacağına nasıl karar veriyor?',
    titleEn: 'How search engines decide what you read',
    descriptionTr: 'Sıralama algoritmaları, filtre balonları ve kütüphane kataloğunun farkı üzerine bir söyleşi.',
    descriptionEn: 'A talk on ranking algorithms, filter bubbles and what makes a library catalogue different.',
    locationTr: 'Konferans Salonu, zemin kat',
    locationEn: 'Auditorium, ground floor',
    startsAt: '2026-10-28T18:30:00+03:00',
    rsvpRequired: false,
  },
  {
    slug: 'exam-weeks-open-until-midnight',
    kind: 'NOTICE',
    titleTr: 'Sınav haftaları: gece yarısına kadar açık',
    titleEn: 'Exam weeks: open until midnight',
    descriptionTr: 'Sınav haftaları boyunca kütüphane Pazar hariç her gün 08:00–00:00 arası açık. Gişe 23:45’te kapanır.',
    descriptionEn: 'During exam weeks the library is open 08:00–00:00 every day except Sunday. The desk closes at 23:45.',
    locationTr: 'Tüm kütüphane · gişe 23:45’te kapanır',
    locationEn: 'Whole library · desk closes 23:45',
    startsAt: '2026-11-02T08:00:00+03:00',
    endsAt: '2026-11-15T23:59:00+03:00',
    rsvpRequired: false,
  },
  {
    slug: 'reading-circle-tutunamayanlar',
    kind: 'BOOK_CLUB',
    titleTr: 'Okuma Halkası: Tutunamayanlar',
    titleEn: 'Reading Circle: Tutunamayanlar',
    descriptionTr:
      'Edebiyat Fakültesi’nin yürüttüğü yakın okuma, çay ve sohbet akşamı. Tüm üyelere açık — kitabı bitirmiş olman gerekmiyor.',
    descriptionEn:
      'An evening of close reading, tea and conversation, led by the Faculty of Letters. Open to every member — no need to have finished the book.',
    ...READING_ROOM,
    startsAt: '2026-11-12T19:00:00+03:00',
    endsAt: '2026-11-12T21:00:00+03:00',
    capacity: 40,
    bookSlug: 'tutunamayanlar',
    details: {
      ...FREE_MEMBERS,
      host: {
        name: t('Türk Edebiyatı Okuma Grubu', 'Turkish Literature Reading Group'),
        note: t('Edebiyat Fakültesi · her ayın ikinci Perşembesi buluşur', 'Faculty of Letters · meets on the second Thursday of every month'),
      },
      directions: TO_READING_ROOM,
      programme: [
        { time: '19:00', title: t('Karşılama ve çay', 'Welcome & tea'), note: t('Pencere kenarındaki uzun masalarda yerini al.', 'Find a seat at the long tables by the windows.') },
        { time: '19:15', title: t('Yakın okuma', 'Close reading'), note: t('Açılış bölümleri, kısa pasajlar hâlinde sesli okunur.', 'The opening chapters, read aloud in short passages.') },
        { time: '20:15', title: t('Açık sohbet', 'Open conversation'), note: t('Önce küçük gruplar, sonra hep birlikte.', 'Small groups, then everyone together.') },
        { time: '21:00', title: t('Kapanış', 'Close'), note: t('Ödünç almak istersen gişe 22:00’ye kadar açık.', "The desk stays open until 22:00 if you'd like to borrow.") },
      ],
    },
  },
  {
    slug: 'poetry-evening-turkish-poets-in-translation',
    kind: 'BOOK_CLUB',
    titleTr: 'Şiir akşamı: Çeviride Türk şairleri',
    titleEn: 'Poetry evening: Turkish poets in translation',
    descriptionTr: 'Nâzım Hikmet’ten Lale Müldür’e, aynı şiiri iki dilde okuyoruz.',
    descriptionEn: 'From Nâzım Hikmet to Lale Müldür — reading the same poem in two languages.',
    ...READING_ROOM,
    startsAt: '2026-11-20T19:30:00+03:00',
    capacity: 30,
    details: { ...FREE_MEMBERS, directions: TO_READING_ROOM },
  },
  {
    slug: 'book-swap-and-tea',
    kind: 'WORKSHOP',
    titleTr: 'Kitap takası ve çay',
    titleEn: 'Book swap & tea',
    descriptionTr: 'Okuduğun bir kitabı getir, başka birini götür. Çay bizden.',
    descriptionEn: 'Bring a book you have read, take another home. Tea is on us.',
    locationTr: 'Zemin kat fuayesi',
    locationEn: 'Ground floor foyer',
    startsAt: '2026-12-05T11:00:00+03:00',
    endsAt: '2026-12-05T13:00:00+03:00',
    rsvpRequired: false,
  },
  {
    slug: 'open-access-where-to-find-free-journals',
    kind: 'TALK',
    titleTr: 'Açık erişim: ücretsiz dergiler nerede?',
    titleEn: 'Open access: where to find free journals',
    descriptionTr: 'Sunum ve okuma listesi kütüphane sitesinde.',
    descriptionEn: 'Slides and reading list are on the library site.',
    locationTr: 'Konferans Salonu, zemin kat',
    locationEn: 'Auditorium, ground floor',
    startsAt: '2026-10-08T17:00:00+03:00',
    rsvpRequired: false,
  },
  {
    slug: 'reading-circle-kurk-mantolu-madonna',
    kind: 'BOOK_CLUB',
    titleTr: 'Okuma Halkası: Kürk Mantolu Madonna',
    titleEn: 'Reading Circle: Kürk Mantolu Madonna',
    descriptionTr: '38 okur katıldı.',
    descriptionEn: '38 readers came.',
    ...READING_ROOM,
    startsAt: '2026-10-01T19:00:00+03:00',
    capacity: 40,
    bookSlug: 'kurk-mantolu-madonna',
  },
  {
    slug: 'citation-managers-in-45-minutes',
    kind: 'WORKSHOP',
    titleTr: '45 dakikada kaynakça yöneticileri',
    titleEn: 'Citation managers in 45 minutes',
    descriptionTr: 'Kaydı kütüphanenin kanalında.',
    descriptionEn: 'The recording is on the library channel.',
    locationTr: 'Seminer Salonu B, 1. kat',
    locationEn: 'Seminar Room B, 1st floor',
    startsAt: '2026-09-24T14:00:00+03:00',
    capacity: 20,
  },
];

export async function seedEvents(prisma: PrismaService): Promise<void> {
  for (const e of SEED_EVENTS) {
    const book = e.bookSlug ? await prisma.book.findUnique({ where: { slug: e.bookSlug }, select: { id: true } }) : null;
    const data = {
      bookId: book?.id ?? null,
      details: e.details ?? {},
      kind: e.kind,
      titleTr: e.titleTr,
      titleEn: e.titleEn,
      descriptionTr: e.descriptionTr,
      descriptionEn: e.descriptionEn,
      locationTr: e.locationTr,
      locationEn: e.locationEn,
      startsAt: new Date(e.startsAt),
      endsAt: e.endsAt ? new Date(e.endsAt) : null,
      capacity: e.capacity ?? null,
      rsvpRequired: e.rsvpRequired ?? true,
      isPublished: true,
    };
    await prisma.event.upsert({ where: { slug: e.slug }, create: { slug: e.slug, ...data }, update: data });
  }
  console.log(`✓ ${SEED_EVENTS.length} events`);
}
