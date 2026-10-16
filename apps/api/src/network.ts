import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Agent, setGlobalDispatcher } from 'undici';

// Entry points import this module first, before ConfigModule has read the root .env.
const rootEnv = resolve(process.cwd(), '../../.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

/**
 * Some networks answer IPv6 (AAAA) DNS queries very slowly, which makes every new outgoing
 * connection take ~12 s and trips fetch's connect timeout. FORCE_IPV4=true in .env makes all
 * fetch() calls (Supabase, JWKS, book providers) resolve and connect over IPv4 only.
 */
export const FORCE_IPV4 = process.env.FORCE_IPV4 === 'true';

if (FORCE_IPV4) {
  setGlobalDispatcher(new Agent({ connect: { family: 4, timeout: 30_000 } }));
}
