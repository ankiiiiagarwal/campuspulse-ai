import { describe, expect, it } from "vitest";
import { computeHealth } from "@/lib/health";
import { computePriority, reopenBoost } from "@/lib/scoring";
import type { Cluster, Issue } from "@/lib/types";
import {
  CONFIRMATIONS_TO_VERIFY,
  DISPUTE_WEIGHT_TO_REOPEN,
  awaitingCheck,
  disputeWeight,
  disputeWeightFor,
  proofState,
  proofStats,
  verifyDeadlineFrom,
  VERIFY_WINDOW_HOURS,
} from "@/lib/verification";

const HOUR = 3_600_000;

function issue(partial: Partial<Issue> & Pick<Issue, "id">): Issue {
  return {
    ticket_code: "CP-1",
    description: "x",
    category: "Other",
    severity: "low",
    department: "Campus",
    status: "open",
    safety: 2,
    location_weight: 3,
    priority: 10,
    lat: 1,
    lng: 1,
    building: "Campus",
    photo_url: null,
    resolve_photo_url: null,
    eta_at: null,
    embedding: null,
    cluster_id: "c1",
    created_at: new Date().toISOString(),
    assigned_at: null,
    resolved_at: null,
    worker_name: null,
    escalated_at: null,
    verify_deadline_at: null,
    verified_count: 0,
    disputed_count: 0,
    verified_at: null,
    reopen_count: 0,
    claim_round: 0,
    ...partial,
  };
}

function cluster(partial: Partial<Cluster> & Pick<Cluster, "id">): Cluster {
  return {
    title: "t",
    category: "Other",
    building: "Campus",
    report_count: 1,
    me_too_count: 0,
    priority: 10,
    is_recurring: false,
    lat: 1,
    lng: 1,
    status: "open",
    severity: "medium",
    created_at: new Date().toISOString(),
    ...partial,
  };
}

/** A closed ticket whose check window is still open. */
function claimed(over: Partial<Issue> = {}, hoursAgo = 1): Issue {
  const at = new Date(Date.now() - hoursAgo * HOUR).toISOString();
  return issue({
    id: "i1",
    status: "resolved",
    resolved_at: at,
    verify_deadline_at: verifyDeadlineFrom(at),
    ...over,
  });
}

describe("fix claim state", () => {
  it("treats a fresh closure as a claim awaiting a student check", () => {
    expect(proofState(claimed())).toBe("awaiting");
  });

  it("settles as verified once enough students confirm", () => {
    expect(proofState(claimed({ verified_count: CONFIRMATIONS_TO_VERIFY }))).toBe("verified");
  });

  it("keeps a single confirmation awaiting until the window closes", () => {
    expect(proofState(claimed({ verified_count: 1 }))).toBe("awaiting");
    const old = claimed({ verified_count: 1 }, VERIFY_WINDOW_HOURS + 1);
    expect(proofState(old)).toBe("verified");
  });

  it("marks an expired claim nobody checked as unconfirmed", () => {
    expect(proofState(claimed({}, VERIFY_WINDOW_HOURS + 1))).toBe("unconfirmed");
  });

  it("reads an open ticket with a rejected claim as reopened", () => {
    expect(proofState(issue({ id: "i1", status: "assigned", reopen_count: 1 }))).toBe("reopened");
    expect(proofState(issue({ id: "i1", status: "assigned" }))).toBe("none");
  });

  it("lists claims a student can still settle, soonest deadline first", () => {
    const soon = claimed({ verify_deadline_at: new Date(Date.now() + HOUR).toISOString() });
    const later = { ...claimed({ verify_deadline_at: new Date(Date.now() + 10 * HOUR).toISOString() }), id: "i2" };
    const settled = { ...claimed({ verified_count: 5 }), id: "i3" };
    const open = issue({ id: "i4" });
    expect(awaitingCheck([later, open, soon, settled]).map((i) => i.id)).toEqual(["i1", "i2"]);
  });
});

