import { Controller, Get, Inject, Param, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { integrationIdSchema, type IntegrationDto, type IntegrationTestDto } from '@mybook/shared';
import type { z } from 'zod';
import { MinRole } from '../auth/auth.decorators.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { BOOK_PROVIDERS_TOKEN, type BookMetadataProvider } from './providers/provider.js';

/** B20 "Integrations": which outside services are set up, and a live test of each. */
@Controller('admin/integrations')
@MinRole('LIBRARIAN')
export class IntegrationsController {
  constructor(
    @Inject(BOOK_PROVIDERS_TOKEN) private readonly providers: BookMetadataProvider[],
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  list(): IntegrationDto[] {
    return [
      ...this.providers.map((p) => ({
        id: p.id,
        kind: 'books' as const,
        // Only Google Books needs a key; the other sources are open.
        configured: p.id !== 'GOOGLE_BOOKS' || Boolean(this.config.get<string>('GOOGLE_BOOKS_API_KEY')),
      })),
      { id: 'SUPABASE', kind: 'platform', configured: Boolean(this.config.get<string>('SUPABASE_URL')) },
    ];
  }

  /** One real request: a title search at the book source (no cache), or a database round trip. */
  @Post(':id/test')
  async test(@Param('id', new ZodValidationPipe(integrationIdSchema)) id: z.infer<typeof integrationIdSchema>): Promise<IntegrationTestDto> {
    const started = Date.now();
    try {
      if (id === 'SUPABASE') {
        const [row] = await this.prisma.$queryRaw<{ books: bigint }[]>`SELECT count(*) AS books FROM books`;
        return { id, ok: true, ms: Date.now() - started, count: Number(row.books), error: null };
      }
      const provider = this.providers.find((p) => p.id === id)!;
      const found = await provider.search('Kürk Mantolu Madonna', 3);
      return { id, ok: found.length > 0, ms: Date.now() - started, count: found.length, error: null };
    } catch (error) {
      return { id, ok: false, ms: Date.now() - started, count: null, error: error instanceof Error ? error.message.slice(0, 200) : String(error) };
    }
  }
}
