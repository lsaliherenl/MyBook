import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

// One .env for the whole monorepo, at the repository root.
config({ path: '../../.env', quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Migrations need a session connection; the app itself uses the pooled DATABASE_URL.
    url: process.env.DIRECT_URL,
  },
});
