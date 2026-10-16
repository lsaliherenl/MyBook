import { Inject, Injectable, Logger } from '@nestjs/common';
import { foldForSearch, type BookProvider, type ExternalBookCandidate } from '@mybook/shared';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { BOOK_PROVIDERS_TOKEN, type BookMetadataProvider } from './providers/provider.js';

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type ProviderResult =
  | { provider: BookProvider; ok: true; candidates: ExternalBookCandidate[] }
  | { provider: BookProvider; ok: false; message: string };

/**
 * Asks every provider in parallel and caches the answers in `external_lookup_cache`, so
 * repeated lookups are instant and a provider outage falls back to the last good answer.
 */
@Injectable()
export class BookSourceService {
  private readonly logger = new Logger(BookSourceService.name);

  constructor(
    @Inject(BOOK_PROVIDERS_TOKEN) private readonly providers: BookMetadataProvider[],
    private readonly prisma: PrismaService,
  ) {}

  search(query: string, limit = 8, only?: BookProvider[]): Promise<ProviderResult[]> {
    return this.fanOut(`q:${foldForSearch(query)}`, only, (p) => p.search(query, limit));
  }

  findByIsbn(isbn: string, only?: BookProvider[]): Promise<ProviderResult[]> {
    return this.fanOut(`isbn:${isbn}`, only, (p) => p.findByIsbn(isbn));
  }

  private fanOut(
    key: string,
    only: BookProvider[] | undefined,
    call: (p: BookMetadataProvider) => Promise<ExternalBookCandidate[]>,
  ): Promise<ProviderResult[]> {
    const selected = only ? this.providers.filter((p) => only.includes(p.id)) : this.providers;
    return Promise.all(selected.map((p) => this.cached(p, key, () => call(p))));
  }

  private async cached(
    provider: BookMetadataProvider,
    query: string,
    fetchFresh: () => Promise<ExternalBookCandidate[]>,
  ): Promise<ProviderResult> {
    const where = { provider_query: { provider: provider.id, query } };
    const hit = await this.prisma.externalLookupCache.findUnique({ where });
    if (hit && Date.now() - hit.fetchedAt.getTime() < CACHE_TTL_MS) {
      return { provider: provider.id, ok: true, candidates: hit.response as unknown as ExternalBookCandidate[] };
    }

    try {
      const candidates = await withTimeout(fetchFresh(), provider.timeoutMs + 2_000);
      const response = candidates as unknown as Prisma.InputJsonValue;
      await this.prisma.externalLookupCache.upsert({
        where,
        create: { provider: provider.id, query, response },
        update: { response, fetchedAt: new Date() },
      });
      return { provider: provider.id, ok: true, candidates };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`${provider.id} failed for "${query}": ${message}`);
      if (hit) return { provider: provider.id, ok: true, candidates: hit.response as unknown as ExternalBookCandidate[] };
      return { provider: provider.id, ok: false, message };
    }
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}
