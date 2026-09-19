import { createHmac } from "crypto";
import { cookies } from "next/headers";
import { isProductionRuntime, sessionSecret } from "./secrets";

export const VISITOR_COOKIE = "cp_visitor";
const YEAR = 60 * 60 * 24 * 400;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: YEAR,
    secure: isProductionRuntime() || process.env.COOKIE_SECURE === "true",
  };
}

/** Stable anonymous browser id. Not supplied by the client. */
export async function ensureVisitorId(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(VISITOR_COOKIE)?.value || "";
  if (UUID_RE.test(existing)) return existing;
  const id = crypto.randomUUID();
  jar.set(VISITOR_COOKIE, id, cookieOptions());
  return id;
}

/** Server-side Me too identity. One count per browser, not per spoofable UUID. */
export async function confirmationHash(): Promise<string> {
  const id = await ensureVisitorId();
  return createHmac("sha256", sessionSecret()).update(`me-too:${id}`).digest("hex");
}

/**
 * Fix-check identity. Namespaced away from Me too so the two counts cannot be
 * correlated back to one browser from the stored hashes alone.
 */
export async function verificationHash(): Promise<string> {
  const id = await ensureVisitorId();
  return createHmac("sha256", sessionSecret()).update(`verify-fix:${id}`).digest("hex");
}
