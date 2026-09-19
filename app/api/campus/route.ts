import { NextResponse } from "next/server";
import { pointInBoundary } from "@/lib/geo";
import { getCampusBoundary } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const boundary = await getCampusBoundary();
    const url = new URL(req.url);
    const lat = Number(url.searchParams.get("lat"));
    const lng = Number(url.searchParams.get("lng"));
    const asked = Number.isFinite(lat) && Number.isFinite(lng) && url.searchParams.has("lat");
    const inside = asked && boundary ? pointInBoundary({ lat, lng }, boundary) : null;
    return NextResponse.json({
      boundary,
      ready: Boolean(boundary),
      inside,
      message: boundary
        ? asked
          ? inside
            ? "Inside the campus area."
            : "That location is outside the campus area."
          : null
        : "No campus area is set. Reports can be pinned anywhere.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load campus area";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
