# MyBook

[English](README.md) · **Türkçe**

Bir üniversite kütüphanesi için, kitapçı estetiğinden ilham alan editoryal arayüze sahip full-stack kütüphane
yönetim sistemi. Üyeler kataloğu gezer, kitapları online rezerve eder ve gişeden teslim alır; kütüphaneciler
teslim ve iadeleri onaylar, kitapları açık kitap API'lerinden içe aktarır ve gecikmeleri takip eder.

> 🚧 **Geliştirme aşamasında.** Tasarım ve mimari hazırlanıyor; henüz çalıştırılabilir bir sürüm yok.

## Planlanan özellikler

**Üyeler**
- Filtreli katalog araması (kategori, dil, müsaitlik, yıl)
- Ödünç çantası → online rezervasyon → gişede teslim kodu
- Aktif ödünçler, iade tarihleri, süre uzatma, cezalar ve okuma geçmişi
- Kayıt olunabilen kütüphane etkinlikleri
- Türkçe ve İngilizce arayüz

**Kütüphaneciler**
- Gişe ekranı: barkod / QR okutarak teslim ve iade onayı
- ISBN, başlık araması veya barkod ile Google Books, Open Library ve Apple Books'tan kitap içe aktarma
- Kopya bazında stok takibi (her fiziksel kopyanın kendi barkodu ve durumu var)
- Gecikme raporları, popüler kitaplar ve istatistikler

## Teknoloji yığını (planlanan)

| Katman | Teknoloji |
|---|---|
| Web | Next.js 16 (Cache Components), TypeScript, Tailwind CSS, Supabase SSR auth, `[lang]` dil yönlendirmesi |
| API | NestJS, Prisma |
| Veritabanı ve depolama | Supabase (PostgreSQL, Storage) |
| Araçlar | Turborepo monorepo, Docker Compose |

## Kurulum

Gereksinimler: Node.js 22+, pnpm 12, bir Supabase projesi.

```bash
pnpm install
cp .env.example .env        # ardından değerleri doldurun
pnpm --filter @mybook/api db:migrate
pnpm --filter @mybook/api db:seed     # isteğe bağlı: kategoriler + kapaklı ~150 demo kitap
pnpm dev                    # web → http://localhost:3000 · API → http://localhost:4000/api
```

Web uygulamasından üye olduktan sonra kendinize kütüphaneci veya yönetici rolü verin:

```bash
pnpm --filter @mybook/api user:role siz@ornek.edu.tr ADMIN
```

### API özeti

| Uç nokta | Erişim |
|---|---|
| `GET /api/books?q=&category=&language=&available=&sort=&page=` | herkese açık |
| `GET /api/books/:slug`, `GET /api/categories` | herkese açık |
| `GET /api/me`, `PATCH /api/me` | giriş yapmış kullanıcı |
| `GET /api/admin/import/search?isbn=` veya `?q=` | kütüphaneci |
| `POST /api/admin/books/import` | kütüphaneci |
| `GET /api/admin/members`, `PATCH /api/admin/members/:id/status` | kütüphaneci |
| `PATCH /api/admin/members/:id/role` | yönetici |
| `GET /api/me/standing`, `/me/reservations`, `/me/loans?status=active\|history`, `/me/fines` | giriş yapmış kullanıcı |
| `POST /api/reservations` `{ bookIds }`, `DELETE /api/reservations/:id`, `POST /api/loans/:id/renew` | giriş yapmış kullanıcı |
| `GET /api/admin/desk/lookup?q=` (kart, teslim kodu, öğrenci no, e-posta, ad), `GET /api/admin/desk/members/:id` | kütüphaneci |
| `POST /api/admin/desk/checkout` `{ memberId, barcode }`, `POST /api/admin/desk/return` `{ barcode }` | kütüphaneci |
| `POST /api/admin/fines/:id/pay`, `POST /api/admin/fines/:id/waive` | kütüphaneci |
| `GET /api/admin/reports/dashboard`, `/overdue`, `/overdue.csv`, `/popular` | kütüphaneci |
| `GET /api/admin/settings`, `PATCH /api/admin/settings` | kütüphaneci / yönetici |

### Ödünç kuralları

Online rezervasyon → bir kopya teslim rafına ayrılır (ya da üye sıraya girer) → kütüphaneci gişede kopyayı okutur →
ödünç → iade. Varsayılanlar (`library_settings` tablosundan değiştirilebilir): 14 gün ödünç süresi, üye başına 5 kitap
(ödünçler ve açık rezervasyonlar birlikte), bekleyen yoksa bir kez uzatma, ayrılan kopyayı almak için 48 saat, geciken her
gün için ₺2,50. Geciken ödüncü, ₺50 ve üzeri ödenmemiş cezası olan ya da elle engellenen üye rezervasyon yapamaz ve ödünç
alamaz. Alınmayan ayırmalar beş dakikada bir düşürülür ve kopya sıradaki okura geçer.

Reddedilen işlemler HTTP 409 ve sabit bir `code` (ör. `loan_limit_reached`, `copy_reserved_for_another`) ile döner;
web uygulaması bu kodu çevirir.

### Testler

`pnpm test`, birim testlerini ve ödünç akışının entegrasyon testlerini tüm migration'ların uygulandığı PGlite (WebAssembly
olarak derlenmiş Postgres) üzerinde çalıştırır; böylece veritabanı kısıtları ve trigger'lar da test edilir. Docker veya
ayrı bir test veritabanı gerekmez.

Web uygulaması kullanıcıları Supabase Auth ile oturum açtırır ve erişim token'ını API'ye iletir; API token'ı projenin
herkese açık JWKS anahtarlarıyla doğrular ve kullanıcının rolünü `profiles` tablosundan okur.

| Klasör | İçerik |
|---|---|
| `apps/web` | Next.js arayüzü |
| `apps/api` | NestJS API, Prisma şeması ve migration'lar (`prisma/`) |
| `packages/shared` | Web ve API'nin ortak tip ve sabitleri |
| `supabase/` | Supabase CLI proje ayarları |

Bazı veritabanı kuralları (kısmi unique index'ler, check kısıtları, Supabase Auth trigger'ı ve satır bazlı güvenlik)
Prisma şema dilinde ifade edilemediği için ham SQL migration olarak yazıldı. Yeni migration eklerken üretilen SQL'i
gözden geçirin ki bunlar silinmesin.

## Dokümantasyon

- UML diyagramları (sınıf, nesne, paket, dağıtım) Mermaid `.mmd` dosyaları olarak [`docs/uml`](docs/uml) altında olacak.
- Tasarım brifi: [`docs/design/claude-design-brief.md`](docs/design/claude-design-brief.md)

## Arka plan

Bu proje bir ders ödevi olarak başladı ("Online Kütüphane Yönetim Sistemi" — UML modelleme) ve eksiksiz,
gerçek dünyaya uygun bir uygulamaya dönüştürülüyor.
