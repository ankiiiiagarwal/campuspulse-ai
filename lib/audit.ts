import { createHmac } from "crypto";
import { localDataFile } from "./local-mode";
import { appendFile, mkdir, readFile } from "fs/promises";
import path from "path";
import { sessionSecret } from "./secrets";
import { hasSupabase, supabaseAdmin } from "./supabase";

export type AuditRole = "admin" | "department" | "unknown";

export interface AuditEntry {
  id: string;
  at: string;
  actor_email: string;
  actor_role: AuditRole;
  action: string;
  target?: string;
  detail: string;
  ip?: string;
  prev_hash: string;
  hash: string;
}

export interface AuditWrite {
  actor_email: string;
  actor_role: AuditRole;
  action: string;
  target?: string;
  detail: string;
  ip?: string;
}

const GENESIS = "0".repeat(64);

const FILE = process.env.VERCEL
  ? path.join("/tmp", "campuspulse-audit.jsonl")
  : localDataFile("audit.jsonl");

let cache: AuditEntry[] | null = null;
let writeChain: Promise<void> = Promise.resolve();

function secret(): string {
  return sessionSecret();
}

function missingRelation(error: { message?: string; code?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === "42P01" || /does not exist|schema cache/i.test(error.message || "");
}

function hashEntry(entry: Omit<AuditEntry, "hash">): string {
  return createHmac("sha256", secret())
    .update(
      JSON.stringify({
        id: entry.id,
        at: entry.at,
        actor_email: entry.actor_email,
        actor_role: entry.actor_role,
        action: entry.action,
        target: entry.target || "",
        detail: entry.detail,
        ip: entry.ip || "",
        prev_hash: entry.prev_hash,
      }),
    )
    .digest("hex");
}

function parseLine(line: string): AuditEntry | null {
  try {
    const row = JSON.parse(line) as AuditEntry;
    if (!row.id || !row.hash || !row.prev_hash) return null;
    return row;
  } catch {
    return null;
  }
}

function rowToEntry(row: Record<string, unknown>): AuditEntry {
  return {
    id: String(row.id),
    at: String(row.at),
    actor_email: String(row.actor_email),
    actor_role: (row.actor_role as AuditRole) || "unknown",
    action: String(row.action),
    target: row.target ? String(row.target) : undefined,
    detail: String(row.detail || ""),
    ip: row.ip ? String(row.ip) : undefined,
    prev_hash: String(row.prev_hash),
    hash: String(row.hash),
  };
}

async function loadSupabase(): Promise<AuditEntry[] | null> {
  try {
    const sb = supabaseAdmin();
    const { data, error } = await sb.from("audit_log").select("*").order("at", { ascending: true });
    if (error) return missingRelation(error) ? null : Promise.reject(error);
    return (data || []).map((r) => rowToEntry(r as Record<string, unknown>));
  } catch {
    return null;
  }
}

async function loadFile(): Promise<AuditEntry[]> {
  try {
    const raw = await readFile(FILE, "utf8");
    return raw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map(parseLine)
      .filter((e): e is AuditEntry => Boolean(e));
  } catch {
    return [];
  }
}

async function loadAll(): Promise<AuditEntry[]> {
  if (cache) return cache;
  if (hasSupabase()) {
    const remote = await loadSupabase();
    if (remote) {
      cache = remote;
      return remote;
    }
  }
  cache = await loadFile();
  return cache;
}

function buildEntry(write: AuditWrite, prev_hash: string): AuditEntry {
  const base: Omit<AuditEntry, "hash"> = {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    actor_email: write.actor_email.trim().toLowerCase() || "unknown",
    actor_role: write.actor_role,
    action: write.action,
    target: write.target,
    detail: write.detail.slice(0, 400),
    ip: write.ip,
    prev_hash,
  };
  return { ...base, hash: hashEntry(base) };
}

export function verifyAuditChain(entries: AuditEntry[]): { intact: boolean; brokenAt: string | null } {
  let prev = GENESIS;
  for (const entry of entries) {
    if (entry.prev_hash !== prev) return { intact: false, brokenAt: entry.id };
    const expected = hashEntry({
      id: entry.id,
      at: entry.at,
      actor_email: entry.actor_email,
      actor_role: entry.actor_role,
      action: entry.action,
      target: entry.target,
      detail: entry.detail,
      ip: entry.ip,
      prev_hash: entry.prev_hash,
    });
    if (expected !== entry.hash) return { intact: false, brokenAt: entry.id };
    prev = entry.hash;
  }
  return { intact: true, brokenAt: null };
}

export async function appendAudit(write: AuditWrite): Promise<AuditEntry> {
  const rows = await loadAll();
  const entry = buildEntry(write, rows.at(-1)?.hash || GENESIS);

  if (hasSupabase()) {
    const remote = await loadSupabase();
    if (remote) {
      const chained = buildEntry(write, remote.at(-1)?.hash || GENESIS);
      const sb = supabaseAdmin();
      const { error } = await sb.from("audit_log").insert({
        id: chained.id,
        at: chained.at,
        actor_email: chained.actor_email,
        actor_role: chained.actor_role,
        action: chained.action,
        target: chained.target || null,
        detail: chained.detail,
        ip: chained.ip || null,
        prev_hash: chained.prev_hash,
        hash: chained.hash,
      });
      if (error) throw error;
      cache = [...remote, chained];
      return chained;
    }
  }

  writeChain = writeChain.then(async () => {
    await mkdir(path.dirname(FILE), { recursive: true });
    await appendFile(FILE, `${JSON.stringify(entry)}\n`, "utf8");
  });
  await writeChain;
  cache = [...rows, entry];
  return entry;
}

export async function listAudit(): Promise<{ entries: AuditEntry[]; intact: boolean; brokenAt: string | null }> {
  cache = null;
  const entries = await loadAll();
  const check = verifyAuditChain(entries);
  return { entries: [...entries].reverse(), intact: check.intact, brokenAt: check.brokenAt };
}

export function requestIp(req: Request): string {
  // Only trust headers when the deployment proxy strips caller-supplied values.
  if (process.env.TRUST_PROXY_HEADERS !== "1" && process.env.VERCEL !== "1") return "local";
  const forwarded = req.headers.get("x-forwarded-for");
  return (forwarded?.split(",")[0] || req.headers.get("x-real-ip") || "local").trim();
}
