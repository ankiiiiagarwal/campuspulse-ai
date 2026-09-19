import { readJson } from "@/lib/request-body";
import { HttpError } from "@/lib/geo";
import { NextResponse } from "next/server";
import { appendAudit, requestIp } from "@/lib/audit";
import { deskFromRequest, getStaffSession, requireStaff } from "@/lib/auth";
import { coerceDepartment, departmentForbidden } from "@/lib/departments";
import { publicIssue } from "@/lib/public-issue";
import { isStatus } from "@/lib/status";
import { getIssueById, updateIssue } from "@/lib/store";
import type { Department, Status } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const issue = await getIssueById(id);
  if (!issue) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const session = await getStaffSession(deskFromRequest(req));
  if (departmentForbidden(session, issue)) {
    return NextResponse.json({ error: "This issue is assigned to another department" }, { status: 403 });
  }
  return NextResponse.json({ issue: publicIssue(issue) });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireStaff(deskFromRequest(req));
    if (!session) return NextResponse.json({ error: "Staff login required" }, { status: 401 });
    const { id } = await ctx.params;
    const existing = await getIssueById(id);
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (departmentForbidden(session, existing)) {
      return NextResponse.json({ error: "This issue is assigned to another department" }, { status: 403 });
    }
    const raw = await readJson(req, 4096);
    const allowed = ["status", "eta_at", "resolve_photo_url", "department", "worker_name"];
    if (Object.keys(raw).some(key => !allowed.includes(key))) throw new HttpError("Unknown update field", 400);
    for (const key of ["eta_at", "resolve_photo_url", "worker_name", "department"]) {
      if (raw[key] != null && (typeof raw[key] !== "string" || (raw[key] as string).length > (key === "resolve_photo_url" ? 2048 : 160))) throw new HttpError(`Invalid ${key}`, 400);
    }
    if ("status" in raw && !isStatus(raw.status)) throw new HttpError("Invalid status", 400);
    if ("department" in raw && !coerceDepartment(raw.department)) throw new HttpError("Invalid department", 400);
    if (raw.eta_at != null && !Number.isFinite(Date.parse(String(raw.eta_at)))) throw new HttpError("Invalid ETA", 400);
    const body = raw as {
      status?: Status;
      eta_at?: string | null;
      resolve_photo_url?: string | null;
      department?: Department;
      worker_name?: string | null;
    };
    if (body.status != null && !isStatus(body.status)) {
      return NextResponse.json({ error: "Status must be open, assigned, on_it, or resolved." }, { status: 400 });
    }
    if (session.role === "department" && existing.status === "on_it" && body.eta_at && !body.status) {
      body.status = "on_it";
      if (body.worker_name == null) body.worker_name = existing.worker_name;
    }
    if (session.role === "department" && body.status === "on_it") {
      const alreadyOnIt = existing.status === "on_it";
      const worker = String(body.worker_name || existing.worker_name || "").trim();
      if (!worker && !alreadyOnIt) {
        return NextResponse.json({ error: "Name of the person on this work is required" }, { status: 400 });
      }
      const etaMs = Date.parse(String(body.eta_at || ""));
      if (!Number.isFinite(etaMs) || etaMs <= Date.now()) {
        return NextResponse.json({ error: "Choose an expected resolution date and time in the future." }, { status: 400 });
      }
      if (worker) body.worker_name = worker;
      body.eta_at = new Date(etaMs).toISOString();
    }
    if (session.role === "department" && body.status === "assigned") {
      body.worker_name = null;
      body.eta_at = null;
    }
    if (body.department) {
      const desk = coerceDepartment(body.department);
      if (!desk) {
        return NextResponse.json({ error: "Department must be IT, Hostel, Mess, Campus, or Library." }, { status: 400 });
      }
      body.department = desk;
    }
    const patch =
      session.role === "department"
        ? { status: body.status, eta_at: body.eta_at, resolve_photo_url: body.resolve_photo_url, worker_name: body.worker_name }
        : body;
    const issue = await updateIssue(id, patch, session);
    if (!issue) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const changed = [
      patch.status && patch.status !== existing.status ? `status ${existing.status} → ${patch.status}` : "",
      patch.department && patch.department !== existing.department ? `desk → ${patch.department}` : "",
      patch.worker_name ? `worker ${patch.worker_name}` : "",
      patch.eta_at ? `eta ${patch.eta_at}` : "",
    ]
      .filter(Boolean)
      .join(", ");
    if (changed) {
      await appendAudit({
        actor_email: session.email,
        actor_role: session.role,
        action: "staff.issue_update",
        target: existing.ticket_code,
        detail: changed,
        ip: requestIp(req),
      });
    }
    return NextResponse.json({ issue: publicIssue(issue) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof HttpError ? error.message : "Could not update ticket. Please retry." }, { status: error instanceof HttpError ? error.status : 503 });
  }
}
