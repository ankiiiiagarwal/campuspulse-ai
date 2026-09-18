import { NextResponse } from "next/server";
import { classifyReport } from "@/lib/classify";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { description?: string; building?: string };
  const description = (body.description || "").trim();
  if (description.length < 4) {
    return NextResponse.json({ error: "Need a short description" }, { status: 400 });
  }
  const result = await classifyReport(description, body.building);
  return NextResponse.json(result);
}
