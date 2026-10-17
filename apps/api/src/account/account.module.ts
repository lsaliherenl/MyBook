import { Module } from '@nestjs/common';
import { CirculationModule } from '../circulation/circulation.module.js';
import { AccountController } from './account.controller.js';
import { AccountService } from './account.service.js';
import { ListsService } from './lists.service.js';

@Module({
  imports: [CirculationModule],
  controllers: [AccountController],
  providers: [AccountService, ListsService],
})
export class AccountModule {}
