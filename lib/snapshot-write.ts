import type { AppSnapshot } from "./types";
import { supabaseAdmin } from "./supabase";
import { WriteConflict } from "./mutation";

export async function commitRemote(before: AppSnapshot, after: AppSnapshot): Promise<void> {
  const changes: Record<string, unknown> = {};
  for (const [key, table] of [
    ["locations", "report_locations"], ["incidents", "campus_incidents"],
    ["clusters", "issue_clusters"], ["issues", "issues"],
    ["confirmations", "issue_confirmations"], ["verifications", "issue_verifications"],
  ] as const) {
    const previous = new Map((before[key] ?? []).map(row => [row.id, JSON.stringify(row)]));
    changes[table] = (after[key] ?? []).filter(row => previous.get(row.id) !== JSON.stringify(row));
  }
  if (JSON.stringify(before.campus_boundary) !== JSON.stringify(after.campus_boundary)) {
    const b = after.campus_boundary;
    changes.campus_boundary = b ? { id: "default", kind: b.type, vertices: b.vertices, updated_at: b.updated_at, updated_by: b.updated_by ?? null } : null;
  }
  const { data, error } = await supabaseAdmin().rpc("campuspulse_commit", {
    p_revision: before.revision, p_changes: changes,
  });
  if (error?.code === "40001" || error?.code === "23505") throw new WriteConflict("Concurrent update; please retry");
  if (error) throw error;
  after.revision = Number(data);
}
