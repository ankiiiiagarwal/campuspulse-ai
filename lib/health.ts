import { buildingByName } from "./campus";
import { DEPARTMENTS, STORED_DEPT_TO_KEY, placeDeskKey } from "./departments";
import type { DeptKey } from "./types";
import { clamp, hoursSince, isOpenish, isOverdue } from "./scoring";
import type { Cluster, Department, HealthBreakdown, Hotspot, Issue, PlaceHealth, TrailStats } from "./types";
import { proofState } from "./verification";

export function computeHealth(issues: Issue[], clusters: Cluster[], now = Date.now()): HealthBreakdown {
  // One job per cluster so a merged second report does not double-penalize health.
  const openish = clusters.filter((c) => isOpenish(c.status));
  const critical_open = openish.filter((c) => c.severity === "critical").length;
  const high_open = openish.filter((c) => c.severity === "high").length;
  const medium_open = openish.filter((c) => c.severity === "medium").length;
  const overdue = issues.filter((i) => isOverdue(i, now)).length;
  // One hotspot per place + category. Every cluster there carries the recurring flag,
  // so counting flags would charge the same hotspot many times over.
  const recurring_hotspots = new Set(
    clusters.filter((c) => c.is_recurring).map((c) => `${c.building}\t${c.category}`),
  ).size;
  // Closing a ticket only earns back the points once a fix claim survives student checks,
  // so a desk cannot lift the score by closing work it did not do.
  const unconfirmed_claims = issues.filter((i) => proofState(i, now) === "unconfirmed").length;
  const reopened_open = issues.filter((i) => proofState(i, now) === "reopened").length;
  const score = clamp(
    100 -
      6 * critical_open -
      3 * high_open -
      1 * medium_open -
      4 * overdue -
      5 * recurring_hotspots -
      2 * unconfirmed_claims -
      5 * reopened_open,
    0,
    100,
  );
  return {
    score,
    critical_open,
    high_open,
    medium_open,
    overdue,
    recurring_hotspots,
    unconfirmed_claims,
    reopened_open,
  };
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
  const names = [...new Set([...issues.map((i) => i.building), ...clusters.map((c) => c.building)])].filter(Boolean);
  return names
    .map((name) => ({
      id: buildingByName(name)?.id || name.toLowerCase().replace(/\s+/g, "-"),
      name,
      ...buildingHealth(name, issues, clusters, now),
      open_count: clusters.filter((c) => c.building === name && isOpenish(c.status)).length,
    }))
    .sort((a, b) => a.score - b.score || a.name.localeCompare(b.name));
}

function deskForPlace(building: string): DeptKey {
  return placeDeskKey(building) || "campus";
}

export function placeHealth(issues: Issue[], clusters: Cluster[], now = Date.now()): PlaceHealth[] {
  return DEPARTMENTS.map((name) => {
    const key = STORED_DEPT_TO_KEY[name];
    const scopedIssues = issues.filter((i) => deskForPlace(i.building) === key);
    const scopedClusters = clusters.filter((c) => deskForPlace(c.building) === key);
    return {
      name,
      ...computeHealth(scopedIssues, scopedClusters, now),
      open_count: scopedClusters.filter((c) => isOpenish(c.status)).length,
    };
  });
}

export function fixedThisWeek(issues: Issue[], now = Date.now()) {
  const cut = now - 7 * 86_400_000;
  return issues
    .filter((i) => i.status === "resolved" && i.resolved_at && new Date(i.resolved_at).getTime() >= cut)
    .sort((a, b) => String(b.resolved_at).localeCompare(String(a.resolved_at)))
    .map((i) => ({
      id: i.id,
      ticket_code: i.ticket_code,
      title: i.description.slice(0, 72),
      building: i.building,
      department: i.department as Department,
      resolved_at: i.resolved_at as string,
      proof: proofState(i, now),
      verified_count: i.verified_count ?? 0,
      verify_deadline_at: i.verify_deadline_at,
    }));
}

export function trailByDepartment(issues: Issue[]): Array<{ name: Department } & TrailStats> {
  return DEPARTMENTS.map((name) => ({
    name,
    ...trailStats(issues.filter((i) => i.department === name)),
  }));
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

/** Same place + category at least 3 times in 14 days — the rows health already penalizes. */
export function listHotspots(issues: Issue[], clusters: Cluster[], now = Date.now()): Hotspot[] {
  const cutoff = now - 14 * 86_400_000;
  const keys = new Set(
    markRecurring(issues, clusters, now)
      .filter((c) => c.is_recurring)
      .map((c) => `${c.building}\t${c.category}`),
  );
  return [...keys]
    .map((key) => {
      const [building, category] = key.split("\t");
      const recent = issues.filter(
        (i) => i.building === building && i.category === category && new Date(i.created_at).getTime() >= cutoff,
      );
      const open = issues.filter((i) => i.building === building && i.category === category && i.status !== "resolved");
      const lead = open[0] || recent[0];
      return {
        building,
        category,
        count: recent.length,
        open_count: open.length,
        ticket_code: lead?.ticket_code || "",
        title: (lead?.description || "").slice(0, 72),
      };
    })
    .sort((a, b) => b.count - a.count || a.building.localeCompare(b.building));
}
