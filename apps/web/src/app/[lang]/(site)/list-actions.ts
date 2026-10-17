"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { readingListNameSchema } from "@mybook/shared";
import { isLocale } from "@/i18n/config";
import { api, ApiError } from "@/lib/api";
import { BAG_MAX, readBag, writeBag } from "@/lib/bag";

export type ListActionState = { error: string | null; done?: boolean };

const fail = (error: unknown): ListActionState => ({ error: error instanceof ApiError ? (error.code ?? "unknown") : "unknown" });

export async function createList(_prev: ListActionState, formData: FormData): Promise<ListActionState> {
  const lang = String(formData.get("lang"));
  const parsed = readingListNameSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { error: "invalid_input" };
  let id: string;
  try {
    ({ id } = await api<{ id: string }>("/me/lists", { method: "POST", auth: true, body: JSON.stringify(parsed.data) }));
  } catch (error) {
    return fail(error);
  }
  redirect(`/${isLocale(lang) ? lang : "tr"}/account/lists?list=${id}`);
}

export async function renameList(_prev: ListActionState, formData: FormData): Promise<ListActionState> {
  const parsed = readingListNameSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { error: "invalid_input" };
  try {
    await api(`/me/lists/${encodeURIComponent(String(formData.get("listId")))}`, { method: "PATCH", auth: true, body: JSON.stringify(parsed.data) });
  } catch (error) {
    return fail(error);
  }
  refresh();
  return { error: null, done: true };
}

export async function deleteList(formData: FormData): Promise<void> {
  const lang = String(formData.get("lang"));
  await api(`/me/lists/${encodeURIComponent(String(formData.get("listId")))}`, { method: "DELETE", auth: true });
  redirect(`/${isLocale(lang) ? lang : "tr"}/account/lists`);
}

/** Adds or removes one book; used by the list page's heart buttons and the book page's "Save to a list" menu. */
export async function setInList(listId: string, bookId: string, add: boolean): Promise<ListActionState> {
  try {
    await api(`/me/lists/${encodeURIComponent(listId)}/books/${encodeURIComponent(bookId)}`, { method: add ? "PUT" : "DELETE", auth: true });
  } catch (error) {
    return fail(error);
  }
  refresh();
  return { error: null, done: true };
}

/** "Add available ones to bag". */
export async function addManyToBag(bookIds: string[]): Promise<{ added: number }> {
  const bag = await readBag();
  const next = [...new Set([...bag, ...bookIds])].slice(0, BAG_MAX);
  await writeBag(next);
  return { added: next.length - bag.length };
}
