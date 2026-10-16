import type { ConfigService } from '@nestjs/config';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWK } from 'jose';
import { SupabaseJwtService } from './supabase-jwt.service.js';

const SUPABASE_URL = 'https://example.supabase.co';
const ISSUER = `${SUPABASE_URL}/auth/v1`;

async function setup() {
  const { publicKey, privateKey } = await generateKeyPair('ES256');
  const jwk: JWK = { ...(await exportJWK(publicKey)), kid: 'test-key', alg: 'ES256' };
  const service = new SupabaseJwtService({ getOrThrow: () => SUPABASE_URL } as unknown as ConfigService);
  // Swap the remote JWKS for a local one holding the test key.
  (service as unknown as { keys: unknown }).keys = createLocalJWKSet({ keys: [jwk] });

  const sign = (claims: Record<string, unknown>, { issuer = ISSUER, audience = 'authenticated', expiresIn = '1h' } = {}) =>
    new SignJWT(claims)
      .setProtectedHeader({ alg: 'ES256', kid: 'test-key' })
      .setIssuer(issuer)
      .setAudience(audience)
      .setIssuedAt()
      .setExpirationTime(expiresIn)
      .sign(privateKey);

  return { service, sign };
}

describe('SupabaseJwtService', () => {
  it('accepts a valid Supabase access token', async () => {
    const { service, sign } = await setup();
    const token = await sign({ sub: 'user-1', email: 'ayse@example.edu', role: 'authenticated' });
    await expect(service.verify(token)).resolves.toEqual({ sub: 'user-1', email: 'ayse@example.edu' });
  });

  it('rejects tokens from another project', async () => {
    const { service, sign } = await setup();
    const token = await sign({ sub: 'user-1' }, { issuer: 'https://other.supabase.co/auth/v1' });
    await expect(service.verify(token)).rejects.toThrow();
  });

  it('rejects anonymous-key tokens (wrong audience)', async () => {
    const { service, sign } = await setup();
    const token = await sign({ sub: 'user-1' }, { audience: 'anon' });
    await expect(service.verify(token)).rejects.toThrow();
  });

  it('rejects expired tokens', async () => {
    const { service, sign } = await setup();
    const token = await sign({ sub: 'user-1' }, { expiresIn: '-1m' });
    await expect(service.verify(token)).rejects.toThrow();
  });
});
