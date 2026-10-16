import type { AccountStatus, Role } from '../generated/prisma/enums.js';

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  status: AccountStatus;
}

export const ROLE_RANK: Record<Role, number> = { MEMBER: 0, LIBRARIAN: 1, ADMIN: 2 };
