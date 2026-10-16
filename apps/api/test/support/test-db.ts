import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { PrismaPGlite } from 'pglite-prisma-adapter';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '../../src/generated/prisma/client.js';

const MIGRATIONS = join(import.meta.dirname, '../../prisma/migrations');

/** The parts of Supabase's own schemas that our migrations reference. */
const SUPABASE_STUBS = `
  CREATE ROLE anon;
  CREATE ROLE authenticated;
  CREATE SCHEMA extensions;
  CREATE SCHEMA auth;
  CREATE TABLE auth.users (
    id uuid PRIMARY KEY,
    instance_id uuid,
    aud text,
    role text,
    email text,
    raw_user_meta_data jsonb,
    created_at timestamptz,
    updated_at timestamptz
  );
  CREATE SCHEMA storage;
  CREATE TABLE storage.buckets (
    id text PRIMARY KEY,
    name text,
    public boolean,
    file_size_limit bigint,
    allowed_mime_types text[]
  );
`;

export interface TestDb {
  prisma: PrismaClient;
  pg: PGlite;
  close(): Promise<void>;
}

/**
 * An in-memory Postgres (PGlite) with every migration applied — the real constraints, triggers
 * and indexes, no Docker needed. Each call returns a fresh, empty database.
 */
export async function createTestDb(): Promise<TestDb> {
  const pg = new PGlite({ extensions: { pg_trgm } });
  await pg.exec(SUPABASE_STUBS);
  for (const dir of readdirSync(MIGRATIONS, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort()) {
    await pg.exec(readFileSync(join(MIGRATIONS, dir, 'migration.sql'), 'utf8'));
  }
  const prisma = new PrismaClient({ adapter: new PrismaPGlite(pg) });
  return {
    prisma,
    pg,
    close: async () => {
      await prisma.$disconnect();
      await pg.close();
    },
  };
}

let userCounter = 0;

/** Signs a user up the way Supabase Auth does: an auth.users row, whose trigger creates the profile. */
export async function createMember(
  db: TestDb,
  { role = 'MEMBER', name = 'Ayşe Yılmaz' }: { role?: 'MEMBER' | 'LIBRARIAN' | 'ADMIN'; name?: string } = {},
) {
  userCounter++;
  const id = `00000000-0000-4000-8000-${String(userCounter).padStart(12, '0')}`;
  await db.pg.query(
    `INSERT INTO auth.users (id, email, raw_user_meta_data, created_at, updated_at) VALUES ($1, $2, $3, now(), now())`,
    [id, `user${userCounter}@example.edu`, JSON.stringify({ full_name: name })],
  );
  return db.prisma.profile.update({ where: { id }, data: { role } });
}

/** A book with `copies` shelf copies. */
export async function createBook(db: TestDb, title = 'Kürk Mantolu Madonna', copies = 1) {
  userCounter++;
  return db.prisma.book.create({
    data: {
      slug: `book-${userCounter}`,
      title,
      language: 'tr',
      copies: { create: Array.from({ length: copies }, () => ({ shelfLocation: 'TE-101' })) },
    },
    include: { copies: { orderBy: { barcode: 'asc' } } },
  });
}
