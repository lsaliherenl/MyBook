import { Module } from '@nestjs/common';
import { CirculationModule } from '../circulation/circulation.module.js';
import { ImportModule } from '../import/import.module.js';
import { BooksAdminController } from './books-admin.controller.js';
import { BooksAdminService } from './books-admin.service.js';

@Module({
  imports: [ImportModule, CirculationModule],
  controllers: [BooksAdminController],
  providers: [BooksAdminService],
})
export class BooksModule {}
