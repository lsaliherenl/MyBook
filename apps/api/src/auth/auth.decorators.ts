import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Role } from '../generated/prisma/enums.js';
import type { AuthUser } from './auth.types.js';

export const IS_PUBLIC_KEY = 'isPublic';
export const ROLES_KEY = 'roles';

/** Skips authentication; a signed-in user is still attached to the request when a token is sent. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Lowest role allowed: LIBRARIAN also admits ADMIN. */
export const MinRole = (role: Role) => SetMetadata(ROLES_KEY, role);

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser | undefined => {
  return ctx.switchToHttp().getRequest<{ user?: AuthUser }>().user;
});
