import { NextResponse } from "next/server";
import { appendAudit, requestIp } from "@/lib/audit";
import { deskFromRequest, getStaffSession, logoutDesk, type DeskKind } from "@/lib/auth";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { desk?: DeskKind };
  const desk = body.desk === "admin" || body.desk === "department" ? body.desk : deskFromRequest(req);
  if (!desk) {
    return NextResponse.json({ error: "Say which desk to sign out (admin or department)." }, { status: 400 });
  }
  const session = await getStaffSession(desk);
  await logoutDesk(desk);
  if (session) {
    await appendAudit({
      actor_email: session.email,
      actor_role: session.role,
      action: session.role === "admin" ? "admin.logout" : "dept.logout",
      target: session.department,
      detail: `Signed out of the ${desk} desk.`,
      ip: requestIp(req),
    });
  }
  return NextResponse.json({ ok: true, desk });
}
