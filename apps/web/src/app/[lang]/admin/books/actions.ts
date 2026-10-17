"use server";

import { refresh, updateTag } from "next/cache";
import type {
  AddCopiesInput,
  AdminBookDto,
  BookDetailDto,
  BookProvider,
  BulkBooksInput,
  CopyHistoryDto,
  ImportBookInput,
  ImportIsbnInput,
  ImportIsbnResultDto,
  ImportSearchResult,
  UpdateBookInput,
  UpdateCopyInput,
} from "@mybook/shared";
import { post, run } from "@/lib/action-result";
import { api } from "@/lib/api";

/** Catalog data changed: cached catalog pages refresh and the current admin page re-renders. */
function changed() {
  updateTag("catalog");
  refresh();
}

async function mutate<T>(call: () => Promise<T>) {
  const result = await run(call);
  if (result.ok) changed();
  return result;
}

export async function bulkBooks(input: BulkBooksInput) {
  return mutate(() => api<{ changed: number }>("/admin/books/bulk", post(input, "PATCH")));
}

export async function saveBook(bookId: string, input: UpdateBookInput) {
  return mutate(() => api<AdminBookDto>(`/admin/books/${bookId}`, post(input, "PATCH")));
}

export async function addCopies(bookId: string, input: AddCopiesInput) {
  return mutate(() => api<{ barcodes: string[] }>(`/admin/books/${bookId}/copies`, post(input)));
}

export async function updateCopy(copyId: string, input: UpdateCopyInput) {
  return mutate(() => api<AdminBookDto>(`/admin/copies/${copyId}`, post(input, "PATCH")));
}

export async function copyHistory(copyId: string) {
  return run(() => api<CopyHistoryDto[]>(`/admin/copies/${copyId}/history`, { auth: true }));
}

export async function replaceCover(bookId: string, url: string, provider: BookProvider) {
  return mutate(() => api<AdminBookDto>(`/admin/books/${bookId}/cover`, post({ url, provider }, "PATCH")));
}

/** Looks a book up in Google Books, Open Library and Apple Books (by ISBN or by title/author). */
export async function searchSources(query: string) {
  const compact = query.replace(/[\s-]/g, "");
  const param = /^(97[89])?\d{9}[\dX]$/i.test(compact) ? `isbn=${encodeURIComponent(compact)}` : `q=${encodeURIComponent(query.trim())}`;
  return run(() => api<ImportSearchResult>(`/admin/import/search?${param}`, { auth: true }));
}

export async function importBook(input: ImportBookInput) {
  return mutate(() => api<{ book: BookDetailDto; coverError: string | null }>("/admin/books/import", post(input)));
}

/** One row of a bulk CSV import. */
export async function importIsbn(input: ImportIsbnInput) {
  return mutate(() => api<ImportIsbnResultDto>("/admin/books/import-isbn", post(input)));
}

export async function loadBook(bookId: string) {
  return run(() => api<AdminBookDto>(`/admin/books/${bookId}`, { auth: true }));
}
