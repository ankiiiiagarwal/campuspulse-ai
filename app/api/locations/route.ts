import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { DEPARTMENTS } from "@/lib/departments";
import { HttpError } from "@/lib/geo";
import { readJson, textField } from "@/lib/request-body";
import { limited } from "@/lib/rate-limit";
import { loadSnapshot, registerLocation } from "@/lib/store";
import type { Department } from "@/lib/types";
export const dynamic = "force-dynamic";
export async function GET() {
  try { return NextResponse.json({ locations: (await loadSnapshot(false)).locations ?? [] }); }
  catch { return NextResponse.json({ error: "Could not load QR locations. Check database migrations." }, { status: 503 }); }
}
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin login required" }, { status: 401 });
  try {
    if (await limited(req, "location-create", { limit: 30 })) return NextResponse.json({ error: "Please wait before creating more locations." }, { status: 429 });
    const body = await readJson(req) as Record<string, unknown>;
    const name = textField(body.name, "Specific location", 120, 3);
    const department = body.department as Department;
    if (!DEPARTMENTS.includes(department) || typeof body.lat !== "number" || typeof body.lng !== "number") throw new HttpError("Choose a department and map pin.", 400);
    const location = await registerLocation({ name, department, lat: body.lat, lng: body.lng });
    return NextResponse.json({ location }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save location" }, { status: error instanceof HttpError ? error.status : 500 }); }
}
