import { BadRequestException, Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { updateRoleSchema, type Paginated, type ProfileDto } from '@mybook/shared';
import { z } from 'zod';
import { CurrentUser, MinRole } from '../auth/auth.decorators.js';
import type { AuthUser } from '../auth/auth.types.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { toProfileDto } from '../me/profile.mapper.js';

const listQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

@Controller('admin/members')
@MinRole('LIBRARIAN')
export class MembersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Query(new ZodValidationPipe(listQuerySchema)) query: z.infer<typeof listQuerySchema>): Promise<Paginated<ProfileDto>> {
    const where: Prisma.ProfileWhereInput = query.q
      ? {
          OR: [
            { fullName: { contains: query.q, mode: 'insensitive' } },
            { email: { contains: query.q, mode: 'insensitive' } },
            { studentNumber: { contains: query.q } },
            { cardNumber: { equals: query.q.toUpperCase() } },
          ],
        }
      : {};
    const [total, rows] = await Promise.all([
      this.prisma.profile.count({ where }),
      this.prisma.profile.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return {
      items: rows.map(toProfileDto),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  @Patch(':id/role')
  @MinRole('ADMIN')
  async setRole(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateRoleSchema)) body: z.infer<typeof updateRoleSchema>,
  ): Promise<ProfileDto> {
    if (id === actor.id) throw new BadRequestException('You cannot change your own role');
    const [profile] = await this.prisma.$transaction([
      this.prisma.profile.update({ where: { id }, data: { role: body.role } }),
      this.prisma.auditLog.create({
        data: { actorId: actor.id, action: 'member.role', entityType: 'profile', entityId: id, data: { role: body.role } },
      }),
    ]);
    return toProfileDto(profile);
  }
}
