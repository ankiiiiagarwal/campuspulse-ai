import { NextResponse } from "next/server";
import { deskFromRequest, getStaffSession } from "@/lib/auth";
import { scopeIssuesForSession } from "@/lib/departments";
import { publicIssues } from "@/lib/public-issue";
import { computeHealth, fixedThisWeek, listHotspots, placeHealth, trailByDepartment, trailStats } from "@/lib/health";
import { listInventory } from "@/lib/store";
import { proofStats, proofStatsByDepartment } from "@/lib/verification";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getStaffSession(deskFromRequest(req));
  const { issues: allIssues, clusters: allClusters } = await listInventory();
  const { issues, clusters } = scopeIssuesForSession(session, allIssues, allClusters);
  const campus = computeHealth(issues, clusters);
  const places = placeHealth(issues, clusters);
  const trail = trailStats(issues);
  const departments = trailByDepartment(issues);
  const recentResolved = issues
    .filter((i) => i.status === "resolved" && i.resolved_at)
    .sort((a, b) => String(b.resolved_at).localeCompare(String(a.resolved_at)))
    .slice(0, 8);
  return NextResponse.json({
    campus,
    places,
    trail,
    departments,
    proof: proofStats(issues),
    proofByDepartment: proofStatsByDepartment(issues),
    hotspots: listHotspots(issues, clusters),
    recentResolved: publicIssues(recentResolved),
    fixedThisWeek: fixedThisWeek(issues),
    clusterCount: clusters.length,
  });
}
