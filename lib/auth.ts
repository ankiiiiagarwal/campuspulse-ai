import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { hasSupabaseAnon, supabaseAnon } from "./supabase";

const COOKIE = "cp_admin";
const DAY = 60 * 60 * 24;

function secret(): string {
  return process.env.ADMIN_SESSION_SECRET || "campuspulse-local-dev-only";
}

function expectedEmail(): string {
  return (process.env.ADMIN_EMAIL || "admin@campus.local").toLowerCase();
}

function expectedPassword(): string {
  return process.env.ADMIN_PASSWORD || "campuspulse";
}

function sign(payload: string): string {
  const h = createHmac("sha256", secret()).update(payload).digest("hex");
  return `${payload}.${h}`;
}

function verify(token: string): { email: string; exp: number } | null {
  const dot = token.lastIndexOf(".");
  if (dot < 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = createHmac("sha256", secret()).update(payload).digest("hex");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { email: string; exp: number };
    if (!data.exp || data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

export async function loginAdmin(email: string, password: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const e = email.trim().toLowerCase();
  if (hasSupabaseAnon()) {
    const { error } = await supabaseAnon().auth.signInWithPassword({ email: e, password });
    if (error) {
      if (e === expectedEmail() && password === expectedPassword()) {
        await setSessionCookie(e);
        return { ok: true };
      }
      return { ok: false, error: error.message };
    }
    await setSessionCookie(e);
    return { ok: true };
  }
  if (e === expectedEmail() && password === expectedPassword()) {
    await setSessionCookie(e);
    return { ok: true };
  }
  return { ok: false, error: "Wrong email or password" };
}

async function setSessionCookie(email: string) {
  const payload = Buffer.from(JSON.stringify({ email, exp: Date.now() + 7 * DAY * 1000 }), "utf8").toString("base64url");
  const token = sign(payload);
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 7 * DAY,
    secure: process.env.VERCEL === "1" || process.env.COOKIE_SECURE === "true",
  });
}

export async function logoutAdmin() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function getAdminSession(): Promise<{ email: string } | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const data = verify(token);
  if (!data) return null;
  return { email: data.email };
}

export async function requireAdmin(): Promise<{ email: string } | null> {
  return getAdminSession();
}
