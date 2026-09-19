import { describe, expect, it } from "vitest";
import { computeHealth, markRecurring } from "@/lib/health";
import type { Cluster, Issue } from "@/lib/types";

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

function issue(partial: Partial<Issue> & Pick<Issue, "id" | "cluster_id">): Issue {
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

describe("campus health", () => {
  it("starts at 100 with an empty queue", () => {
    expect(computeHealth([], []).score).toBe(100);
  });

  it("penalizes one critical open cluster by 6", () => {
    const score = computeHealth([], [cluster({ id: "c1", severity: "critical" })]).score;
    expect(score).toBe(94);
  });

  it("does not double-count two reports in the same cluster", () => {
    const c = cluster({ id: "c1", severity: "high" });
    const issues = [issue({ id: "i1", cluster_id: "c1" }), issue({ id: "i2", cluster_id: "c1" })];
    expect(computeHealth(issues, [c]).high_open).toBe(1);
    expect(computeHealth(issues, [c]).score).toBe(97);
  });

  it("flags a hotspot after 3 same-place reports in 14 days", () => {
    const now = Date.now();
    const issues = [1, 2, 3].map((n) =>
      issue({
        id: `i${n}`,
        cluster_id: `c${n}`,
        building: "Hostel",
        category: "Washroom",
        created_at: new Date(now - n * 3600_000).toISOString(),
      }),
    );
    const clusters = issues.map((i) => cluster({ id: i.cluster_id, building: "Hostel", category: "Washroom" }));
    const marked = markRecurring(issues, clusters, now);
    expect(marked.every((c) => c.is_recurring)).toBe(true);
  });

  it("charges one hotspot per place and category, not one per cluster", () => {
    const now = Date.now();
    const issues = [1, 2, 3, 4, 5].map((n) =>
      issue({
        id: `i${n}`,
        cluster_id: `c${n}`,
        building: "Library",
        category: "Electrical / lights",
        created_at: new Date(now - n * 3600_000).toISOString(),
      }),
    );
    const clusters = markRecurring(
      issues,
      issues.map((i) => cluster({ id: i.cluster_id, building: "Library", category: "Electrical / lights" })),
      now,
    );
    const health = computeHealth(issues, clusters, now);
    expect(health.recurring_hotspots).toBe(1);
    // 5 medium clusters (-5) and a single hotspot (-5), not five hotspots.
    expect(health.score).toBe(90);
  });
});
