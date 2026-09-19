import { createHmac } from "crypto";
import { requestIp } from "./audit";
import { sessionSecret } from "./secrets";
import { hasSupabase, supabaseAdmin } from "./supabase";

const WINDOW_MS = 10 * 60 * 1000;
const DEFAULT_LIMIT = 30;
const MAX_KEYS = 4000;

type Window = { count: number; expiresAt: number };
const state = globalThis as typeof globalThis & { cpRateHits?: Map<string, Window> };
const hits = state.cpRateHits ??= new Map<string, Window>();

export function clientKey(req: Request): string {
  return requestIp(req);
}

/** True when this caller is over the limit for `bucket`. */
export async function limited(
  req: Request,
  bucket = "default",
  opts?: { limit?: number; windowMs?: number },
): Promise<boolean> {
  const limit = opts?.limit ?? DEFAULT_LIMIT;
  const windowMs = opts?.windowMs ?? WINDOW_MS;
  const key = createHmac("sha256", sessionSecret()).update(`${bucket}:${clientKey(req)}`).digest("hex");
  if (hasSupabase()) {
    try {
      const { data, error } = await supabaseAdmin().rpc("campuspulse_rate_limit", {
        p_key: key, p_limit: limit, p_window_ms: windowMs,
      });
      // Fail closed when the shared limiter cannot be reached.
      return Boolean(error) || data !== true;
    } catch { return true; }
  }
  const now = Date.now();
  if (hits.size >= MAX_KEYS) {
    for (const [key, value] of hits) if (value.expiresAt <= now) hits.delete(key);
    if (hits.size >= MAX_KEYS && !hits.has(key)) return true;
  }
  let window = hits.get(key);
  if (!window || window.expiresAt <= now) {
    window = { count: 0, expiresAt: now + windowMs };
    hits.set(key, window);
  }
  if (window.count >= limit) return true;
  window.count++;
  return false;
}
