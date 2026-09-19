import { NextResponse } from "next/server";
import { classifyReport } from "@/lib/classify";
import { limited } from "@/lib/rate-limit";
import { readJson, textField } from "@/lib/request-body";
import { HttpError } from "@/lib/geo";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
  if (await limited(req, "classify", { limit: 20 })) {
    return NextResponse.json({ error: "Too many classify requests. Wait a few minutes." }, { status: 429 });
  }
  const body = (await readJson(req)) as { description?: string; building?: string };
  const description = (typeof body.description === "string" ? body.description : "").trim();
  if (description.length < 4 || description.length > 4000) {
    return NextResponse.json({ error: "Need a short description" }, { status: 400 });
  }
  const building = body.building == null ? undefined : textField(body.building, "Place", 160);
  const result = await classifyReport(description, building);
  return NextResponse.json(result);
  } catch(e) { return NextResponse.json({ error: e instanceof HttpError ? e.message : "Classification is unavailable. Please try again." }, { status: e instanceof HttpError ? e.status : 503 }); }
}
