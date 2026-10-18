# Claude Design Brifi — MyBook Kütüphane Sistemi

> **Kullanım:** Claude Design'a ilk mesajda bu brifin tamamını ve referans ana sayfa görselini (`reference-home.webp`) birlikte ver.
> Referans görsel başkasına ait olduğu için depoda yok.
> Sonra aşağıdaki **"Prompt sırası"** bölümündeki adımları tek tek iste. Hepsini tek seferde istemek kaliteyi düşürür.

---

## 0. Proje bağlamı

MyBook, bir **üniversite kütüphanesi** için web uygulaması. İki kullanıcı tipi var:

- **Üye (öğrenci/akademisyen):** kataloğu gezer, kitap arar, ödünç çantasına ekler, online **rezervasyon** yapar,
  kitabı gişeden teslim alır, ödünçlerini/cezalarını/geçmişini takip eder, etkinliklere kayıt olur.
- **Kütüphaneci (admin):** gişede rezervasyonu onaylayıp kitabı teslim eder, iadeyi alır, kitapları dış API'lerden
  (ISBN / arama / barkod) içe aktarır, stok ve kopyaları yönetir, gecikme raporlarını görür.

Ödünç akışı: **Rezervasyon (online) → Teslim almaya hazır → Gişede teslim (kütüphaneci onayı) → Ödünçte → İade.**

Ürün iki dilli olacak (**Türkçe / İngilizce**). Tasarımları **İngilizce** metinle çiz, ama her ekran Türkçe
metinle de kırılmadan çalışmalı (Türkçe metinler ~%20–30 daha uzun; "Teslim almaya hazır" gibi).

---

## 1. Görsel dil — referans görselin aynısı

Ekteki `reference-home.webp` **bağlayıcı referanstır**. Hedef "benzer bir şey" değil, **aynı görsel dil**:
sıcak, edebi, dergi (editorial) hissi veren, sakin ve lüks bir kitapçı estetiği. Bu dili kütüphane işlevlerine taşı.

### Referanstan birebir alınacaklar
- **Header:** krem zemin; solda geniş harf aralıklı (letter-spaced) serif büyük harf **wordmark**
  (referanstaki `PAPER / ROOM` gibi; bizde **`MY / BOOK`**), altında çok küçük, geniş aralıklı büyük harf
  slogan (ör. `BOOKS · PEOPLE · QUIET HOURS` / `KİTAPLAR · İNSANLAR · SESSİZ SAATLER`). Marka adı yazı içinde "MyBook".
  Ortada/sağda sade nav linkleri (sans-serif, küçük). Sağda ince çizgili arama ve çanta ikonları.
- **Hero:** tam genişlik, sıcak **altın saat ışığı** fotoğrafı; koyu **mürdüm/patlıcan** duvar, ahşap masa,
  üst üste kitaplar, seramik kupa, çiçek. Solda çok büyük, ince, yüksek kontrastlı **serif başlık** (krem renk,
  3 satır), altında küçük serif alt başlık, altında **krem zeminli köşeli buton** ("EXPLORE BOOKS →",
  küçük harf aralıklı büyük harf).
- **Bölüm başlıkları:** büyük serif ("Curated for curious readers"), sağda küçük büyük-harf link ("VIEW ALL →").
- **Kitap kartları:** sadece kapak (yumuşak, gerçekçi gölge, köşesiz) + altında serif kitap adı, sans yazar adı,
  en altta küçük, geniş aralıklı büyük harf kategori etiketi ("FICTION"). Kart kutusu/çerçeve **yok**.
- **Etkinlik bandı:** ikiye bölünmüş; solda kütüphane iç mekan fotoğrafı (ahşap raflar, masa, bitki, pencere ışığı),
  sağda düz mürdüm panel: üstte küçük "UPCOMING EVENT" etiketi, serif başlık, kısa metin, tarih satırı
  (büyük harf, ince ayraç noktası), krem "RSVP →" butonu.
- **Genel:** bol boşluk, sakin ritim, köşeler keskin veya çok az yuvarlak (0–2px), parlak renk yok, gradient yok,
  glassmorphism yok, "SaaS dashboard" görünümü yok.

