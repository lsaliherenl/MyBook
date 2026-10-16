/**
 * Gives a signed-up user a role, e.g. to create the first librarian or admin:
 *
 *   pnpm --filter @mybook/api user:role you@example.edu ADMIN
 */
import '../network.js';
import { NestFactory } from '@nestjs/core';
import { ROLES, type Role } from '@mybook/shared';
import { AppModule } from '../app.module.js';
import { PrismaService } from '../prisma/prisma.service.js';

const [email, role] = process.argv.slice(2);
if (!email || !ROLES.includes(role as Role)) {
  console.error(`Usage: user:role <email> <${ROLES.join('|')}>`);
  process.exit(1);
}

const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
const prisma = app.get(PrismaService);
const profile = await prisma.profile.findUnique({ where: { email } });
if (!profile) {
  console.error(`No profile for ${email}. Sign up first, then run this again.`);
} else {
  await prisma.profile.update({ where: { id: profile.id }, data: { role: role as Role } });
  await prisma.auditLog.create({
    data: { action: 'member.role', entityType: 'profile', entityId: profile.id, data: { role, via: 'cli' } },
  });
  console.log(`${email}: ${profile.role} → ${role}`);
}
await app.close();
