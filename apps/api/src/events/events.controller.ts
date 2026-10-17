import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { eventsQuerySchema, type EventsQuery } from '@mybook/shared';
import { z } from 'zod';
import { CurrentUser, Public } from '../auth/auth.decorators.js';
import type { AuthUser } from '../auth/auth.types.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { EventsService } from './events.service.js';

const reminderSchema = z.object({ remind: z.boolean() });

@Controller('events')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Public()
  @Get()
  list(@Query(new ZodValidationPipe(eventsQuerySchema)) query: EventsQuery) {
    return this.events.list(query);
  }

  @Public()
  @Get(':slug')
  detail(@Param('slug') slug: string) {
    return this.events.detail(slug);
  }

  /** The signed-in member's sign-up for this event. */
  @Get(':slug/rsvp')
  myRsvp(@CurrentUser() user: AuthUser, @Param('slug') slug: string) {
    return this.events.myRsvp(user.id, slug);
  }

  @Post(':slug/rsvp')
  rsvp(@CurrentUser() user: AuthUser, @Param('slug') slug: string) {
    return this.events.rsvp(user.id, slug);
  }

  @Delete(':slug/rsvp')
  cancel(@CurrentUser() user: AuthUser, @Param('slug') slug: string) {
    return this.events.cancel(user.id, slug);
  }

  @Patch(':slug/rsvp')
  reminder(@CurrentUser() user: AuthUser, @Param('slug') slug: string, @Body(new ZodValidationPipe(reminderSchema)) body: z.infer<typeof reminderSchema>) {
    return this.events.setReminder(user.id, slug, body.remind);
  }
}
