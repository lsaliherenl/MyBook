import { HttpException, HttpStatus } from '@nestjs/common';
import type { CirculationError } from '@mybook/shared';

const NOT_FOUND: CirculationError[] = ['book_not_found', 'copy_not_found', 'reservation_not_found', 'loan_not_found'];

/** A refused circulation action. The body carries a stable `code` the web app translates. */
export class CirculationException extends HttpException {
  constructor(
    readonly code: CirculationError,
    readonly details: Record<string, unknown> = {},
  ) {
    super(
      { statusCode: NOT_FOUND.includes(code) ? 404 : 409, error: 'Circulation', code, message: code, ...details },
      NOT_FOUND.includes(code) ? HttpStatus.NOT_FOUND : HttpStatus.CONFLICT,
    );
  }
}
