import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isDemoMode } from "./local-mode";

/** Local JSON store in .data/store.json. Set USE_LOCAL_DB=1 to ignore remote Supabase. */
export function useLocalDatabase(): boolean {
  if (isDemoMode()) return true;
  const flag = (process.env.USE_LOCAL_DB || "").trim().toLowerCase();
  return flag === "1" || flag === "true" || flag === "yes";
}

export function hasSupabase(): boolean {
  if (process.env.VERCEL && (useLocalDatabase() || !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)) {
    throw new Error("Vercel requires Supabase storage. Configure the database environment variables and disable USE_LOCAL_DB.");
  }
  if (useLocalDatabase()) return false;
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function hasSupabaseAnon(): boolean {
  if (useLocalDatabase()) return false;
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function supabaseAdmin(): SupabaseClient {
  if (useLocalDatabase()) {
    throw new Error("Local database mode is on — remote Supabase writes are disabled");
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase service role is not configured");
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function supabaseAnon(): SupabaseClient {
  if (useLocalDatabase()) {
    throw new Error("Local database mode is on — remote Supabase auth is disabled");
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Supabase anon key is not configured");
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function publicSupabaseConfig() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    configured: hasSupabaseAnon(),
  };
}
