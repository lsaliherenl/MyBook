import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { Role } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { IS_PUBLIC_KEY, ROLES_KEY } from './auth.decorators.js';
import { ROLE_RANK, type AuthUser } from './auth.types.js';
import { SupabaseJwtService } from './supabase-jwt.service.js';

/**
 * Global guard: every route needs a valid Supabase access token unless marked @Public().
 * The role comes from our `profiles` table, never from the token, so a role change applies immediately.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: SupabaseJwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets) ?? false;
    const minRole = this.reflector.getAllAndOverride<Role | undefined>(ROLES_KEY, targets);

    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const token = this.extractToken(request);

    if (!token) {
      if (isPublic) return true;
      throw new UnauthorizedException('Missing access token');
    }

    const user = await this.authenticate(token);
    if (!user) {
      if (isPublic) return true;
      throw new UnauthorizedException('Invalid or expired access token');
    }
    request.user = user;

    if (minRole && ROLE_RANK[user.role] < ROLE_RANK[minRole]) {
      throw new ForbiddenException('Insufficient role');
    }
    return true;
  }

  private extractToken(request: Request): string | null {
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
    return scheme?.toLowerCase() === 'bearer' && token ? token : null;
  }

  private async authenticate(token: string): Promise<AuthUser | null> {
    let sub: string;
    try {
      ({ sub } = await this.jwt.verify(token));
    } catch {
      return null;
    }
    const profile = await this.prisma.profile.findUnique({
      where: { id: sub },
      select: { id: true, email: true, role: true, status: true },
    });
    return profile;
  }
}
