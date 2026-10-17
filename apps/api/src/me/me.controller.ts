import { Body, Controller, Get, Patch } from '@nestjs/common';
import { updateProfileSchema, withDefaultPrefs, type ProfileDto, type UpdateProfileInput } from '@mybook/shared';
import { CurrentUser } from '../auth/auth.decorators.js';
import type { AuthUser } from '../auth/auth.types.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { toProfileDto } from './profile.mapper.js';

@Controller('me')
export class MeController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async get(@CurrentUser() user: AuthUser): Promise<ProfileDto> {
    return toProfileDto(await this.prisma.profile.findUniqueOrThrow({ where: { id: user.id } }));
  }

  @Patch()
  async update(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(updateProfileSchema)) body: UpdateProfileInput,
  ): Promise<ProfileDto> {
    const { notificationPrefs, ...rest } = body;
    // Overdue notices stay on whatever the member sends.
    const data = notificationPrefs ? { ...rest, notificationPrefs: withDefaultPrefs(notificationPrefs) } : rest;
    return toProfileDto(await this.prisma.profile.update({ where: { id: user.id }, data }));
  }
}
