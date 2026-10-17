import { Bell, BookOpen, Bookmark, Clock, Coffee, Mic, PenLine, Sparkles, Users, type LucideIcon } from "lucide-react";
import type { EventKind } from "@mybook/shared";

/** Icons that pop in on hover for each kind of event (filters and rows). */
export const EVENT_ICONS: Record<EventKind, LucideIcon[]> = {
  BOOK_CLUB: [Coffee, BookOpen],
  WORKSHOP: [PenLine, Bookmark],
  TALK: [Mic, Users],
  NOTICE: [Bell, Clock],
};

export const ALL_EVENTS_ICON = Sparkles;
