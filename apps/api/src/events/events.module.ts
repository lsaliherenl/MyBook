import { Module } from '@nestjs/common';
import { CirculationModule } from '../circulation/circulation.module.js';
import { EventsAdminController } from './events-admin.controller.js';
import { EventsAdminService } from './events-admin.service.js';
import { EventsController } from './events.controller.js';
import { EventsService } from './events.service.js';

@Module({
  imports: [CirculationModule],
  controllers: [EventsController, EventsAdminController],
  providers: [EventsService, EventsAdminService],
})
export class EventsModule {}
