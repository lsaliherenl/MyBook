import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { importBookSchema, importSearchSchema, type ImportBookInput, type ImportSearchInput } from '@mybook/shared';
import { CurrentUser, MinRole } from '../auth/auth.decorators.js';
import type { AuthUser } from '../auth/auth.types.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { ImportService } from './import.service.js';

@Controller('admin')
@MinRole('LIBRARIAN')
export class ImportController {
  constructor(private readonly imports: ImportService) {}

  /** GET /api/admin/import/search?isbn=9789750747502 or ?q=şeker portakalı */
  @Get('import/search')
  search(@Query(new ZodValidationPipe(importSearchSchema)) query: ImportSearchInput) {
    return this.imports.search(query);
  }

  @Post('books/import')
  importBook(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(importBookSchema)) body: ImportBookInput) {
    return this.imports.importBook(body, user);
  }
}
