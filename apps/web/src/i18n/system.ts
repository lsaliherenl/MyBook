/**
 * Texts for the 404, 500, offline and status pages. Kept apart from the dictionaries because the
 * error page is a client component and should not pull every translation into the browser.
 */
export const SYSTEM_TEXT = {
  "tr": {
    "notFound": [
      "Hata 404",
      "Bu sayfa ödünç alınmış.",
      "Biri ödünç alıp hiç geri getirmemiş — ya da bağlantı yanlış yazılmış. Sana okuyacak başka bir şey bulalım."
    ],
    "serverError": [
      "Hata 500",
      "Birkaç şeyi yeniden rafa diziyoruz.",
      "Bizim tarafımızda bir sorun çıktı. Ödünç çantan, ödünçlerin ve rezervasyonların güvende. Lütfen bir dakika sonra tekrar dene."
    ],
    "offline": [
      "Bağlantı yok",
      "Sen çevrimdışısın — kitaplar değil.",
      "Şu an kataloğa ulaşamıyoruz. Daha önce açtığın teslim kartın ve kütüphane kartın internetsiz de görünür."
    ],
    "searchPlaceholder": "Onun yerine bir başlık ya da yazar ara",
    "search": "Ara",
    "home": "Ana sayfaya dön",
    "browse": "Kataloğa göz at",
    "report": "Bozuk bağlantıyı bildir",
    "tryAgain": "Tekrar dene",
    "status": "Hizmet durumu",
    "reference": "Referans: {ref}",
    "pass": "Teslim kartımı göster",
    "card": "Kütüphane kartı",
    "retry": "Yeniden dene",
    "deskHours": "Masa: Pzt–Cum 08:00–22:00 · Cmt 10:00–18:00",
    "statusTitle": "Site durumu",
    "statusIntro": "Kütüphane sistemlerinin şu anki durumu.",
    "statusOk": "Çalışıyor",
    "statusDown": "Ulaşılamıyor",
    "statusWeb": "Web sitesi",
    "statusApi": "Katalog ve ödünç servisi",
    "statusChecked": "Son kontrol {time}",
    "brand": "MY / BOOK",
    "tagline": "Kitap · Okur · Sükûnet",
    "nav": {
      "catalog": "Katalog",
      "collections": "Koleksiyonlar",
      "events": "Etkinlikler",
      "about": "Hakkında",
      "main": "Ana menü",
      "language": "Dil"
    },
    "copyright": "© 2026 MyBook Kütüphanesi"
  },
  "en": {
    "notFound": [
      "Error 404",
      "This page has been checked out.",
      "Someone borrowed it and never brought it back — or the link was mistyped. Let’s find you something else to read."
    ],
    "serverError": [
      "Error 500",
      "We’re re-shelving a few things.",
      "Something went wrong on our side. Your borrow bag, loans and reservations are safe. Please try again in a minute."
    ],
    "offline": [
      "No connection",
      "You’re offline — the books aren’t.",
      "We can’t reach the catalog right now. Your pickup pass and library card still open without internet if you viewed them before."
    ],
    "searchPlaceholder": "Search for a title or author instead",
    "search": "Search",
    "home": "Back to home",
    "browse": "Browse the catalog",
    "report": "Report a broken link",
    "tryAgain": "Try again",
    "status": "Service status",
    "reference": "Reference: {ref}",
    "pass": "Show my pickup pass",
    "card": "Library card",
    "retry": "Retry",
    "deskHours": "Desk: Mon–Fri 08:00–22:00 · Sat 10:00–18:00",
    "statusTitle": "Site status",
    "statusIntro": "How the library's systems are doing right now.",
    "statusOk": "Operational",
    "statusDown": "Unavailable",
    "statusWeb": "Website",
    "statusApi": "Catalog & lending service",
    "statusChecked": "Checked at {time}",
    "brand": "MY / BOOK",
    "tagline": "Books · People · Quiet hours",
    "nav": {
      "catalog": "Catalog",
      "collections": "Collections",
      "events": "Events",
      "about": "About",
      "main": "Main",
      "language": "Language"
    },
    "copyright": "© 2026 MyBook Library"
  }
} as const;

export type SystemText = (typeof SYSTEM_TEXT)["tr"];
