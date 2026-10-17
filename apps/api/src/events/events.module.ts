import { Module } from '@nestjs/common';
import { CirculationModule } from '../circulation/circulation.module.js';
import { EventsController } from './events.controller.js';
import { EventsService } from './events.service.js';

@Module({
  imports: [CirculationModule],
  controllers: [EventsController],
  providers: [EventsService],
})
export class EventsModule {}
