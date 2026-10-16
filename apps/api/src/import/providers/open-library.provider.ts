import { Injectable } from '@nestjs/common';
import type { ExternalBookCandidate } from '@mybook/shared';
import { getJson } from '../http.js';
import type { BookMetadataProvider } from './provider.js';

interface OpenLibraryDoc {
  key: string;
  title?: string;
  subtitle?: string;
  author_name?: string[];
  publisher?: string[];
  first_publish_year?: number;
  number_of_pages_median?: number;
  language?: string[];
  subject?: string[];
  isbn?: string[];
  cover_i?: number;
}

const LANGUAGE_CODES: Record<string, string> = {
  tur: 'tr', eng: 'en', ger: 'de', fre: 'fr', spa: 'es', ita: 'it', rus: 'ru', ara: 'ar', per: 'fa', jpn: 'ja',
};

const FIELDS = 'key,title,subtitle,author_name,publisher,first_publish_year,number_of_pages_median,language,subject,isbn,cover_i';

/** Open data, decent for pages and publishers; slow to connect from Turkey and has no descriptions in search. */
@Injectable()
export class OpenLibraryProvider implements BookMetadataProvider {
  readonly id = 'OPEN_LIBRARY' as const;
  readonly timeoutMs = 35_000;

  async search(query: string, limit: number) {
    const res = await this.searchDocs(`q=${encodeURIComponent(query)}`, limit);
    return res.map((doc) => this.toCandidate(doc, null));
  }

  async findByIsbn(isbn: string) {
    const res = await this.searchDocs(`isbn=${isbn}`, 3);
    return res.map((doc) => this.toCandidate(doc, isbn));
  }

  private async searchDocs(params: string, limit: number) {
    const url = `https://openlibrary.org/search.json?${params}&fields=${FIELDS}&limit=${limit}`;
    const res = await getJson<{ docs?: OpenLibraryDoc[] }>(url, { timeoutMs: this.timeoutMs, attempts: 2 });
    return (res.docs ?? []).filter((d) => d.title);
  }

  private toCandidate(doc: OpenLibraryDoc, isbn: string | null): ExternalBookCandidate {
    // A work lists the ISBNs of all its editions, so an ISBN is only reported when it was searched for.
    const language = doc.language?.length === 1 ? (LANGUAGE_CODES[doc.language[0]] ?? null) : null;
    return {
      provider: this.id,
      externalId: doc.key.replace('/works/', ''),
      title: doc.title!,
      subtitle: doc.subtitle ?? null,
      authors: doc.author_name ?? [],
      publisher: doc.publisher?.[0] ?? null,
      publishedYear: doc.first_publish_year ?? null,
      pageCount: doc.number_of_pages_median ?? null,
      language,
      description: null,
      isbn13: isbn?.length === 13 ? isbn : null,
      isbn10: isbn?.length === 10 ? isbn : null,
      rawCategories: doc.subject?.slice(0, 8) ?? [],
      covers: doc.cover_i
        ? [{ provider: this.id, url: `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`, width: null, height: null }]
        : [],
    };
  }
}
