import type { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** The attendee list of one event as CSV, passed through from the API with the librarian's token. */
export async function GET(_request: NextRequest, { params }: RouteContext<"/[lang]/admin/events/[id]/attendees.csv">) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getSession();
  if (!data.session) return new Response(null, { status: 401 });

  const base = process.env.API_URL ?? "http://localhost:4000/api";
  const res = await fetch(`${base}/admin/events/${encodeURIComponent(id)}/attendees.csv`, {
    headers: { authorization: `Bearer ${data.session.access_token}` },
    cache: "no-store",
  });
  if (!res.ok) return new Response(null, { status: res.status });
  return new Response(res.body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="attendees-${new Date().toISOString().slice(0, 10)}.csv"`,
      "cache-control": "no-store",
    },
  });
}
