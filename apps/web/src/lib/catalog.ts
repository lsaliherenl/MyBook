import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type {
  BookDetailDto,
  CatalogFacetsDto,
  BookSummaryDto,
  CategoryDto,
  CollectionDto,
  CollectionSummaryDto,
  EventDetailDto,
  EventDto,
  LibrarySettingsDto,
  Paginated,
  PopularBookDto,
} from "@mybook/shared";
import { DEFAULT_LIBRARY_RULES } from "@mybook/shared";
import { api } from "./api";

/*
 * Public catalog reads, cached across requests. Availability changes with every checkout, so lists are
 * cached for minutes; anything that must be exact (the borrow bag, the reservation itself) reads uncached.
 * A failing API yields null/[] so a page can still render its static parts.
 */

export async function getCollections(): Promise<CollectionSummaryDto[] | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog", "collections");
  return api<CollectionSummaryDto[]>("/collections").catch(() => null);
}

export async function getCollection(slug: string): Promise<CollectionDto | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog", `collection:${slug}`);
  return api<CollectionDto>(`/collections/${encodeURIComponent(slug)}`).catch(() => null);
}

export async function getBooks(query: Record<string, string | number | boolean | undefined>): Promise<Paginated<BookSummaryDto> | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog");
  return api<Paginated<BookSummaryDto>>(`/books?${toSearch(query)}`).catch(() => null);
}

export async function getFacets(query: Record<string, string | number | boolean | undefined>): Promise<CatalogFacetsDto | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog");
  return api<CatalogFacetsDto>(`/books/facets?${toSearch(query)}`).catch(() => null);
}

export async function getBook(slug: string): Promise<BookDetailDto | null> {
  "use cache";
  cacheLife("seconds");
  cacheTag("catalog", `book:${slug}`);
  return api<BookDetailDto>(`/books/${encodeURIComponent(slug)}`).catch(() => null);
}

export async function getPopularBooks(days: number, limit: number): Promise<PopularBookDto[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog");
  return api<PopularBookDto[]>(`/books/popular?days=${days}&limit=${limit}`).catch(() => []);
}

export async function getCategories(): Promise<CategoryDto[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("categories");
  return api<CategoryDto[]>("/categories").catch(() => []);
}

export async function getEvents(when: "upcoming" | "past", limit = 20): Promise<EventDto[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("events");
  return api<EventDto[]>(`/events?when=${when}&limit=${limit}`).catch(() => []);
}

export async function getEvent(slug: string): Promise<EventDetailDto | null> {
  "use cache";
  cacheLife("seconds");
  cacheTag("events", `event:${slug}`);
  return api<EventDetailDto>(`/events/${encodeURIComponent(slug)}`).catch(() => null);
}

/** Loan days, limits and fines as the librarian configured them; falls back to the documented defaults. */
export async function getRules(): Promise<LibrarySettingsDto> {
  "use cache";
  cacheLife("hours");
  cacheTag("rules");
  return api<LibrarySettingsDto>("/rules").catch(() => ({ ...DEFAULT_LIBRARY_RULES }));
}

function toSearch(query: Record<string, string | number | boolean | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== "") params.set(key, String(value));
  return params.toString();
}