### Renk paleti (referanstan tahmini — rafine edebilirsin)
| Token | Değer (yaklaşık) | Kullanım |
|---|---|---|
| `paper` | `#F1EAE0` | ana zemin (krem) |
| `paper-2` | `#E8DED1` | ikincil yüzey, hover, ayraç alanları |
| `plum-900` | `#2E1424` | en koyu mürdüm, metin üstü koyu bloklar |
| `plum-700` | `#4A2238` | etkinlik paneli, birincil koyu yüzey |
| `plum-500` | `#6E3B57` | vurgu, aktif durum |
| `ink` | `#231A1F` | ana metin |
| `ink-muted` | `#6B5D63` | ikincil metin |
| `line` | `#D6CABB` | ince çizgiler, input kenarları |
| `gold` | `#B88A4A` | çok az kullanılan sıcak vurgu (ikon, rozet detayı) |

Durum renkleri de **aynı sıcak, soluk tonlarda** olmalı (doygun yeşil/kırmızı değil):
Available (adaçayı yeşili), Reserved / Ready for pickup (amber/altın), On loan (mürdüm), Overdue (kiremit kırmızısı),
Expired / Cancelled (gri).

### Tipografi
- **Display / başlıklar:** ince, yüksek kontrastlı editoryal serif (referanstaki gibi). Ücretsiz ve **Türkçe
  karakter (ğ ş ı İ ç ö ü) destekli** bir Google Font seç — öneri: *Cormorant Garamond*, *Fraunces* veya *Newsreader*.
- **Metin / UI:** sade, hafif geometrik sans — öneri: *Inter*, *Jost* veya *Manrope*.
- **Etiketler:** sans, 11–12px, büyük harf, `letter-spacing: 0.14–0.2em` ("FICTION", "UPCOMING EVENT", buton metinleri).
- Türkçe büyük harf dönüşümüne dikkat: "i" → "İ" (CSS `text-transform: uppercase` + `lang="tr"`).

### İkonlar ve görseller
- İnce çizgi ikon seti (Lucide, stroke 1.5).
- Kitap kapakları gerçek veriden (API) gelecek: kapak görsellerini **yer tutucu** olarak tasarla, her oranda
  (2:3 ağırlıklı, bazıları kare veya geniş) düzgün dursun; kapak yoksa şık bir **tipografik yedek kapak** tasarla
  (mürdüm/krem zeminde serif başlık + yazar).
- Hero ve etkinlik fotoğrafları referanstaki atmosferde olsun (sıcak ışık, mürdüm, ahşap, kitap).

---

## 2. Design system (ilk teslimat)

Ekranlardan önce bir **design system sayfası** üret:

