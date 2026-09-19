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

/** Points added per rejected fix claim, so a job sent back cannot be buried again. */
export const REOPEN_BOOST = 8;

/** Counts at most two rejected claims. Beyond that the queue position no longer changes. */
export function reopenBoost(reopenCount = 0): number {
  return clamp(Math.floor(reopenCount), 0, 2) * REOPEN_BOOST;
}

/**
 * Locked priority 0–100.
 * 40% safety + 25% affected + 20% age + 15% location, then +8 per rejected fix claim.
 */
export function computePriority(input: {
  safety: number;
  reportCount: number;
  meTooCount: number;
  createdAt: string;
  locationWeight: number;
  reopenCount?: number;
  now?: number;
}): number {
  const safety = clamp(input.safety, 1, 5);
  const affected = affectedScore(input.reportCount, input.meTooCount);
  const age = ageScore(input.createdAt, input.now);
  const location = clamp(input.locationWeight, 1, 5);
  const raw = 100 * (0.4 * (safety / 5) + 0.25 * (affected / 5) + 0.2 * (age / 5) + 0.15 * (location / 5));
  return clamp(Math.round(raw * 10) / 10 + reopenBoost(input.reopenCount), 0, 100);
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
    reopenCount: issue.reopen_count,
    now,
  });
}

export function explainPriority(
  issue: Pick<Issue, "safety" | "location_weight" | "created_at" | "building"> & {
    report_count: number;
    me_too_count: number;
    reopen_count?: number;
  },
  now = Date.now(),
): {
  safety: number;
  affected: number;
  age: number;
  location: number;
  hours: number;
  people: number;
  reopens: number;
  label: string;
} {
  const safety = clamp(issue.safety, 1, 5);
  const people = issue.report_count + issue.me_too_count;
  const affected = affectedScore(issue.report_count, issue.me_too_count);
  const age = ageScore(issue.created_at, now);
  const location = clamp(issue.location_weight, 1, 5);
  const hours = hoursSince(issue.created_at, now);
  const ageText = hours < 1 ? `${Math.max(1, Math.round(hours * 60))}m old` : `${Math.round(hours)}h old`;
  const place = issue.building.replace(/,.*/, "").trim() || issue.building;
  const reopens = Math.max(0, issue.reopen_count ?? 0);
  const sentBack = reopens ? ` · sent back ${reopens}×` : "";
  return {
    safety,
    affected,
    age,
    location,
    hours,
    people,
    reopens,
    label: `Safety ${safety} · ${people} ${people === 1 ? "person" : "people"} · ${ageText} · ${place}${sentBack}`,
  };
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
    reopenCount: lead.reopen_count,
    now,
  });
}
