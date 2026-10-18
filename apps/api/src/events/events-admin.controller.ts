import { Body, Controller, Delete, Get, Header, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ADMIN_EVENT_LISTS, saveEventSchema, type SaveEventInput } from '@mybook/shared';
import { z } from 'zod';
import { CurrentUser, MinRole } from '../auth/auth.decorators.js';
import type { AuthUser } from '../auth/auth.types.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { EventsAdminService } from './events-admin.service.js';

const listSchema = z.object({ list: z.enum(ADMIN_EVENT_LISTS).default('upcoming') });

@Controller('admin/events')
@MinRole('LIBRARIAN')
export class EventsAdminController {
  constructor(private readonly events: EventsAdminService) {}

  @Get()
  list(@Query(new ZodValidationPipe(listSchema)) query: z.infer<typeof listSchema>) {
    return this.events.list(query.list);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(saveEventSchema)) body: SaveEventInput) {
    return this.events.create(user, body);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.events.get(id);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(saveEventSchema)) body: SaveEventInput) {
    return this.events.update(user, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.events.remove(user, id);
  }

  @Get(':id/attendees')
  attendees(@Param('id', ParseUUIDPipe) id: string) {
    return this.events.attendees(id);
  }

  @Get(':id/attendees.csv')
  @Header('content-type', 'text/csv; charset=utf-8')
  @Header('content-disposition', 'attachment; filename="attendees.csv"')
  attendeesCsv(@Param('id', ParseUUIDPipe) id: string) {
    return this.events.attendeesCsv(id);
  }
}