1. Renk token'ları (yukarıdaki tablo + durum renkleri), açık tema. *(Koyu tema sonraya kalabilir; token'ları buna hazır kur.)*
2. Tipografi ölçeği: display-xl / display / h1–h4 / body-lg / body / small / label (eyebrow).
3. Boşluk ölçeği, grid (desktop 12 kolon, 1440 genişlik, ~80px kenar boşluğu; mobil 390, 16–20px kenar).
4. Butonlar: primary (mürdüm zemin/krem metin), light (krem zemin/koyu metin — hero'daki), outline, ghost,
   ok'lu metin link ("VIEW ALL →"). Durumlar: hover, focus (görünür odak halkası), disabled, loading.
5. Form elemanları: input, arama kutusu (büyük, editoryal), select, checkbox, radio, tarih seçici, hata/yardım metni.
6. Rozetler: kitap/kopya/rezervasyon/ödünç durumları.
7. Kitap kartı varyantları: grid kartı (referanstaki), liste satırı, kompakt (çanta ve tablo içi), yatay "öne çıkan".
8. Navigasyon: header (misafir / giriş yapmış / admin), mobil menü, footer, breadcrumb, sekmeler, sayfalama.
9. Geri bildirim: toast, modal, sağdan açılan drawer, boş durum, yükleniyor iskeleti (skeleton), hata durumu.
10. Veri: tablo (admin için), istatistik kartı (KPI), basit grafik stili (çizgi + bar, palete uygun).
11. Dil seçici (TR / EN) ve kullanıcı menüsü.

---

## 3. Ekranlar

Her ekran için **desktop (1440)** tasarla; üye tarafındaki ekranlar için **mobil (390)** versiyonu da gerekli.
Admin ekranları desktop öncelikli, tablet (1024) kırılmadan çalışmalı.

### A. Üye / misafir tarafı (referansın dili en güçlü burada olmalı)

1. **Ana sayfa** — referansın aynısı + kütüphane içeriği:
   header (nav: Catalog, Collections, Events, About · arama · ödünç çantası · giriş/kullanıcı · TR/EN) →
   hero → "Curated for curious readers" (kütüphanecinin seçtikleri) → "New arrivals" → kategori şeridi
   (editoryal, büyük serif kategori adları) → "Most borrowed this month" → etkinlik bandı → nasıl çalışır
   (Reserve online → Pick up at the desk → Return in 14 days, sade 3 adım) → footer (adres, çalışma saatleri,
   linkler, dil).
2. **Katalog / arama:** büyük arama kutusu; solda filtreler (kategori, dil, müsaitlik, yayın yılı, yazar);
   sıralama; grid/liste geçişi; her kartta müsaitlik rozeti; aktif filtre çipleri; sayfalama;
   **sonuç yok** durumu; yükleniyor iskeleti.
3. **Kitap detayı:** büyük kapak (gerçekçi gölge), serif başlık, yazar(lar), meta (yayınevi, yıl, sayfa, dil, ISBN,
   raf konumu), açıklama, kategori etiketleri; **müsaitlik kutusu**: "2 of 3 copies available · Shelf B-214";
   birincil eylem **"Add to borrow bag"** / **"Reserve"**; hiç kopya yoksa **"Join waitlist — you'd be #3"**;
   zaten ödünçteyse durumu göster; "More by this author" ve "Readers also borrowed" şeritleri.
4. **Ödünç çantası (drawer):** header'daki çanta ikonundan sağdan açılır. Seçilen kitaplar (kompakt kart),
   kurallar ("You can have up to 5 active loans — 2 slots left"), **"Reserve all"** butonu.
5. **Rezervasyon onayı:** başarılı ekran — "Ready for pickup within 48 hours" bilgisi, gişede gösterilecek
   **QR kod + kısa kod** (ör. `MB-4K7Q`), teslim alma son tarihi, kütüphane çalışma saatleri.
6. **Giriş / Kayıt / Şifremi unuttum:** ikiye bölünmüş editoryal düzen (bir yanda atmosfer fotoğrafı, diğer yanda
   form). Kayıt alanları: ad soyad, üniversite e-postası, öğrenci/personel no, fakülte, şifre.
7. **Hesabım — panel:** karşılama ("Good evening, Ayşe"); **aktif ödünçler** (kapak, iade tarihi,
   kalan gün göstergesi, "Renew" butonu, gecikenler kiremit vurgulu); **rezervasyonlar** durum akışıyla
   (Pending → Ready for pickup → Collected / Expired); **cezalar** (toplam, detay); kütüphane kartı (QR'lı dijital kart).
8. **Hesabım — geçmiş:** okunan kitaplar zaman çizelgesi / grid, yıllık okuma özeti ("You read 23 books in 2026").
9. **Hesabım — listelerim / favoriler** ve **profil & ayarlar** (dil, bildirim tercihleri, şifre).
10. **Etkinlikler:** liste (büyük görsel + tarih, referanstaki etkinlik bandının dili) ve detay + "RSVP" akışı.
11. **Hakkında:** kütüphane, adres, çalışma saatleri, kurallar (ödünç süresi, ceza vb.) — editoryal sayfa.
12. **Sistem sayfaları:** 404 (edebi bir şakayla), boş durumlar, hata.

### B. Kütüphaneci / admin tarafı

Aynı marka, aynı renk ve fontlar; ama **daha yoğun, işlevsel** düzen: sol sidebar (krem), ince çizgili tablolar,
fotoğraf yok veya çok az. Hâlâ "kurumsal SaaS" değil, "zarif bir kütüphane masası" gibi hissettirmeli.

13. **Admin paneli (dashboard):** KPI kartları (Active loans, Overdue, Awaiting pickup, New members this week);
    haftalık ödünç grafiği; "Today's pickups" listesi; "Overdue" listesi (gün sayısı, ceza); hızlı eylemler.
14. **Gişe (Circulation desk) — en önemli admin ekranı:** büyük, klavye/barkod okuyucu dostu.
    - **Teslim et:** üye kartı/QR veya rezervasyon kodu okut → üyenin "hazır" rezervasyonları listelenir →
      kopya barkodunu okut → eşleşme onayı → **"Confirm checkout"** → iade tarihi gösterilir.
    - **İade al:** kopya barkodunu okut → ödünç bilgisi, gecikme günü, hesaplanan ceza → **"Confirm return"**;
      kitabı bekleyen varsa "Hold for next reader" uyarısı.
    - Her adımda net başarı/hata geri bildirimi (yanlış kopya, üye engelli, limit dolu).
15. **Kitap içe aktarma (Import):** üstte tek giriş: ISBN yaz / başlık-yazar ara / **barkod okut**
    (kamera ile okutma butonu) → birden çok kaynaktan sonuçlar (her sonuçta kaynak rozeti: Google Books,
    Open Library, Apple Books) → baskı seç → **otomatik dolmuş form** (başlık, yazarlar, yayınevi, yıl, sayfa, dil,
    kategoriler, açıklama) → **kapak seçici** (aday kapaklar yan yana, çözünürlükleri yazılı, "en iyi" işaretli,
    "Upload your own" seçeneği) → kopya sayısı + raf konumu → kaydet. Ayrıca "Bulk import (CSV of ISBNs)" sekmesi
    ve ilerleme durumu.
16. **Kitaplar listesi:** tablo — kapak küçük resmi, başlık, yazar, kategori, stok sütunları
    (Total / Available / On loan / Reserved), filtreler, toplu işlemler.
17. **Kitap düzenleme:** sekmeler — Details · Copies (barkod, durum, kondisyon, raf, geçmiş) · Activity.
18. **Üyeler:** liste + üye detayı (aktif ödünçler, rezervasyonlar, cezalar, geçmiş, "Block / Unblock").
19. **Raporlar:** gecikme raporu (filtreler, CSV dışa aktar), en çok ödünç alınanlar, kategori dağılımı,
    aylık trend.
20. **Etkinlik yönetimi** (liste + form) ve **Ayarlar** (ödünç süresi, maks. ödünç, günlük ceza,
    teslim alma süresi, kütüphane saatleri).

---

## 4. İçerik ve örnek veri

- Gerçekçi içerik kullan (lorem ipsum yok). Kitap örnekleri hem İngilizce hem Türkçe olsun
  (ör. *The Midnight Library*, *Project Hail Mary*, *Kürk Mantolu Madonna*, *Tutunamayanlar*,
  *Saatleri Ayarlama Enstitüsü*).
- Örnek kullanıcı: **Ayşe Yılmaz**, Bilgisayar Mühendisliği, öğrenci no 220201045.
- Örnek kütüphaneci: **Mehmet Demir**.
- Tarihler: EN "Thu, Apr 24 · 7:00 PM", TR "Per, 24 Nis · 19:00". Para: "₺12,50".

## 5. Teknik teslim kısıtları (koda aktarım için)

Tasarım **Next.js + Tailwind CSS + shadcn/ui + Lucide** ile koda aktarılacak.

- Renk, font, boşluk, radius ve gölgeleri **CSS değişkenleri / token** olarak tanımla; sabit hex'leri bileşenlere gömme.
- Bileşenleri tekrar kullanılabilir parçalara böl (BookCard, StatusBadge, SectionHeader, EventBand, BorrowBagDrawer…).
- Fontlar Google Fonts'tan, `latin-ext` alt kümesiyle (Türkçe için).
- Erişilebilirlik: WCAG AA kontrast (özellikle krem üstü soluk metinler ve mürdüm üstü krem metin),
  görünür klavye odağı, ikon butonlarında etiket.
- Animasyon: sakin ve kısa (fade/slide 150–250ms, kapaklarda hafif hover kalkışı). Abartılı hareket yok.

---

## 6. Prompt sırası (Claude Design'da adım adım)

1. **"Bu brifi ve referans görseli oku. Önce sadece design system sayfasını üret (Bölüm 2)."**
2. **"Design system'i kullanarak Ana sayfayı (A1) desktop ve mobil olarak tasarla. Referans görselle aynı görsel dil."**
   → Referansa ne kadar yakın olduğunu kontrol et, gerekirse burada iterasyon yap. Diğer her şey buna dayanacak.
3. "Katalog (A2) ve Kitap detayı (A3) — desktop + mobil."
4. "Ödünç çantası drawer'ı (A4) ve Rezervasyon onayı (A5)."
5. "Giriş / Kayıt (A6) ve Hesabım ekranları (A7–A9)."
6. "Etkinlikler, Hakkında ve sistem sayfaları (A10–A12)."
7. "Admin: Dashboard (B13) ve Gişe ekranı (B14)."
8. "Admin: Kitap içe aktarma (B15), Kitaplar listesi ve düzenleme (B16–B17)."
9. "Admin: Üyeler, Raporlar, Etkinlik yönetimi, Ayarlar (B18–B20)."
10. "Tüm ekranları Türkçe metinle kontrol et; taşan/kırılan yerleri düzelt."
