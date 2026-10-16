export async function register() {
  // Some networks answer IPv6 (AAAA) DNS queries very slowly, so every new connection to Supabase
  // takes ~12 s. FORCE_IPV4=true in the root .env makes server-side fetch() use IPv4 only.
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.FORCE_IPV4 === "true") {
    const { Agent, setGlobalDispatcher } = await import("undici");
    setGlobalDispatcher(new Agent({ connect: { family: 4, timeout: 30_000 } }));
  }
}
