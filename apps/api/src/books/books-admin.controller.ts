import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import {
  addCopiesSchema,
  adminBooksQuerySchema,
  bulkBooksSchema,
  importIsbnSchema,
  replaceCoverSchema,
  updateBookSchema,
  updateCopySchema,
  type AddCopiesInput,
  type AdminBooksQuery,
  type BulkBooksInput,
  type UpdateBookInput,
  type UpdateCopyInput,
} from '@mybook/shared';
import type { z } from 'zod';
import { CurrentUser, MinRole } from '../auth/auth.decorators.js';
import type { AuthUser } from '../auth/auth.types.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { BooksAdminService } from './books-admin.service.js';

@Controller('admin')
@MinRole('LIBRARIAN')
export class BooksAdminController {
  constructor(private readonly books: BooksAdminService) {}

  @Get('books')
  list(@Query(new ZodValidationPipe(adminBooksQuerySchema)) query: AdminBooksQuery) {
    return this.books.list(query);
  }

  @Get('books.csv')
  @Header('content-type', 'text/csv; charset=utf-8')
  @Header('content-disposition', 'attachment; filename="books.csv"')
  csv(@Query(new ZodValidationPipe(adminBooksQuerySchema)) query: AdminBooksQuery) {
    return this.books.listCsv(query);
  }

  @Patch('books/bulk')
  bulk(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(bulkBooksSchema)) body: BulkBooksInput) {
    return this.books.bulk(user, body);
  }

  @Post('books/import-isbn')
  importIsbn(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(importIsbnSchema)) body: z.infer<typeof importIsbnSchema>) {
    return this.books.importIsbn(user, body);
  }

  @Get('books/:id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.books.get(id);
  }

  @Patch('books/:id')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(updateBookSchema)) body: UpdateBookInput) {
    return this.books.update(user, id, body);
  }

  @Get('books/:id/activity')
  activity(@Param('id', ParseUUIDPipe) id: string) {
    return this.books.activity(id);
  }

  @Post('books/:id/copies')
  addCopies(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(addCopiesSchema)) body: AddCopiesInput) {
    return this.books.addCopies(user, id, body);
  }

  @Patch('books/:id/cover')
  replaceCover(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(replaceCoverSchema)) body: z.infer<typeof replaceCoverSchema>,
  ) {
    return this.books.replaceCover(user, id, body.url, body.provider);
  }

  @Patch('copies/:id')
  updateCopy(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(updateCopySchema)) body: UpdateCopyInput) {
    return this.books.updateCopy(user, id, body);
  }

  @Get('copies/:id/history')
  history(@Param('id', ParseUUIDPipe) id: string) {
    return this.books.copyHistory(id);
  }
}
