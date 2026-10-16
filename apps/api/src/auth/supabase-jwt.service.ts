import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

export interface SupabaseClaims {
  sub: string;
  email?: string;
}

/**
 * Verifies access tokens issued by Supabase Auth. The project signs with asymmetric keys,
 * so verification only needs the public JWKS — no shared secret on the API.
 */
@Injectable()
export class SupabaseJwtService {
  private readonly issuer: string;
  private readonly keys: JWTVerifyGetKey;

  constructor(config: ConfigService) {
    const supabaseUrl = config.getOrThrow<string>('SUPABASE_URL');
    this.issuer = `${supabaseUrl}/auth/v1`;
    this.keys = createRemoteJWKSet(new URL(`${this.issuer}/.well-known/jwks.json`));
  }

  async verify(token: string): Promise<SupabaseClaims> {
    const { payload } = await jwtVerify(token, this.keys, {
      issuer: this.issuer,
      audience: 'authenticated',
    });
    if (typeof payload.sub !== 'string') throw new Error('Token has no subject');
    return { sub: payload.sub, email: typeof payload.email === 'string' ? payload.email : undefined };
  }
}
