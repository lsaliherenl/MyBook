# MyBook

**English** · [Türkçe](README.tr.md)

A full-stack library management system for a university library — with an editorial, bookshop-inspired interface.
Members browse the catalog, reserve books online and pick them up at the desk; librarians confirm checkouts and
returns, import books from public book APIs and track overdue loans.

> 🚧 **Work in progress.** The design and the architecture are being prepared; nothing is runnable yet.

## Planned features

**Members**
- Catalog search with filters (category, language, availability, year)
- Borrow bag → online reservation → pickup code at the desk
- Active loans, due dates, renewals, fines and reading history
- Library events with RSVP
- Turkish and English interface

**Librarians**
- Circulation desk: confirm checkouts and returns with barcode / QR scanning
- Import books by ISBN, title search or barcode from Google Books, Open Library and Apple Books
- Copy-level stock tracking (each physical copy has its own barcode and status)
- Overdue reports, popular books and statistics

## Tech stack (planned)

| Layer | Technology |
|---|---|
| Web | Next.js 16 (Cache Components), TypeScript, Tailwind CSS, Supabase SSR auth, `[lang]` i18n routing |
| API | NestJS, Prisma |
| Database & storage | Supabase (PostgreSQL, Storage) |
| Tooling | Turborepo monorepo, Docker Compose |

## Getting started

Requirements: Node.js 22+, pnpm 12, a Supabase project.

```bash
pnpm install
cp .env.example .env        # then fill in the values
pnpm --filter @mybook/api db:migrate
pnpm --filter @mybook/api db:seed     # optional: categories + ~150 demo books with covers
pnpm dev                    # web → http://localhost:3000 · API → http://localhost:4000/api
```

After signing up in the web app, give yourself the librarian or admin role:

```bash
pnpm --filter @mybook/api user:role you@example.edu ADMIN
```

### API overview

| Endpoint | Access |
|---|---|
| `GET /api/books?q=&category=&language=&available=&sort=&page=` | public |
| `GET /api/books/:slug`, `GET /api/categories` | public |
| `GET /api/me`, `PATCH /api/me` | signed in |
| `GET /api/admin/import/search?isbn=` or `?q=` | librarian |
| `POST /api/admin/books/import` | librarian |
| `GET /api/admin/members`, `PATCH /api/admin/members/:id/role` | librarian / admin |

The web app signs users in with Supabase Auth and forwards the access token; the API verifies it against the
project's public JWKS and reads the user's role from the `profiles` table.

| Path | What it is |
|---|---|
| `apps/web` | Next.js frontend |
| `apps/api` | NestJS API, Prisma schema and migrations (`prisma/`) |
| `packages/shared` | Types and constants shared by web and API |
| `supabase/` | Supabase CLI project config |

Some database rules (partial unique indexes, check constraints, the Supabase Auth trigger and row level security)
are written as raw SQL migrations because Prisma's schema language cannot express them. Review generated SQL before
adding new migrations so they are not dropped.

## Documentation

- UML diagrams (class, object, package, deployment) will live in [`docs/uml`](docs/uml) as Mermaid `.mmd` files.
- Design brief: [`docs/design/claude-design-brief.md`](docs/design/claude-design-brief.md)

## Background

This project started as a class assignment ("Online Library Management System" — UML modelling) and is being
built out into a complete, production-style application.
