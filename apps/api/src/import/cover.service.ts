import { BadRequestException, Injectable } from '@nestjs/common';
import type { BookProvider } from '@mybook/shared';
import { COVERS_BUCKET, SupabaseService } from '../supabase/supabase.service.js';
import { getBuffer } from './http.js';
import { readImageInfo } from './image-size.js';

// Covers are only fetched from the book providers' image hosts, never from arbitrary URLs.
const ALLOWED_HOSTS = [/^books\.google\.com$/, /^books\.googleusercontent\.com$/, /^covers\.openlibrary\.org$/, /^is\d+-ssl\.mzstatic\.com$/];

const MIN_WIDTH = 250;
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_ASPECT = 0.85;

export interface StoredCover {
  path: string;
  width: number;
  height: number;
}

/** Downloads a chosen cover, checks it is a real cover image and copies it into Supabase Storage. */
@Injectable()
export class CoverService {
  constructor(private readonly supabase: SupabaseService) {}

  async store(bookId: string, url: string, provider: BookProvider): Promise<StoredCover> {
    const host = new URL(url).hostname;
    if (!ALLOWED_HOSTS.some((h) => h.test(host))) throw new BadRequestException(`Covers from ${host} are not allowed`);

    const { body } = await getBuffer(url, { timeoutMs: 45_000, attempts: 2 });
    if (body.length > MAX_BYTES) throw new BadRequestException('Cover image is larger than 5 MB');
    const info = readImageInfo(body);
    if (!info) throw new BadRequestException('Cover is not a JPEG, PNG, GIF or WebP image');
    if (info.width < MIN_WIDTH) throw new BadRequestException(`Cover is too small (${info.width}px wide)`);
    // Book covers are portrait; a square image is a cover padded with blank space (some Apple artwork).
    if (info.width / info.height > MAX_ASPECT) throw new BadRequestException('Cover image is padded to a square');
    // Google's "image not available" placeholder is a small PNG; real scans are JPEG.
    if (provider === 'GOOGLE_BOOKS' && info.type === 'png' && body.length < 20_000) {
      throw new BadRequestException('Google Books has no cover for this edition');
    }

    const ext = info.type === 'jpeg' ? 'jpg' : info.type;
    // A new path per upload, so a replaced cover is never served from a stale CDN cache.
    const path = `${bookId}/${Date.now()}.${ext}`;
    await this.supabase.upload(COVERS_BUCKET, path, body, `image/${info.type}`);
    return { path, width: info.width, height: info.height };
  }
}
