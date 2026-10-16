import { Body, Controller, Get, Header, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import {
  checkoutSchema,
  deskLookupSchema,
  returnSchema,
  updateSettingsSchema,
  waiveFineSchema,
  type CheckoutInput,
  type ReturnInput,
  type UpdateSettingsInput,
} from '@mybook/shared';
import { z } from 'zod';
import { CurrentUser, MinRole } from '../auth/auth.decorators.js';
import type { AuthUser } from '../auth/auth.types.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { CirculationService } from './circulation.service.js';
import { DeskService } from './desk.service.js';
import { ReportsService } from './reports.service.js';
import { SettingsService } from './settings.service.js';

const popularSchema = z.object({
  days: z.coerce.number().int().min(1).max(3650).default(90),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

@Controller('admin')
@MinRole('LIBRARIAN')
export class DeskController {
  constructor(
    private readonly circulation: CirculationService,
    private readonly desk: DeskService,
    private readonly reports: ReportsService,
    private readonly settings: SettingsService,
  ) {}

  // ─── Circulation desk ──────────────────────────────────────────────────────

  @Get('desk/lookup')
  lookup(@Query(new ZodValidationPipe(deskLookupSchema)) query: z.infer<typeof deskLookupSchema>) {
    return this.desk.lookup(query.q);
  }

  @Get('desk/members/:id')
  member(@Param('id', ParseUUIDPipe) id: string) {
    return this.desk.member(id);
  }

  @Post('desk/checkout')
  checkout(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(checkoutSchema)) body: CheckoutInput) {
    return this.circulation.checkout(user, body.memberId, body.barcode);
  }

  @Post('desk/return')
  @HttpCode(200)
  returnCopy(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(returnSchema)) body: ReturnInput) {
    return this.circulation.returnCopy(user, body.barcode);
  }

  // ─── Fines ─────────────────────────────────────────────────────────────────

  @Post('fines/:id/pay')
  @HttpCode(200)
  pay(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.desk.payFine(user, id);
  }

  @Post('fines/:id/waive')
  @HttpCode(200)
  waive(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(waiveFineSchema)) body: z.infer<typeof waiveFineSchema>,
  ) {
    return this.desk.waiveFine(user, id, body.note);
  }

  // ─── Reports ───────────────────────────────────────────────────────────────

  @Get('reports/dashboard')
  dashboard() {
    return this.reports.dashboard();
  }

  @Get('reports/overdue')
  overdue() {
    return this.reports.overdue();
  }

  @Get('reports/overdue.csv')
  @Header('content-type', 'text/csv; charset=utf-8')
  @Header('content-disposition', 'attachment; filename="overdue-loans.csv"')
  overdueCsv() {
    return this.reports.overdueCsv();
  }

  @Get('reports/popular')
  popular(@Query(new ZodValidationPipe(popularSchema)) query: z.infer<typeof popularSchema>) {
    return this.reports.popular(query.days, query.limit);
  }

  // ─── Settings ──────────────────────────────────────────────────────────────

  @Get('settings')
  getSettings() {
    return this.settings.get();
  }

  @Patch('settings')
  @MinRole('ADMIN')
  updateSettings(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(updateSettingsSchema)) body: UpdateSettingsInput) {
    return this.settings.update(body, user);
  }
}
