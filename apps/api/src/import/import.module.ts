import { Module } from '@nestjs/common';
import { BookSourceService } from './book-source.service.js';
import { CoverService } from './cover.service.js';
import { ImportController } from './import.controller.js';
import { ImportService } from './import.service.js';
import { AppleBooksProvider } from './providers/apple-books.provider.js';
import { GoogleBooksProvider } from './providers/google-books.provider.js';
import { OpenLibraryProvider } from './providers/open-library.provider.js';
import { BOOK_PROVIDERS_TOKEN, type BookMetadataProvider } from './providers/provider.js';

@Module({
  controllers: [ImportController],
  providers: [
    GoogleBooksProvider,
    OpenLibraryProvider,
    AppleBooksProvider,
    {
      provide: BOOK_PROVIDERS_TOKEN,
      useFactory: (...providers: BookMetadataProvider[]) => providers,
      inject: [GoogleBooksProvider, OpenLibraryProvider, AppleBooksProvider],
    },
    BookSourceService,
    CoverService,
    ImportService,
  ],
  exports: [ImportService, BookSourceService, CoverService],
})
export class ImportModule {}
