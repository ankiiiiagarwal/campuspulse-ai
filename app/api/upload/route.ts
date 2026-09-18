import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { savePhoto } from "@/lib/upload";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { image?: string; kind?: "report" | "resolve" };
  if (!body.image) return NextResponse.json({ error: "Missing image" }, { status: 400 });
  const kind = body.kind === "resolve" ? "resolve" : "report";
  if (kind === "resolve") {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: "Admin login required" }, { status: 401 });
  }
  try {
    const url = await savePhoto(body.image, kind);
    return NextResponse.json({ url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
