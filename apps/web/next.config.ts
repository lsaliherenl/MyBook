import type { NextConfig } from "next";
import { existsSync } from "node:fs";
import path from "node:path";

// One .env for the whole monorepo, at the repository root.
const rootEnv = path.resolve(process.cwd(), "../../.env");
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const supabaseHost = process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL).hostname : undefined;

const nextConfig: NextConfig = {
  // Values the web app needs from the root .env, made available to every runtime (proxy included).
  // None of them is secret: the publishable key is meant for browsers. Server secrets stay in the API.
  env: {
    SUPABASE_URL: process.env.SUPABASE_URL ?? "",
    SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY ?? "",
    API_URL: process.env.API_URL ?? "http://localhost:4000/api",
    FORCE_IPV4: process.env.FORCE_IPV4 ?? "false",
  },
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
  images: {
    // Book covers are served from Supabase Storage.
    remotePatterns: supabaseHost
      ? [{ protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/**" }]
      : [],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
