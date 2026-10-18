# MY / BOOK — Tasarım ilerlemesi

Tuval (Design): https://claude.ai/artifact/5mK6J8Xsyut2jq49uB2QM8

## Kararlar
- Marka: **MY / BOOK** · slogan "Books · People · Quiet hours" (TR: "Kitap · Okur · Sükûnet")
- Fontlar: Cormorant Garamond (display), Jost (UI), latin-ext
- Palet: paper #F1EAE0 · paper-2 #E8DED1 · paper-3 #FAF6F0 · plum-900 #2E1424 · plum-700 #4A2238 · plum-500 #6E3B57 · ink #231A1F · ink-muted #6B5D63 · line #D6CABB · gold #B88A4A
- Durum renkleri: available #3F5E45/#DFE5D6 · ready #7A5418/#F1E2C4 · on loan #5A2C45/#EADBE2 · overdue #9A3B2A/#F2D9D0 · expired #5F5A57/#E4DFDA
- Radius 0 (input/rozet 2px), gradient/glass yok, Lucide 1.5 stroke
- Kaydırma çubuğu: sayfa çubuğu tamamen saydam — tarayıcının yerel çubuğu gizli (yer kaplamaz), yerine sayfanın üstünde yüzen ince plum-900 %62 tutamaç; yalnızca kaydırırken görünür, ~0,9 sn sonra söner, sürüklenebilir. İç kaydırma alanları (admin menüsü, yatay raflar) saydam track, yalnızca kaydırırken thumb.
- Fotoğraflar: her sayfaya özgü (Canva). Ana sayfa: hero + kütüphane iç mekânı; Hakkında: atrium; Giriş: pencere kenarı okuma köşesi; Etkinlikler: kitap kulübü masası; Etkinlik detayı: okuma halkası.
- Kitap kapakları: API'den gelecek; yoksa tipografik yedek kapak (uzun kelimelerde heceden bölünür)
- Ödünç kuralları (örnek): öğrenci maks. 5 aktif ödünç, 14 gün, 1 yenileme (bekleyen varsa / gecikmişse yok); öğretim üyesi 10 kitap / 28 gün / 2 yenileme; personel öğrenciyle aynı. Hazır olduktan sonra 48 saat teslim alma (Pazar/tatil sayılmaz), gecikme ₺2,50/gün, ₺50 üstü ceza ödünç almayı durdurur, 60 gün gecikme = kayıp
- Çalışma saatleri (örnek): Pzt–Cum 08:00–22:00 (gişe 21:45), Cmt 10:00–18:00, Pazar kapalı; 29 Ekim kapalı; sınav haftaları 2–15 Kasım 08:00–00:00
- Rezervasyon kodu: MB-XXXX, QR `MYBOOK:RES:<kod>`; üye kartı QR `MYBOOK:MEMBER:<no>`
- Kütüphane (örnek): 48.210 kitap, 5 kat (G: gişe & yeni gelenler A-, 1: fen & bilgisayar A–C, 2: Reading Room, 3: tarih/felsefe/sanat, 4: edebiyat L-300–499), 420 koltuk, haftada 78 saat açık
- Sayfa yüksekliği: tek ekrana sığan sayfalar (giriş, 404, admin) en az pencere yüksekliği kadar uzar (min-height: max(900px, 100vh))
- Admin kabuğu: sol menü (Dashboard, Circulation desk, Books, Import, Members, Events, Reports, Settings) sabit ve tam yükseklik (sticky, 100vh); üst bar: genel arama, Mehmet Demir · Librarian · desk 1, TR/EN düğmesi. 900px altında sol menü üstte ince, yatay kaydırılan bir çubuğa dönüşür.
- Ödünç çantası: ayrı sayfa değil, her sayfada sağdan açılan çekmece (bag drawer); örnek durum 2 kitap, rezervasyon sonrası boş.
- Koleksiyonlar ayrı sayfa (A2b): öne çıkan "Modern Türk klasikleri" + 6 koleksiyon, gruba göre filtre.
- İstatistik ızgaraları boş hücre bırakmaz (3+3 / 4 / 2+2).
- Telefon uyumu: masaüstü sayfalar 760px altında tek sütuna/kaydırmalı yapılara geçer; hiçbir sayfa 360px'te yana kaymaz. Mobil sayfalar akışkan genişlikte.
- Örnek veri tüm ekranlarda tutarlı: Ayşe Yılmaz (220201045, Bilgisayar Müh.) — 3 ödünç (Sapiens 2 gün gecikmiş ₺5,00), MB-4K7Q rezervasyonu; Burak Yıldız ₺57,50 ile engelli; Kürk Mantolu Madonna 3 kopya (0388-2045…47)
- Türkçe biçimler: tarih "Per, 12 Kas", saat 24 saat "19:00", sayı "12.480", yüzde "%90", para "₺1.842,50"; `lang="tr"` ile büyük harfte i → İ

