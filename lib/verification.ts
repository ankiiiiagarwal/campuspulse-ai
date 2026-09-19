import { DEPARTMENTS } from "./departments";
import type { Department, Issue, ProofState, ProofStats, Verdict, Verification } from "./types";

/** Students get this long to check a fix claim before it settles. */
export const VERIFY_WINDOW_HOURS = 48;

/** Confirmations that settle a claim as verified without waiting out the window. */
export const CONFIRMATIONS_TO_VERIFY = 2;

/**
 * Dispute weight that sends a job back. A dispute carrying a photo weighs 2,
 * so one photo of the still-broken thing is enough on its own.
 */
export const DISPUTE_WEIGHT_TO_REOPEN = 2;

export function disputeWeight(hasPhoto: boolean): number {
  return hasPhoto ? 2 : 1;
}

export function verifyDeadlineFrom(claimedAt: string, hours = VERIFY_WINDOW_HOURS): string {
  return new Date(new Date(claimedAt).getTime() + hours * 3_600_000).toISOString();
}

type ProofIssue = Pick<
  Issue,
  "status" | "verify_deadline_at" | "verified_count" | "verified_at" | "reopen_count"
>;

/**
 * Single source of truth for how a fix claim reads right now. Derived rather than
 * stored so a missed sweep can never leave a claim looking verified when it is not.
 */
export function proofState(issue: ProofIssue, now = Date.now()): ProofState {
  if (issue.status !== "resolved") return (issue.reopen_count ?? 0) > 0 ? "reopened" : "none";
  const confirmed = issue.verified_count ?? 0;
  if (issue.verified_at || confirmed >= CONFIRMATIONS_TO_VERIFY) return "verified";
  const deadline = issue.verify_deadline_at ? Date.parse(issue.verify_deadline_at) : NaN;
  if (Number.isFinite(deadline) && now < deadline) return "awaiting";
  return confirmed > 0 ? "verified" : "unconfirmed";
}

/** Open for checking: a live claim nobody has settled yet. */
export function isAwaitingCheck(issue: ProofIssue, now = Date.now()): boolean {
  return proofState(issue, now) === "awaiting";
}

export function wasReopened(issue: Pick<Issue, "reopen_count">): boolean {
  return (issue.reopen_count ?? 0) > 0;
}

/** Total dispute weight already recorded against the current claim. */
export function disputeWeightFor(
  verifications: Verification[],
  issueId: string,
  round: number,
): number {
  return verifications
    .filter((v) => v.issue_id === issueId && v.round === round && v.verdict === "broken")
    .reduce((sum, v) => sum + disputeWeight(Boolean(v.photo_url)), 0);
}

export function alreadyChecked(
  verifications: Verification[],
  issueId: string,
  round: number,
  clientHash: string,
): boolean {
  return verifications.some(
    (v) => v.issue_id === issueId && v.round === round && v.client_hash === clientHash,
  );
}

export function isVerdict(value: unknown): value is Verdict {
  return value === "fixed" || value === "broken";
}

function emptyProofStats(): ProofStats {
  return {
    claims: 0,
    verified: 0,
    disputed: 0,
    awaiting: 0,
    unconfirmed: 0,
    verified_rate: null,
    reopen_rate: null,
  };
}

/**
 * Every reopen is a claim students rejected; every currently-closed ticket is a
 * claim in one of the settled buckets. Counting both is what makes the rate
 * impossible to improve by closing tickets faster.
 */
export function proofStats(issues: Issue[], now = Date.now()): ProofStats {
  const stats = emptyProofStats();
  for (const issue of issues) {
    stats.disputed += issue.reopen_count ?? 0;
    if (issue.status !== "resolved") continue;
    const state = proofState(issue, now);
    if (state === "verified") stats.verified += 1;
    else if (state === "awaiting") stats.awaiting += 1;
    else if (state === "unconfirmed") stats.unconfirmed += 1;
  }
  stats.claims = stats.disputed + stats.verified + stats.awaiting + stats.unconfirmed;
  const judged = stats.verified + stats.disputed;
  stats.verified_rate = judged ? Math.round((stats.verified / judged) * 100) / 100 : null;
  stats.reopen_rate = stats.claims ? Math.round((stats.disputed / stats.claims) * 100) / 100 : null;
  return stats;
}

export function proofStatsByDepartment(
  issues: Issue[],
  now = Date.now(),
): Array<{ name: Department } & ProofStats> {
  return DEPARTMENTS.map((name) => ({
    name,
    ...proofStats(
      issues.filter((i) => i.department === name),
      now,
    ),
  }));
}

/** Closed tickets a student could still settle, soonest deadline first. */
export function awaitingCheck<T extends ProofIssue & { verify_deadline_at: string | null }>(
  issues: T[],
  now = Date.now(),
): T[] {
  return issues
    .filter((i) => isAwaitingCheck(i, now))
    .sort((a, b) => String(a.verify_deadline_at).localeCompare(String(b.verify_deadline_at)));
}

export function formatRate(rate: number | null): string {
  if (rate == null) return "—";
  return `${Math.round(rate * 100)}%`;
}
