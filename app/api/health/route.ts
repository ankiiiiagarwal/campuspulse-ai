import { NextResponse } from "next/server";
import { allBuildingHealth, computeHealth, trailStats } from "@/lib/health";
import { listClusters, listIssues, loadSnapshot } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const [issues, clusters, snap] = await Promise.all([listIssues(), listClusters(), loadSnapshot()]);
  const campus = computeHealth(snap.issues, snap.clusters);
  const buildings = allBuildingHealth(snap.issues, snap.clusters);
  const trail = trailStats(snap.issues);
  const recentResolved = issues
    .filter((i) => i.status === "resolved" && i.resolved_at)
    .sort((a, b) => String(b.resolved_at).localeCompare(String(a.resolved_at)))
    .slice(0, 8);
  return NextResponse.json({ campus, buildings, trail, recentResolved, clusterCount: clusters.length });
}
