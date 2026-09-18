import type { Cluster, Issue, Status } from "./types";

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** Affected students, 1–5. First report + extras + Me too, capped. */
export function affectedScore(reportCount: number, meTooCount: number): number {
  return clamp(reportCount + meTooCount, 1, 5);
}

/** Age 1–5, linear over 72 hours, then cap. */
export function ageScore(createdAt: string, now = Date.now()): number {
  const hours = Math.max(0, (now - new Date(createdAt).getTime()) / 3_600_000);
  return clamp(1 + 4 * (hours / 72), 1, 5);
}

export function hoursSince(iso: string, now = Date.now()): number {
  return Math.max(0, (now - new Date(iso).getTime()) / 3_600_000);
}

/**
 * Locked priority 0–100.
 * 40% safety + 25% affected + 20% age + 15% location.
 */
export function computePriority(input: {
  safety: number;
  reportCount: number;
  meTooCount: number;
  createdAt: string;
  locationWeight: number;
  now?: number;
}): number {
  const safety = clamp(input.safety, 1, 5);
  const affected = affectedScore(input.reportCount, input.meTooCount);
  const age = ageScore(input.createdAt, input.now);
  const location = clamp(input.locationWeight, 1, 5);
  const raw = 100 * (0.4 * (safety / 5) + 0.25 * (affected / 5) + 0.2 * (age / 5) + 0.15 * (location / 5));
  return Math.round(raw * 10) / 10;
}

export function isOverdue(issue: Pick<Issue, "status" | "created_at">, now = Date.now()): boolean {
  if (issue.status !== "open" && issue.status !== "assigned") return false;
  return hoursSince(issue.created_at, now) > 72;
}

export function isOpenish(status: Status): boolean {
  return status !== "resolved";
}

export function recomputeIssuePriority(issue: Issue, cluster: Cluster, now = Date.now()): number {
  return computePriority({
    safety: issue.safety,
    reportCount: cluster.report_count,
    meTooCount: cluster.me_too_count,
    createdAt: issue.created_at,
    locationWeight: issue.location_weight,
    now,
  });
}

export function clusterPriorityFromIssues(cluster: Cluster, issues: Issue[], now = Date.now()): number {
  const members = issues.filter((i) => i.cluster_id === cluster.id);
  const lead = members.find((i) => i.status !== "resolved") ?? members[0];
  if (!lead) return cluster.priority;
  return computePriority({
    safety: lead.safety,
    reportCount: cluster.report_count,
    meTooCount: cluster.me_too_count,
    createdAt: cluster.created_at,
    locationWeight: lead.location_weight,
    now,
  });
}
