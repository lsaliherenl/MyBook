import { Module } from '@nestjs/common';
import { CirculationService } from './circulation.service.js';
import { Clock } from './clock.js';
import { DeskController } from './desk.controller.js';
import { DeskService } from './desk.service.js';
import { HoldExpiryJob } from './hold-expiry.job.js';
import { MemberCirculationController } from './member-circulation.controller.js';
import { ReportsService } from './reports.service.js';
import { SettingsService } from './settings.service.js';

@Module({
  controllers: [MemberCirculationController, DeskController],
  providers: [Clock, CirculationService, DeskService, ReportsService, SettingsService, HoldExpiryJob],
  exports: [CirculationService],
})
export class CirculationModule {}
