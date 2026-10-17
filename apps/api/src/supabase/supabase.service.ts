import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const COVERS_BUCKET = 'covers';
export const EVENTS_BUCKET = 'events';

/**
 * Server-side Supabase client — used for Storage uploads only. Storage still requires a JWT,
 * so this uses the legacy service_role key rather than the newer sb_secret key.
 */
@Injectable()
export class SupabaseService {
  readonly client: SupabaseClient;
  private readonly url: string;

  constructor(config: ConfigService) {
    this.url = config.getOrThrow<string>('SUPABASE_URL');
    this.client = createClient(this.url, config.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async upload(bucket: string, path: string, body: Buffer, contentType: string): Promise<void> {
    const { error } = await this.client.storage
      .from(bucket)
      .upload(path, body, { contentType, upsert: true, cacheControl: '31536000' });
    if (error) throw new Error(`Storage upload failed: ${error.message}`);
  }

  async remove(bucket: string, path: string): Promise<void> {
    const { error } = await this.client.storage.from(bucket).remove([path]);
    if (error) throw new Error(`Storage delete failed: ${error.message}`);
  }

  publicUrl(bucket: string, path: string): string {
    return `${this.url}/storage/v1/object/public/${bucket}/${path}`;
  }
}
