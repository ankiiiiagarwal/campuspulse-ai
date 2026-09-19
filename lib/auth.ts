import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { accountForEmail } from "./departments";
import { isProductionRuntime, sessionSecret } from "./secrets";
import { hasSupabaseAnon, supabaseAnon } from "./supabase";
import type { StaffRole, StaffSession } from "./types";

export type DeskKind = "admin" | "department";

const ADMIN_COOKIE = "cp_admin";
const DEPT_COOKIE = "cp_dept";
const DAY = 60 * 60 * 24;

type CookiePayload = { email: string; exp: number; role: StaffRole; epoch?: number };

function secret(): string {
  return sessionSecret();
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

function verify(token: string): CookiePayload | null {
  const dot = token.lastIndexOf(".");
  if (dot < 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = createHmac("sha256", secret()).update(payload).digest("hex");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<CookiePayload>;
    if (!data.email || !data.exp || data.exp < Date.now()) return null;
    const session = staffFromEmail(data.email);
    if (!session) return null;
    const role = data.role === "admin" || data.role === "department" ? data.role : session.role;
    if (role !== session.role) return null;
    return { email: data.email, exp: data.exp, role, epoch: typeof data.epoch === "number" ? data.epoch : 0 };
  } catch {
    return null;
  }
}

export function staffFromEmail(email: string): StaffSession | null {
  const e = email.trim().toLowerCase();
  if (e === expectedEmail()) {
    return { email: e, role: "admin" };
  }
  const acct = accountForEmail(e);
  if (acct) {
    return { email: e, role: "department", department: acct.key, departmentLabel: acct.label };
  }
  return null;
}

async function localPasswordOk(email: string, password: string): Promise<boolean> {
  if (email === expectedEmail() && password === expectedPassword()) return true;
  const acct = accountForEmail(email);
  if (!acct) return false;
  const { deptPasswordMatches } = await import("./dept-secrets");
  return deptPasswordMatches(acct.key, password);
}

function cookieName(desk: DeskKind): string {
  return desk === "admin" ? ADMIN_COOKIE : DEPT_COOKIE;
}

function otherDesk(desk: DeskKind): DeskKind {
  return desk === "admin" ? "department" : "admin";
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 7 * DAY,
    secure: isProductionRuntime() || process.env.COOKIE_SECURE === "true",
  };
}

async function setDeskCookie(desk: DeskKind, email: string, role: StaffRole, epoch: number) {
  const session = staffFromEmail(email);
  if (!session) throw new Error("Unknown staff account");
  const payload = Buffer.from(
    JSON.stringify({ email, role, exp: Date.now() + 7 * DAY * 1000, epoch }),
    "utf8",
  ).toString("base64url");
  const token = sign(payload);
  const jar = await cookies();
  jar.set(cookieName(desk), token, cookieOptions());
}

async function readDeskAuth(desk: DeskKind): Promise<{ session: StaffSession; exp: number } | null> {
  const jar = await cookies();
  const token = jar.get(cookieName(desk))?.value;
  if (!token) return null;
  const data = verify(token);
  if (!data) return null;
  if (desk === "admin" && data.role !== "admin") return null;
  if (desk === "department" && data.role !== "department") return null;
  const session = staffFromEmail(data.email);
  if (!session) return null;
  if (session.department) {
    const { deptSessionEpoch } = await import("./dept-secrets");
    const epoch = await deptSessionEpoch(session.department);
    if ((data.epoch ?? 0) !== epoch) return null;
  }
  return { session, exp: data.exp };
}

async function readDeskCookie(desk: DeskKind): Promise<StaffSession | null> {
  return (await readDeskAuth(desk))?.session ?? null;
}

/** One browser, one staff desk. If both cookies exist, keep the newer login. */
async function ensureExclusiveStaffSession(): Promise<void> {
  const admin = await readDeskAuth("admin");
  const department = await readDeskAuth("department");
  if (!admin || !department) return;
  const winner: DeskKind = admin.exp >= department.exp ? "admin" : "department";
  await logoutDesk(otherDesk(winner));
}

