import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module.js';
import { CatalogModule } from './catalog/catalog.module.js';
import { HealthController } from './health/health.controller.js';
import { ImportModule } from './import/import.module.js';
import { MeController } from './me/me.controller.js';
import { MembersController } from './members/members.controller.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { SupabaseModule } from './supabase/supabase.module.js';

@Module({
  imports: [
    // One .env for the whole monorepo, at the repository root.
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['../../.env'] }),
    PrismaModule,
    SupabaseModule,
    AuthModule,
    CatalogModule,
    ImportModule,
  ],
  controllers: [HealthController, MeController, MembersController],
})
export class AppModule {}
