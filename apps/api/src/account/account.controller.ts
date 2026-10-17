import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { readingListNameSchema, type ReadingListNameInput } from '@mybook/shared';
import { z } from 'zod';
import { CurrentUser } from '../auth/auth.decorators.js';
import type { AuthUser } from '../auth/auth.types.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { AccountService } from './account.service.js';
import { ListsService } from './lists.service.js';

const yearSchema = z.object({ year: z.coerce.number().int().min(2000).max(2100).optional() });
/** A list's UUID or "favorites". */
const listId = new ZodValidationPipe(z.union([z.literal('favorites'), z.uuid()]));

/** The signed-in member's reading lists, reading history, data export and account closure. */
@Controller('me')
export class AccountController {
  constructor(
    private readonly account: AccountService,
    private readonly lists: ListsService,
  ) {}

  @Get('history')
  history(@CurrentUser() user: AuthUser, @Query(new ZodValidationPipe(yearSchema)) query: z.infer<typeof yearSchema>) {
    return this.account.readingYear(user.id, query.year);
  }

  @Get('export')
  export(@CurrentUser() user: AuthUser) {
    return this.account.exportData(user.id);
  }

  @Post('close')
  @HttpCode(204)
  close(@CurrentUser() user: AuthUser) {
    return this.account.close(user);
  }

  @Get('lists')
  allLists(@CurrentUser() user: AuthUser) {
    return this.lists.all(user.id);
  }

  @Post('lists')
  createList(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(readingListNameSchema)) body: ReadingListNameInput) {
    return this.lists.create(user.id, body.name);
  }

  @Get('lists/containing/:bookId')
  containing(@CurrentUser() user: AuthUser, @Param('bookId', ParseUUIDPipe) bookId: string) {
    return this.lists.containing(user.id, bookId);
  }

  @Get('lists/:id')
  list(@CurrentUser() user: AuthUser, @Param('id', listId) id: string) {
    return this.lists.detail(user.id, id);
  }

  @Patch('lists/:id')
  @HttpCode(204)
  rename(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(readingListNameSchema)) body: ReadingListNameInput) {
    return this.lists.rename(user.id, id, body.name);
  }

  @Delete('lists/:id')
  @HttpCode(204)
  removeList(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.lists.remove(user.id, id);
  }

  @Put('lists/:id/books/:bookId')
  @HttpCode(204)
  addBook(@CurrentUser() user: AuthUser, @Param('id', listId) id: string, @Param('bookId', ParseUUIDPipe) bookId: string) {
    return this.lists.addBook(user.id, id, bookId);
  }

  @Delete('lists/:id/books/:bookId')
  @HttpCode(204)
  removeBook(@CurrentUser() user: AuthUser, @Param('id', listId) id: string, @Param('bookId', ParseUUIDPipe) bookId: string) {
    return this.lists.removeBook(user.id, id, bookId);
  }
}