describe("dispute weight", () => {
  it("lets one photo-backed dispute reach the reopen threshold alone", () => {
    expect(disputeWeight(true)).toBeGreaterThanOrEqual(DISPUTE_WEIGHT_TO_REOPEN);
    expect(disputeWeight(false)).toBeLessThan(DISPUTE_WEIGHT_TO_REOPEN);
  });

  it("counts only disputes against the current round", () => {
    const rows = [
      { id: "v1", issue_id: "i1", cluster_id: "c1", client_hash: "a", verdict: "broken" as const, round: 0, photo_url: null, created_at: "" },
      { id: "v2", issue_id: "i1", cluster_id: "c1", client_hash: "b", verdict: "fixed" as const, round: 0, photo_url: null, created_at: "" },
      { id: "v3", issue_id: "i1", cluster_id: "c1", client_hash: "c", verdict: "broken" as const, round: 1, photo_url: null, created_at: "" },
    ];
    expect(disputeWeightFor(rows, "i1", 0)).toBe(1);
    expect(disputeWeightFor(rows, "i1", 1)).toBe(1);
  });
});

describe("department fix-claim record", () => {
  it("counts every rejected claim, not just the latest closure", () => {
    const stats = proofStats([
      claimed({ verified_count: 2 }),
      { ...claimed({ verified_count: 2, reopen_count: 1 }), id: "i2" },
      { ...issue({ id: "i3", status: "assigned", reopen_count: 1 }) },
      { ...claimed({}, VERIFY_WINDOW_HOURS + 1), id: "i4" },
      { ...claimed(), id: "i5" },
    ]);
    expect(stats.verified).toBe(2);
    expect(stats.disputed).toBe(2);
    expect(stats.unconfirmed).toBe(1);
    expect(stats.awaiting).toBe(1);
    expect(stats.claims).toBe(6);
    expect(stats.verified_rate).toBe(0.5);
  });

  it("has no rate until students have judged a claim", () => {
    expect(proofStats([issue({ id: "i1" })]).verified_rate).toBeNull();
    expect(proofStats([claimed()]).verified_rate).toBeNull();
  });
});

describe("health credit for fixes", () => {
  it("gives no points back for a closure nobody confirmed", () => {
    const stale = claimed({}, VERIFY_WINDOW_HOURS + 1);
    const health = computeHealth([stale], [cluster({ id: "c1", status: "resolved" })]);
    expect(health.unconfirmed_claims).toBe(1);
    expect(health.score).toBe(98);
  });

  it("gives full credit once the fix is verified", () => {
    const good = claimed({ verified_count: 2 }, VERIFY_WINDOW_HOURS + 1);
    const health = computeHealth([good], [cluster({ id: "c1", status: "resolved" })]);
    expect(health.unconfirmed_claims).toBe(0);
    expect(health.score).toBe(100);
  });

  it("penalizes a job students sent back harder than a fresh one", () => {
    const sentBack = issue({ id: "i1", status: "assigned", reopen_count: 1, severity: "low" });
    const health = computeHealth([sentBack], [cluster({ id: "c1", status: "assigned", severity: "low" })]);
    expect(health.reopened_open).toBe(1);
    expect(health.score).toBe(95);
  });
});

describe("priority after a rejected fix", () => {
  it("lifts a sent-back job above the same job before the claim", () => {
    const base = {
      safety: 2,
      reportCount: 1,
      meTooCount: 0,
      createdAt: new Date().toISOString(),
      locationWeight: 2,
    };
    expect(computePriority({ ...base, reopenCount: 1 })).toBe(computePriority(base) + 8);
  });

  it("stops counting past two rejected claims and never exceeds 100", () => {
    expect(reopenBoost(5)).toBe(reopenBoost(2));
    expect(
      computePriority({
        safety: 5,
        reportCount: 5,
        meTooCount: 0,
        createdAt: new Date(Date.now() - 100 * HOUR).toISOString(),
        locationWeight: 5,
        reopenCount: 2,
      }),
    ).toBe(100);
  });
});
