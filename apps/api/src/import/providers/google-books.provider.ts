import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ExternalBookCandidate } from '@mybook/shared';
import { getJson } from '../http.js';
import { stripHtml, yearFrom, type BookMetadataProvider } from './provider.js';

interface GoogleVolume {
  id: string;
  volumeInfo: {
    title?: string;
    subtitle?: string;
    authors?: string[];
    publisher?: string;
    publishedDate?: string;
    pageCount?: number;
    language?: string;
    description?: string;
    categories?: string[];
    industryIdentifiers?: { type: string; identifier: string }[];
    imageLinks?: Record<string, string>;
  };
}

/** Best for Turkish editions and metadata; covers are only good when Google has a scan. */
@Injectable()
export class GoogleBooksProvider implements BookMetadataProvider {
  readonly id = 'GOOGLE_BOOKS' as const;
  readonly timeoutMs = 15_000;
  /** Optional: without a key Google still answers, from a smaller shared quota. */
  private readonly key: string | undefined;

  constructor(config: ConfigService) {
    this.key = config.get<string>('GOOGLE_BOOKS_API_KEY') || undefined;
  }

  search(query: string, limit: number) {
    return this.volumes(query, limit);
  }

  findByIsbn(isbn: string) {
    return this.volumes(`isbn:${isbn}`, 5);
  }

  private async volumes(q: string, limit: number): Promise<ExternalBookCandidate[]> {
    const url =
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}` +
      `&maxResults=${limit}&printType=books` +
      (this.key ? `&key=${this.key}` : '');
    const res = await getJson<{ items?: GoogleVolume[] }>(url, { timeoutMs: this.timeoutMs, attempts: 4 });
    return (res.items ?? []).filter((v) => v.volumeInfo.title).map((v) => this.toCandidate(v));
  }

  private toCandidate({ id, volumeInfo: v }: GoogleVolume): ExternalBookCandidate {
    const isbn = (type: string) => v.industryIdentifiers?.find((x) => x.type === type)?.identifier ?? null;
    // Without imageLinks Google only has an "image not available" placeholder, so no candidate is offered.
    // With them, the fife parameter asks for a large rendition of the same scan.
    const thumb = v.imageLinks?.thumbnail ?? v.imageLinks?.smallThumbnail;
    const covers = thumb
      ? [
          {
            provider: this.id,
            url: thumb.replace(/^http:/, 'https:').replace('&edge=curl', '').replace(/&zoom=\d/, '&zoom=1') + '&fife=w1200',
            width: null,
            height: null,
          },
        ]
      : [];

    return {
      provider: this.id,
      externalId: id,
      title: v.title!,
      subtitle: v.subtitle ?? null,
      authors: v.authors ?? [],
      publisher: v.publisher ?? null,
      publishedYear: yearFrom(v.publishedDate),
      pageCount: v.pageCount || null,
      language: v.language?.slice(0, 2) ?? null,
      description: stripHtml(v.description),
      isbn13: isbn('ISBN_13'),
      isbn10: isbn('ISBN_10'),
      rawCategories: v.categories ?? [],
      covers,
    };
  }
}
