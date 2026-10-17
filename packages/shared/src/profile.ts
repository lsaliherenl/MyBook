import { z } from 'zod';
import { notificationPrefsSchema, type NotificationPrefs } from './account.js';
import { LOCALES } from './locale.js';

export const ROLES = ['MEMBER', 'LIBRARIAN', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

export const MEMBER_TYPES = ['STUDENT', 'ACADEMIC', 'STAFF'] as const;
export type MemberType = (typeof MEMBER_TYPES)[number];

/** Fields a member may change on their own profile; name and student number come from the university. */
export const updateProfileSchema = z
  .object({
    faculty: z.string().trim().max(120).nullable(),
    phone: z
      .string()
      .trim()
      .regex(/^\+?[0-9 ()-]{7,20}$/)
      .nullable(),
    locale: z.enum(LOCALES),
    notificationPrefs: notificationPrefsSchema,
  })
  .partial();
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

/** At least 10 characters with one digit; 72 is bcrypt's limit in Supabase Auth. */
export const passwordSchema = z.string().min(10).max(72).regex(/[0-9]/);

/** Sign-up metadata stored in Supabase Auth and copied into the profile by a database trigger. */
export const signUpSchema = z.object({
  email: z.email(),
  password: passwordSchema,
  fullName: z.string().trim().min(2).max(120),
  memberType: z.enum(MEMBER_TYPES),
  studentNumber: z
    .string()
    .trim()
    .regex(/^[0-9]{6,12}$/)
    .optional()
    .or(z.literal('')),
  faculty: z.string().trim().max(120).optional(),
  locale: z.enum(LOCALES),
});
export type SignUpInput = z.infer<typeof signUpSchema>;

export const updateRoleSchema = z.object({ role: z.enum(ROLES) });

export interface ProfileDto {
  id: string;
  email: string;
  fullName: string;
  memberType: MemberType;
  studentNumber: string | null;
  faculty: string | null;
  phone: string | null;
  role: Role;
  status: 'ACTIVE' | 'BLOCKED';
  cardNumber: string;
  locale: (typeof LOCALES)[number];
  avatarUrl: string | null;
  notificationPrefs: NotificationPrefs;
  createdAt: string;
}
