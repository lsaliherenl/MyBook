import { Controller, Get, Param, Query } from '@nestjs/common';
import { eventsQuerySchema, type EventsQuery } from '@mybook/shared';
import { Public } from '../auth/auth.decorators.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { EventsService } from './events.service.js';

@Controller('events')
@Public()
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Get()
  list(@Query(new ZodValidationPipe(eventsQuerySchema)) query: EventsQuery) {
    return this.events.list(query);
  }

  @Get(':slug')
  detail(@Param('slug') slug: string) {
    return this.events.detail(slug);
  }
}
