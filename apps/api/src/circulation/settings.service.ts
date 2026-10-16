import { Injectable } from '@nestjs/common';
import type { LibrarySettingsDto, UpdateSettingsInput } from '@mybook/shared';
import type { AuthUser } from '../auth/auth.types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { toSettingsDto } from './circulation.mapper.js';

/** The single library_settings row (id = 1) with the circulation rules. */
@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<LibrarySettingsDto> {
    return toSettingsDto(await this.prisma.librarySettings.findUniqueOrThrow({ where: { id: 1 } }));
  }

  async update(input: UpdateSettingsInput, actor: AuthUser): Promise<LibrarySettingsDto> {
    const [row] = await this.prisma.$transaction([
      this.prisma.librarySettings.update({ where: { id: 1 }, data: input }),
      this.prisma.auditLog.create({
        data: { actorId: actor.id, action: 'settings.update', entityType: 'library_settings', entityId: '1', data: input },
      }),
    ]);
    return toSettingsDto(row);
  }
}