export function deskFromRequest(req?: Request | null): DeskKind | undefined {
  if (!req) return undefined;
  const header = req.headers.get("x-cp-desk")?.trim().toLowerCase();
  if (header === "admin" || header === "department") return header;
  try {
    const q = new URL(req.url).searchParams.get("desk")?.trim().toLowerCase();
    if (q === "admin" || q === "department") return q;
  } catch {
    // ignore bad URLs
  }
  return undefined;
}

export async function loginStaff(
  email: string,
  password: string,
  desk?: DeskKind,
): Promise<{ ok: true; session: StaffSession } | { ok: false; error: string }> {
  const e = email.trim().toLowerCase();
  const session = staffFromEmail(e);
  if (!session) return { ok: false, error: "Wrong email or password" };
  // Read the epoch before checking the password: a concurrent rotation must not
  // issue a new-epoch cookie to a login authenticated with the previous password.
  const epoch = session.department
    ? await (await import("./dept-secrets")).deptSessionEpoch(session.department)
    : 0;
  const authenticated = await credentialsOk(e, password);
  if (!authenticated) return { ok: false, error: "Wrong email or password" };

  if (session.department && epoch !== await (await import("./dept-secrets")).deptSessionEpoch(session.department)) {
    return { ok: false, error: "Password changed. Please sign in again." };
  }
  if (desk === "admin" && session.role !== "admin") {
    return { ok: false, error: "That account is a department desk. Use the Dept login." };
  }
  if (desk === "department" && session.role === "admin") {
    return { ok: false, error: "That account is super-admin. Use the Admin login." };
  }

  const target: DeskKind = desk || (session.role === "department" ? "department" : "admin");
  if (target === "admin" && session.role !== "admin") {
    return { ok: false, error: "That account is a department desk. Use the Dept login." };
  }
  if (target === "department" && session.role !== "department") {
    return { ok: false, error: "That account is super-admin. Use the Admin login." };
  }

  await logoutDesk(otherDesk(target));
  await setDeskCookie(target, e, session.role, epoch);
  return { ok: true, session };
}

async function credentialsOk(email: string, password: string): Promise<boolean> {
  const account = accountForEmail(email);
  if (account) {
    const { getDeptPasswordOverride, deptPasswordMatches } = await import("./dept-secrets");
    if (await getDeptPasswordOverride(account.key)) return deptPasswordMatches(account.key, password);
  }
  if (hasSupabaseAnon()) {
    const { error } = await supabaseAnon().auth.signInWithPassword({ email, password });
    if (!error) return true;
    return localPasswordOk(email, password);
  }
  return localPasswordOk(email, password);
}

/** @deprecated use loginStaff — kept for older callers */
export async function loginAdmin(email: string, password: string, desk?: DeskKind) {
  return loginStaff(email, password, desk);
}

export async function logoutDesk(desk: DeskKind) {
  const jar = await cookies();
  jar.set(cookieName(desk), "", { ...cookieOptions(), maxAge: 0 });
  jar.delete(cookieName(desk));
}

/** Sign out one desk. */
export async function logoutAdmin(desk?: DeskKind) {
  if (desk) {
    await logoutDesk(desk);
    return;
  }
  await logoutDesk("admin");
}

export async function getAdminStaffSession(): Promise<StaffSession | null> {
  await ensureExclusiveStaffSession();
  return readDeskCookie("admin");
}

export async function getDeptSession(): Promise<StaffSession | null> {
  await ensureExclusiveStaffSession();
  return readDeskCookie("department");
}

/**
 * Desk-aware session.
 * No desk → public / unscoped (admin and dept cookies stay unused).
 */
export async function getStaffSession(desk?: DeskKind): Promise<StaffSession | null> {
  await ensureExclusiveStaffSession();
  if (desk === "admin") return readDeskCookie("admin");
  if (desk === "department") return readDeskCookie("department");
  return null;
}

export async function getAdminSession(): Promise<{ email: string } | null> {
  const session = await getAdminStaffSession();
  if (!session || session.role !== "admin") return null;
  return { email: session.email };
}

export async function requireAdmin(): Promise<{ email: string } | null> {
  return getAdminSession();
}

export async function requireStaff(desk?: DeskKind): Promise<StaffSession | null> {
  if (desk) return getStaffSession(desk);
  return (await getAdminStaffSession()) || (await getDeptSession());
}
