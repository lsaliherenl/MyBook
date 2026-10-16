import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '../generated/prisma/enums.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { IS_PUBLIC_KEY, ROLES_KEY } from './auth.decorators.js';
import { AuthGuard } from './auth.guard.js';
import type { SupabaseJwtService } from './supabase-jwt.service.js';

const MEMBER_ID = '11111111-1111-1111-1111-111111111111';

function setup({ isPublic = false, minRole }: { isPublic?: boolean; minRole?: Role } = {}) {
  const reflector = {
    getAllAndOverride: vi.fn((key: string) => (key === IS_PUBLIC_KEY ? isPublic : key === ROLES_KEY ? minRole : undefined)),
  } as unknown as Reflector;
  const jwt = { verify: vi.fn() } as unknown as SupabaseJwtService & { verify: ReturnType<typeof vi.fn> };
  const prisma = { profile: { findUnique: vi.fn() } } as unknown as PrismaService & {
    profile: { findUnique: ReturnType<typeof vi.fn> };
  };
  const guard = new AuthGuard(reflector, jwt, prisma);

  const request: { headers: Record<string, string>; user?: unknown } = { headers: {} };
  const context = {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;

  const signIn = (role: Role) => {
    request.headers.authorization = 'Bearer token';
    jwt.verify.mockResolvedValue({ sub: MEMBER_ID });
    prisma.profile.findUnique.mockResolvedValue({ id: MEMBER_ID, email: 'ayse@example.edu', role, status: 'ACTIVE' });
  };

  return { guard, context, request, jwt, signIn };
}

describe('AuthGuard', () => {
  it('rejects a protected route without a token', async () => {
    const { guard, context } = setup();
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an invalid token', async () => {
    const { guard, context, request, jwt } = setup();
    request.headers.authorization = 'Bearer forged';
    jwt.verify.mockRejectedValue(new Error('signature verification failed'));
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('lets anyone through a public route and still attaches a signed-in user', async () => {
    const anonymous = setup({ isPublic: true });
    await expect(anonymous.guard.canActivate(anonymous.context)).resolves.toBe(true);
    expect(anonymous.request.user).toBeUndefined();

    const signedIn = setup({ isPublic: true });
    signedIn.signIn('MEMBER');
    await expect(signedIn.guard.canActivate(signedIn.context)).resolves.toBe(true);
    expect(signedIn.request.user).toMatchObject({ id: MEMBER_ID, role: 'MEMBER' });
  });

  it('uses the role from the database, not from the token', async () => {
    const { guard, context, signIn } = setup({ minRole: 'LIBRARIAN' });
    signIn('MEMBER');
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('treats ADMIN as at least LIBRARIAN', async () => {
    const { guard, context, signIn } = setup({ minRole: 'LIBRARIAN' });
    signIn('ADMIN');
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
});
