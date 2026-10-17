import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AccountModule } from './account/account.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CatalogModule } from './catalog/catalog.module.js';
import { CirculationModule } from './circulation/circulation.module.js';
import { EventsModule } from './events/events.module.js';
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
    ScheduleModule.forRoot(),
    PrismaModule,
    SupabaseModule,
    AuthModule,
    CatalogModule,
    ImportModule,
    CirculationModule,
    EventsModule,
    AccountModule,
  ],
  controllers: [HealthController, MeController, MembersController],
})
export class AppModule {}
