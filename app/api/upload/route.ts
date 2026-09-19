import { readJson } from "@/lib/request-body";
import { HttpError } from "@/lib/geo";
import { NextResponse } from "next/server";
import { deskFromRequest, requireStaff } from "@/lib/auth";
import { limited } from "@/lib/rate-limit";
import { savePhoto } from "@/lib/upload";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (await limited(req, "upload", { limit: 20 })) {
    return NextResponse.json({ error: "Too many uploads. Wait a few minutes." }, { status: 429 });
  }
  try {
    const body = (await readJson(req, 6_001_024)) as { image?: string; kind?: "report" | "resolve" };
    if (!body.image) return NextResponse.json({ error: "Missing image" }, { status: 400 });
    const kind = body.kind === "resolve" ? "resolve" : "report";
    if (kind === "resolve") {
      const staff = await requireStaff(deskFromRequest(req));
      if (!staff) return NextResponse.json({ error: "Staff login required" }, { status: 401 });
    }
    const url = await savePhoto(body.image, kind);
    return NextResponse.json({ url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: err instanceof HttpError ? err.status : 400 });
  }
}
