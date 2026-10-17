import "server-only";
import { cookies } from "next/headers";

/**
 * The borrow bag lives in a cookie (book IDs, newest last) so the server can render the header count
 * and the drawer on any page, and it survives sign-in. Reserving empties it.
 */
export const BAG_COOKIE = "MYBOOK_BAG";
/** The API reserves at most 10 books at once; the member's loan limit is usually lower. */
export const BAG_MAX = 10;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function readBag(): Promise<string[]> {
  const raw = (await cookies()).get(BAG_COOKIE)?.value ?? "";
  return [...new Set(raw.split(",").filter((id) => UUID.test(id)))].slice(0, BAG_MAX);
}

export async function writeBag(ids: string[]): Promise<void> {
  const jar = await cookies();
  if (ids.length === 0) {
    jar.delete(BAG_COOKIE);
    return;
  }
  jar.set(BAG_COOKIE, ids.slice(0, BAG_MAX).join(","), {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
  });
}
