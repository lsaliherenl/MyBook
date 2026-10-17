import { Controller, Get, Param, Query } from '@nestjs/common';
import { catalogQuerySchema, popularBooksQuerySchema, type CatalogQuery, type PopularBooksQuery } from '@mybook/shared';
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

  // Declared before books/:slug so "facets" and "popular" are not read as a slug.
  @Get('books/facets')
  facets(@Query(new ZodValidationPipe(catalogQuerySchema)) query: CatalogQuery) {
    return this.catalog.facets(query);
  }

  @Get('books/popular')
  popular(@Query(new ZodValidationPipe(popularBooksQuerySchema)) query: PopularBooksQuery) {
    return this.catalog.popular(query);
  }

  @Get('books/:slug')
  detail(@Param('slug') slug: string) {
    return this.catalog.detail(slug);
  }

  @Get('books/:slug/related')
  related(@Param('slug') slug: string) {
    return this.catalog.related(slug);
  }

  @Get('collections/:slug')
  collection(@Param('slug') slug: string) {
    return this.catalog.collection(slug);
  }

  @Get('categories')
  categories() {
    return this.catalog.categories();
  }
}
