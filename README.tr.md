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
| Web | Next.js, TypeScript, Tailwind CSS, shadcn/ui, next-intl |
| API | NestJS, Prisma |
| Veritabanı ve depolama | Supabase (PostgreSQL, Storage) |
| Araçlar | Turborepo monorepo, Docker Compose |

## Kurulum

Gereksinimler: Node.js 22+, pnpm 12, bir Supabase projesi.

```bash
pnpm install
cp .env.example .env        # ardından değerleri doldurun
pnpm --filter @mybook/api db:migrate
pnpm dev                    # web → http://localhost:3000 · API → http://localhost:4000/api
```

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
