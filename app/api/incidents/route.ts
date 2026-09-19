import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { detectIncidents, incidentProgress } from "@/lib/incidents";
import { HttpError } from "@/lib/geo";
import { readJson, textField } from "@/lib/request-body";
import { limited } from "@/lib/rate-limit";
import { decideIncident, loadSnapshot } from "@/lib/store";
import { proofState } from "@/lib/verification";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    const staff = new URL(req.url).searchParams.get("review") === "1";
    if (staff && !await requireAdmin()) return NextResponse.json({ error: "Admin login required" }, { status: 401 });
    const snap = await loadSnapshot(false);
    const candidates = staff ? detectIncidents(snap) : [];
    const evidence = (ids: string[]) => snap.issues.filter(i => ids.includes(i.id)).map(i => ({ id: i.id, ticket_code: i.ticket_code, description: i.description, building: i.building, department: i.department, created_at: i.created_at, status: i.status, proof: proofState(i), verified_count: i.verified_count, disputed_count: i.disputed_count }));
    const records = (snap.incidents ?? []).filter(r => staff || r.decision === "confirmed").map(r => ({ id: r.id, kind: r.kind, title: r.title, place: r.place, decision: r.decision, created_at: r.created_at, evidence: evidence(r.issue_ids), progress: incidentProgress(snap.issues.filter(i => r.issue_ids.includes(i.id))) }));
    const grouped = new Set([...candidates.flatMap(c => c.issue_ids), ...(snap.incidents ?? []).filter(r => r.decision === "confirmed").flatMap(r => r.issue_ids)]);
    return NextResponse.json({ candidates: candidates.map(c => ({ ...c, evidence: evidence(c.issue_ids) })), records, ungrouped: staff ? evidence(snap.issues.filter(i => i.status !== "resolved" && !grouped.has(i.id)).map(i => i.id)) : [] });
  } catch { return NextResponse.json({ error: "Could not load incidents. Check database migrations and retry." }, { status: 503 }); }
}
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin login required" }, { status: 401 });
  try {
    if (await limited(req, "incident-decision", { limit: 30 })) return NextResponse.json({ error: "Please wait before reviewing more incidents." }, { status: 429 });
    const body = await readJson(req) as Record<string, unknown>;
    const id = textField(body.id, "Suggestion ID", 64, 64);
    if (body.decision !== "confirmed" && body.decision !== "separate") throw new HttpError("Choose confirm or keep separate.", 400);
    const record = await decideIncident(id, body.decision, { ...admin, role: "admin" });
    return NextResponse.json({ id: record.id, decision: record.decision });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not review incident" }, { status: error instanceof HttpError ? error.status : 500 }); }
}
