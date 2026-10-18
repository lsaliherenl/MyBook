import { BadRequestException, Body, Controller, Get, Header, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import {
  adminMembersQuerySchema,
  memberNoteSchema,
  memberStatusSchema,
  updateRoleSchema,
  type AdminMembersQuery,
  type MemberStatusInput,
  type ProfileDto,
} from '@mybook/shared';
import { z } from 'zod';
import { CurrentUser, MinRole } from '../auth/auth.decorators.js';
import type { AuthUser } from '../auth/auth.types.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { toProfileDto } from '../me/profile.mapper.js';
import { MembersService } from './members.service.js';

@Controller('admin/members')
@MinRole('LIBRARIAN')
export class MembersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly members: MembersService,
  ) {}

  @Get()
  list(@Query(new ZodValidationPipe(adminMembersQuerySchema)) query: AdminMembersQuery) {
    return this.members.list(query);
  }

  @Get('export.csv')
  @Header('content-type', 'text/csv; charset=utf-8')
  @Header('content-disposition', 'attachment; filename="members.csv"')
  csv(@Query(new ZodValidationPipe(adminMembersQuerySchema)) query: AdminMembersQuery) {
    return this.members.listCsv(query);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.members.get(id);
  }

  /** Staff notes about a member, visible to librarians only. */
  @Post(':id/notes')
  addNote(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(memberNoteSchema)) body: z.infer<typeof memberNoteSchema>) {
    return this.members.addNote(actor, id, body.text);
  }

  /** Blocks a member from reserving and borrowing (or lifts the block). */
  @Patch(':id/status')
  async setStatus(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(memberStatusSchema)) body: MemberStatusInput,
  ): Promise<ProfileDto> {
    if (id === actor.id) throw new BadRequestException('You cannot block yourself');
    const blockedReason = body.status === 'BLOCKED' ? body.reason : null;
    const [profile] = await this.prisma.$transaction([
      this.prisma.profile.update({ where: { id }, data: { status: body.status, blockedReason } }),
      this.prisma.auditLog.create({
        data: { actorId: actor.id, action: 'member.status', entityType: 'profile', entityId: id, data: body },
      }),
    ]);
    return toProfileDto(profile);
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