## Tamamlanan (brif prompt sırası)
1. Design system — 4 sayfa (Foundations, Controls, Patterns, Feedback & data)
2. A1 Ana sayfa — desktop + mobil
3. A2 Katalog + A3 Kitap detayı — desktop + mobil
4. A4 Ödünç çantası + A5 Rezervasyon onayı — desktop + mobil
5. A6 Giriş/Kayıt/Şifre sıfırlama + A7 Hesabım + A7b Ödünç & rezervasyonlar + A8 Okuma geçmişi + A9 Listeler & Profil/Ayarlar — desktop + mobil
6. A10 Etkinlikler (liste + detay/RSVP) + A11 Hakkında + A12 Sistem sayfaları (404 / 500 / offline) — desktop + mobil
7. B13 Dashboard + B14 Gişe (check out / return; engelli üye, sıradaki okura ayırma senaryoları)
8. B15 Kitap içe aktarma (tek ISBN + toplu CSV) · B16 Kitaplar listesi · B17 Kitap düzenleme (Details · Copies · Activity)
9. B18 Üyeler + üye detayı · B19 Raporlar · B20 Etkinlik yönetimi ve Ayarlar
10. Türkçe metin kontrolü — tüm ekranların Türkçe kopyası ("TR ·", İngilizce sürümün sağında; TR ekranlar birbirine bağlı). Ekranlar 1440 / 1024 / 390 px'te taşma için tarandı; uzun TR metinler kısaltıldı, bağlama göre çeviri (History → "Tarih"/"Geçmiş", Faculty → "Fakülte"/"Öğretim üyesi").

## Ek istekler (Eren) — tamamlandı
1. **Bağlantılar ve hareket:** tüm sayfalar birbirine bağlı; sayfa geçişleri (view transition), başlık/görsel giriş animasyonları, sekme geçişleri yumuşak, SSS açılma animasyonu, giriş ↔ kayıt geçişi. Bulanıklık yapan kaydırma animasyonu kaldırıldı.
2. **Görseller:** her sayfaya özgü Canva görselleri (Hakkında, Giriş, Etkinlikler, Etkinlik detayı).
3. **Düzen düzeltmeleri:** Ayarlar alt menüsü kaydırınca üst üste binmiyor ve seçili bölüm işaretleniyor; dil seçici kutusu tüm satırı kaplamıyor; Hakkında "Where things are" netleştirildi; istatistik ızgaraları dolu.
4. **Yeni yapılar:** Koleksiyonlar sayfası (A2b); sağdan açılan ödünç çantası çekmecesi; tüm masaüstü başlıklarda arama simgesi; tüm admin sayfalarında TR/EN düğmesi; sabit, tam yükseklik admin menüsü.
5. **Hover simgeleri:** imleç gelince konuya uygun simgeler beliriyor:
   - Ana sayfa kategorileri ve ödünç adımları
   - Hakkında kat rehberi
   - Koleksiyon kartları
   - Etkinlik filtreleri ve satırları
   - Katalog kategori filtresi
   - Hesap menüsü simgeleri (dönme / atma / zıplama)
   - Dashboard KPI kartları ve hızlı işlemler
   - Ayarlar entegrasyon kartları (nabız)
   - Kitap detayı konu etiketleri
6. **Mikro etkileşimler:** Admin Ayarlar'da sayılar değişirken kayarak değişiyor (artınca aşağıdan, azalınca yukarıdan), sınırda sallanıyor, özet tablosu hücresi kısa süre parlıyor. Hesap menüsünde "Ödünç ve rezervasyonlar" simgesi düzeltildi.
7. **Telefon uyumu:**
   - A1 "En çok ödünç alınanlar" ve "Yeni gelenler" yana kaydırılan raflar
   - A2 kategoriler ve filtreler açılıp kapanan panel, sonuçlar 2 sütun
   - A3 "Yazarın diğer kitapları" ve "Okurlar bunu da aldı" yana kaydırılan raflar
   - A7b, A9, A10 tablo/satırlar telefonda alt alta
   - Admin sayfalarında ince üst menü; B14–B20 taşmaları giderildi (formlar tek sütun, tablolar ve rapor grafiği kendi içinde kayar)
8. **Kaydırma çubuğu:** tamamen saydam, yalnızca kaydırırken görünen yüzen tutamaç.

## Durum
Brif ve tüm ek istekler tamamlandı (tuval sürüm 58). Yeni istek gelirse buradan devam.
