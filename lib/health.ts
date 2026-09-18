import { BUILDINGS } from "./campus";
import { clamp, hoursSince, isOpenish, isOverdue } from "./scoring";
import type { Cluster, HealthBreakdown, Issue, TrailStats } from "./types";

export function computeHealth(issues: Issue[], clusters: Cluster[], now = Date.now()): HealthBreakdown {
  // One job per cluster so a merged second report does not double-penalize health.
  const openish = clusters.filter((c) => isOpenish(c.status));
  const critical_open = openish.filter((c) => c.severity === "critical").length;
  const high_open = openish.filter((c) => c.severity === "high").length;
  const medium_open = openish.filter((c) => c.severity === "medium").length;
  const overdue = issues.filter((i) => isOverdue(i, now)).length;
  const recurring_hotspots = clusters.filter((c) => c.is_recurring).length;
  const score = clamp(
    100 - 6 * critical_open - 3 * high_open - 1 * medium_open - 4 * overdue - 5 * recurring_hotspots,
    0,
    100,
  );
  return { score, critical_open, high_open, medium_open, overdue, recurring_hotspots };
}

export function buildingHealth(
  building: string,
  issues: Issue[],
  clusters: Cluster[],
  now = Date.now(),
): HealthBreakdown {
  return computeHealth(
    issues.filter((i) => i.building === building),
    clusters.filter((c) => c.building === building),
    now,
  );
}

export function allBuildingHealth(issues: Issue[], clusters: Cluster[], now = Date.now()) {
  return BUILDINGS.map((b) => ({
    id: b.id,
    name: b.name,
    ...buildingHealth(b.name, issues, clusters, now),
    open_count: clusters.filter((c) => c.building === b.name && isOpenish(c.status)).length,
  })).sort((a, b) => a.score - b.score);
}

export function trailStats(issues: Issue[]): TrailStats {
  const assignHours = issues
    .filter((i) => i.assigned_at)
    .map((i) => hoursSince(i.created_at, new Date(i.assigned_at as string).getTime()));
  const resolveHours = issues
    .filter((i) => i.resolved_at)
    .map((i) => hoursSince(i.created_at, new Date(i.resolved_at as string).getTime()));
  const mean = (xs: number[]) => (xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 10) / 10 : null);
  return {
    avg_assign_hrs: mean(assignHours),
    avg_resolve_hrs: mean(resolveHours),
    assigned_or_resolved: assignHours.length,
    resolved_count: resolveHours.length,
  };
}

export function markRecurring(issues: Issue[], clusters: Cluster[], now = Date.now()): Cluster[] {
  const cutoff = now - 14 * 86_400_000;
  return clusters.map((c) => {
    const recent = issues.filter(
      (i) => i.building === c.building && i.category === c.category && new Date(i.created_at).getTime() >= cutoff,
    );
    return { ...c, is_recurring: recent.length >= 3 };
  });
}
