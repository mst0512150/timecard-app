import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedAnon: SupabaseClient | null = null;

function trimEnv(value: string | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

export function getPublicSupabaseConfig(): { url: string; anonKey: string } {
  const url = trimEnv(process.env.NEXT_PUBLIC_SUPABASE_URL).replace(/\/+$/, "");
  const anonKey = trimEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Copy both from Supabase → Project Settings → API.",
    );
  }
  return { url, anonKey };
}

export function getAnonClient(): SupabaseClient {
  if (cachedAnon) return cachedAnon;
  const { url, anonKey } = getPublicSupabaseConfig();
  cachedAnon = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cachedAnon;
}
