import { NextResponse } from "next/server";
import { appendAudit, requestIp } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { HttpError, normalizeBoundary } from "@/lib/geo";
import { clearCampusBoundary, getCampusBoundary, saveCampusBoundary } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin login required" }, { status: 401 });
  const boundary = await getCampusBoundary();
  return NextResponse.json({ boundary, admin: { email: admin.email } });
}

export async function PUT(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin login required" }, { status: 401 });
  try {
    const body = (await req.json()) as { type?: string; vertices?: unknown };
    const parsed = normalizeBoundary({ ...body, updated_by: admin.email });
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const boundary = await saveCampusBoundary(parsed.boundary);
    await appendAudit({
      actor_email: admin.email,
      actor_role: "admin",
      action: "admin.campus_save",
      detail: `Saved campus ${boundary.type} (${boundary.vertices.length} points).`,
      ip: requestIp(req),
    });
    return NextResponse.json({ boundary });
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    const message = err instanceof Error ? err.message : "Could not save campus area";
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin login required" }, { status: 401 });
  try {
    await clearCampusBoundary();
    await appendAudit({
      actor_email: admin.email,
      actor_role: "admin",
      action: "admin.campus_clear",
      detail: "Removed the campus area.",
      ip: requestIp(req),
    });
    return NextResponse.json({ boundary: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not clear campus area";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
