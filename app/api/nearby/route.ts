import { NextResponse } from "next/server";
import { findNearby, tokenEmbedding } from "@/lib/duplicates";
import { loadSnapshot } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  const text = (url.searchParams.get("text") || "").trim();
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || text.length < 4) {
    return NextResponse.json({ matches: [] });
  }
  const snap = await loadSnapshot();
  const locationId = url.searchParams.get("location") || undefined;
  const location = locationId ? snap.locations?.find(l => l.id === locationId) : undefined;
  if (locationId && !location) return NextResponse.json({ matches: [] });
  const building = location ? `${location.department}, ${location.name}` : url.searchParams.get("building")?.slice(0, 160);
  const matches = findNearby(snap.clusters, snap.issues, location?.lat ?? lat, location?.lng ?? lng, text.slice(0,4000), tokenEmbedding(text.slice(0,4000)), { building, location_id: locationId }).slice(0, 3);
  return NextResponse.json({
    matches: matches.map((m) => ({
      cluster_id: m.cluster.id,
      issue_id: m.issue.id,
      ticket_code: m.issue.ticket_code,
      title: m.cluster.title,
      building: m.cluster.building,
      category: m.cluster.category,
      status: m.cluster.status,
      meters: m.meters,
      report_count: m.cluster.report_count,
      me_too_count: m.cluster.me_too_count,
    })),
  });
}
