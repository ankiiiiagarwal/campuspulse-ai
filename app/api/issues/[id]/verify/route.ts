import { readJson } from "@/lib/request-body";
import { HttpError } from "@/lib/geo";
import { NextResponse } from "next/server";
import { appendAudit, requestIp } from "@/lib/audit";
import { requireStaff } from "@/lib/auth";
import { publicIssue } from "@/lib/public-issue";
import { limited } from "@/lib/rate-limit";
import { recordVerification } from "@/lib/store";
import { isVerdict } from "@/lib/verification";
import { verificationHash } from "@/lib/visitor";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (await limited(req, "verify", { limit: 20 })) {
    return NextResponse.json({ error: "Too many checks from here. Wait a few minutes." }, { status: 429 });
  }

  // A desk cannot sign off on its own work. This is the whole point of the check.
  const staff = await requireStaff();
  if (staff) {
    return NextResponse.json(
      { error: "Staff cannot check their own fixes. Sign out and use a student browser." },
      { status: 403 },
    );
  }

  try {
    const { id } = await ctx.params;
    const body = (await readJson(req, 4096)) as { verdict?: unknown; photo_url?: unknown };
    if (!isVerdict(body.verdict)) {
      return NextResponse.json({ error: "Answer whether the fix worked." }, { status: 400 });
    }
    if (body.photo_url != null && typeof body.photo_url !== "string") throw new HttpError("Invalid photo", 400);
    const photo_url = typeof body.photo_url === "string" && body.photo_url.trim() ? body.photo_url.trim() : null;

    const client_hash = await verificationHash();
    const result = await recordVerification(id, client_hash, body.verdict, photo_url);
    if (!result.ok) {
      return NextResponse.json({ error: result.error, already: result.already }, { status: result.status });
    }

    try {
      await appendAudit({
        actor_email: "student",
        actor_role: "unknown",
        action: result.reopened ? "student.fix_rejected" : `student.fix_${body.verdict}`,
        target: result.issue.ticket_code,
        detail: result.reopened
          ? `Fix claim rejected by students — reopened for ${result.issue.department}.`
          : `Student marked the fix "${body.verdict}"${photo_url ? " with a photo" : ""}.`,
        ip: requestIp(req),
      });
    } catch {
      // The check already counted. A log outage must not undo it.
    }

    return NextResponse.json({
      ok: true,
      reopened: result.reopened,
      state: result.state,
      issue: publicIssue(result.issue),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof HttpError ? error.message : "Could not record your check. Please retry." }, { status: error instanceof HttpError ? error.status : 503 });
  }
}
