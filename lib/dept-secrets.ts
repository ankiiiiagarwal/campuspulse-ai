import { mkdir, readFile, writeFile } from "fs/promises";
import { localDataFile } from "./local-mode";
import { replaceFile } from "./atomic-file";
import path from "path";
import { mutate } from "./mutation";
import { envDeptPassword } from "./departments";
import { hashPassword, verifyPassword } from "./passwords";
import { hasSupabase, supabaseAdmin } from "./supabase";
import type { DeptKey } from "./types";

export interface DeptPasswordOverride {
  key: DeptKey;
  password_hash: string;
  epoch: number;
  updated_at: string;
  updated_by: string;
}

const FILE = process.env.VERCEL
  ? path.join("/tmp", "campuspulse-dept-secrets.json")
  : localDataFile("dept-secrets.json");



function rowToOverride(row: Record<string, unknown>): DeptPasswordOverride {
  return {
    key: row.key as DeptKey,
    password_hash: String(row.password_hash),
    epoch: Number(row.epoch) || 0,
    updated_at: String(row.updated_at),
    updated_by: String(row.updated_by || ""),
  };
}

async function loadMap(): Promise<Record<string, DeptPasswordOverride>> {
  if (hasSupabase()) {
    const { data, error } = await supabaseAdmin().from("dept_password_overrides").select("*");
    // Auth must not fall back to an old/default password when its database is down.
    if (error) throw error;
    return Object.fromEntries((data || []).map(row => [row.key, rowToOverride(row)]));
  }
  try { return JSON.parse(await readFile(FILE, "utf8")); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return {};
  }
}

export async function getDeptPasswordOverride(key: DeptKey): Promise<DeptPasswordOverride | null> {
  const map = await loadMap();
  return map[key] || null;
}

export async function listDeptPasswordOverrides(): Promise<DeptPasswordOverride[]> {
  return Object.values(await loadMap());
}

export async function setDeptPasswordOverride(key: DeptKey, password: string, updatedBy: string): Promise<DeptPasswordOverride> {
  return mutate(async () => {
    const password_hash = hashPassword(password);
    if (hasSupabase()) {
      const { data, error } = await supabaseAdmin().rpc("campuspulse_rotate_password", {
        p_key: key, p_hash: password_hash, p_actor: updatedBy,
      });
      if (error) throw error;
      return rowToOverride(data);
    }
    const map = await loadMap();
    const next: DeptPasswordOverride = {
      key, password_hash, epoch: (map[key]?.epoch || 0) + 1,
      updated_at: new Date().toISOString(), updated_by: updatedBy,
    };
    map[key] = next;
    await mkdir(path.dirname(FILE), { recursive: true });
    const temp = `${FILE}.${crypto.randomUUID()}.tmp`;
    await writeFile(temp, JSON.stringify(map, null, 2), "utf8");
    await replaceFile(temp, FILE);
    return next;
  });
}

export async function deptSessionEpoch(key: DeptKey): Promise<number> {
  return (await getDeptPasswordOverride(key))?.epoch ?? 0;
}

export async function deptPasswordMatches(key: DeptKey, password: string): Promise<boolean> {
  const override = await getDeptPasswordOverride(key);
  if (override?.password_hash) return verifyPassword(password, override.password_hash);
  return password === envDeptPassword(key);
}
