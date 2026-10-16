import { Injectable } from '@nestjs/common';
import type { ExternalBookCandidate } from '@mybook/shared';
import { getJson } from '../http.js';
import { stripHtml, yearFrom, type BookMetadataProvider } from './provider.js';

interface AppleEbook {
  trackId: number;
  trackName: string;
  artistName: string;
  releaseDate?: string;
  description?: string;
  genres?: string[];
  artworkUrl100?: string;
}

/** Best covers by far (up to ~2000 px), but ebook editions only and no ISBN, publisher or page count. */
@Injectable()
export class AppleBooksProvider implements BookMetadataProvider {
  readonly id = 'APPLE_BOOKS' as const;
  readonly timeoutMs = 12_000;

  async search(query: string, limit: number) {
    // The Turkish and US stores carry different catalogs; ask both and merge.
    const stores = await Promise.allSettled(['tr', 'us'].map((country) => this.searchStore(query, limit, country)));
    const seen = new Set<string>();
    return stores
      .flatMap((s) => (s.status === 'fulfilled' ? s.value : []))
      .filter((c) => !seen.has(c.externalId) && seen.add(c.externalId))
      .slice(0, limit);
  }

  async findByIsbn(isbn: string) {
    const url = `https://itunes.apple.com/lookup?isbn=${isbn}&entity=ebook`;
    const res = await getJson<{ results?: AppleEbook[] }>(url, { timeoutMs: this.timeoutMs });
    return (res.results ?? []).filter((r) => r.trackName).map((r) => this.toCandidate(r));
  }

  private async searchStore(query: string, limit: number, country: string) {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=ebook&limit=${limit}&country=${country}`;
    const res = await getJson<{ results?: AppleEbook[] }>(url, { timeoutMs: this.timeoutMs });
    return (res.results ?? []).filter((r) => r.trackName).map((r) => this.toCandidate(r));
  }

  private toCandidate(r: AppleEbook): ExternalBookCandidate {
    return {
      provider: this.id,
      externalId: String(r.trackId),
      title: r.trackName,
      subtitle: null,
      authors: r.artistName ? r.artistName.split(/\s*&\s*|\s*,\s*/) : [],
      publisher: null,
      publishedYear: yearFrom(r.releaseDate),
      pageCount: null,
      language: null,
      description: stripHtml(r.description),
      isbn13: null,
      isbn10: null,
      rawCategories: (r.genres ?? []).filter((g) => g !== 'Books' && g !== 'Kitaplar'),
      // The artwork URL encodes a bounding box; 2000x2000 returns the cover at up to 2000 px tall.
      covers: r.artworkUrl100
        ? [{ provider: this.id, url: r.artworkUrl100.replace(/\/100x100bb\.(jpg|png)$/, '/2000x2000bb.jpg'), width: null, height: null }]
        : [],
    };
  }
}
