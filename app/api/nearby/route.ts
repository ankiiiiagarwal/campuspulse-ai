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
  const matches = findNearby(snap.clusters, snap.issues, lat, lng, text, tokenEmbedding(text)).slice(0, 3);
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
