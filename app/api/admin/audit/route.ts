import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { listAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin login required" }, { status: 401 });
  const log = await listAudit();
  return NextResponse.json({
    admin: { email: admin.email },
    intact: log.intact,
    brokenAt: log.brokenAt,
    entries: log.entries,
  });
}
