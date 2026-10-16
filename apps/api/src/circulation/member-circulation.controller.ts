import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { createReservationsSchema, type CreateReservationsInput } from '@mybook/shared';
import { z } from 'zod';
import { CurrentUser } from '../auth/auth.decorators.js';
import type { AuthUser } from '../auth/auth.types.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { CirculationService } from './circulation.service.js';

const loanFilterSchema = z.object({ status: z.enum(['active', 'history']).optional() });

/** A signed-in member's own reservations, loans and fines. */
@Controller()
export class MemberCirculationController {
  constructor(private readonly circulation: CirculationService) {}

  @Get('me/standing')
  standing(@CurrentUser() user: AuthUser) {
    return this.circulation.standing(user.id);
  }

  @Get('me/reservations')
  reservations(@CurrentUser() user: AuthUser) {
    return this.circulation.reservationsOf(user.id);
  }

  @Get('me/loans')
  loans(@CurrentUser() user: AuthUser, @Query(new ZodValidationPipe(loanFilterSchema)) query: z.infer<typeof loanFilterSchema>) {
    return this.circulation.loansOf(user.id, query.status === undefined ? undefined : query.status === 'active');
  }

  @Get('me/fines')
  fines(@CurrentUser() user: AuthUser) {
    return this.circulation.finesOf(user.id);
  }

  @Post('reservations')
  reserve(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(createReservationsSchema)) body: CreateReservationsInput) {
    return this.circulation.reserve(user, body.bookIds);
  }

  /** Members cancel their own reservations; librarians may cancel anyone's. */
  @Delete('reservations/:id')
  cancel(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.circulation.cancelReservation(user, id);
  }

  @Post('loans/:id/renew')
  @HttpCode(200)
  renew(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.circulation.renew(user, id);
  }
}
