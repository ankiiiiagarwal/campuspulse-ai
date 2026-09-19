import { limited } from "@/lib/rate-limit";
import { readJson, textField } from "@/lib/request-body";
import { HttpError } from "@/lib/geo";
import { NextResponse } from "next/server";
import { appendAudit, requestIp } from "@/lib/audit";
import { deskFromRequest, loginStaff, type DeskKind } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    if (await limited(req, "login", { limit: 10 })) return NextResponse.json({ error: "Too many login attempts. Wait a few minutes." }, { status: 429 });
    const body = (await readJson(req, 4096)) as { email?: string; password?: string; desk?: DeskKind };
    const desk = body.desk === "admin" || body.desk === "department" ? body.desk : deskFromRequest(req);
    const email = textField(body.email, "Email", 254, 3).toLowerCase();
    if (typeof body.password !== "string" || body.password.length > 256) throw new HttpError("Invalid password", 400);
    const result = await loginStaff(email, body.password || "", desk);
    const ip = requestIp(req);
    if (!result.ok) {
      await appendAudit({
        actor_email: email || "unknown",
        actor_role: "unknown",
        action: desk === "department" ? "dept.login_failed" : "admin.login_failed",
        detail: result.error,
        ip,
      });
      return NextResponse.json({ error: result.error }, { status: 401 });
    }
    await appendAudit({
      actor_email: result.session.email,
      actor_role: result.session.role,
      action: result.session.role === "admin" ? "admin.login" : "dept.login",
      target: result.session.department,
      detail: `Signed in at the ${desk || result.session.role} desk.`,
      ip,
    });
    return NextResponse.json({ ok: true, session: result.session });
  } catch (error) {
    return NextResponse.json({ error: error instanceof HttpError ? error.message : "Login service unavailable. Please retry." }, { status: error instanceof HttpError ? error.status : 503 });
  }
}
