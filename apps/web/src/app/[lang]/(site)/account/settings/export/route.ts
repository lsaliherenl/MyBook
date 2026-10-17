import { api, ApiError } from "@/lib/api";

/** "Download my data": the member's KVKK export as a JSON file. */
export async function GET() {
  try {
    const data = await api<unknown>("/me/export", { auth: true });
    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="mybook-data-${new Date().toISOString().slice(0, 10)}.json"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return new Response(null, { status: error instanceof ApiError ? error.status : 500 });
  }
}
