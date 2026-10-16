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
| Web | Next.js, TypeScript, Tailwind CSS, shadcn/ui, next-intl |
| API | NestJS, Prisma |
| Database & storage | Supabase (PostgreSQL, Storage) |
| Tooling | Turborepo monorepo, Docker Compose |

## Documentation

- UML diagrams (class, object, package, deployment) will live in [`docs/uml`](docs/uml) as Mermaid `.mmd` files.
- Design brief: [`docs/design/claude-design-brief.md`](docs/design/claude-design-brief.md)

## Background

This project started as a class assignment ("Online Library Management System" — UML modelling) and is being
built out into a complete, production-style application.
