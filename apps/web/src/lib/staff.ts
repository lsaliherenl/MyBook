import "server-only";
import { cache } from "react";
import type { ProfileDto } from "@mybook/shared";
import { api } from "./api";

/** The signed-in user's profile, fetched once per request (layout, top bar and pages share it). */
export const getStaff = cache(() => api<ProfileDto>("/me", { auth: true }));

export const isStaff = (profile: ProfileDto) => profile.role === "LIBRARIAN" || profile.role === "ADMIN";
