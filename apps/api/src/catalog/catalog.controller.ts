import { Controller, Get, Param, Query } from '@nestjs/common';
import { catalogQuerySchema, type CatalogQuery } from '@mybook/shared';
import { Public } from '../auth/auth.decorators.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { CatalogService } from './catalog.service.js';

@Controller()
@Public()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('books')
  list(@Query(new ZodValidationPipe(catalogQuerySchema)) query: CatalogQuery) {
    return this.catalog.list(query);
  }

  @Get('books/:slug')
  detail(@Param('slug') slug: string) {
    return this.catalog.detail(slug);
  }

  @Get('categories')
  categories() {
    return this.catalog.categories();
  }
}
