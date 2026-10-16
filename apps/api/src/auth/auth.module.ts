import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './auth.guard.js';
import { SupabaseJwtService } from './supabase-jwt.service.js';

@Module({
  providers: [SupabaseJwtService, { provide: APP_GUARD, useClass: AuthGuard }],
  exports: [SupabaseJwtService],
})
export class AuthModule {}
