/**
 * Rebuilds only the collections from the books already in the catalog (no provider lookups).
 *
 *   pnpm --filter @mybook/api db:seed:collections   (stop `pnpm dev` first: the build replaces dist/)
 */
import '../network.js';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { seedCollections } from './collections.js';

const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
await seedCollections(app.get(PrismaService));
await app.close();
