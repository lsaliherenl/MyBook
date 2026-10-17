import { notFound } from "next/navigation";

/** Nothing to render instantly here: the page only ever turns into the 404. */
export const instant = false;

/** Any address no other route matches gets the designed 404 page. */
export default function Missing() {
  notFound();
}
