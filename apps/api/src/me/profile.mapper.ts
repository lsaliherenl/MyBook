import { withDefaultPrefs, type ProfileDto } from '@mybook/shared';
import type { Profile } from '../generated/prisma/client.js';

export function toProfileDto(p: Profile): ProfileDto {
  return {
    id: p.id,
    email: p.email,
    fullName: p.fullName,
    memberType: p.memberType,
    studentNumber: p.studentNumber,
    faculty: p.faculty,
    phone: p.phone,
    role: p.role,
    status: p.status,
    cardNumber: p.cardNumber,
    locale: p.locale,
    avatarUrl: p.avatarUrl,
    notificationPrefs: withDefaultPrefs(p.notificationPrefs),
    createdAt: p.createdAt.toISOString(),
  };
}
