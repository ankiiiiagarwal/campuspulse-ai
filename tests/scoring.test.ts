import { describe, expect, it } from "vitest";
import { affectedScore, ageScore, computePriority, explainPriority, isOverdue } from "@/lib/scoring";

describe("priority formula", () => {
  it("weights safety 40%, affected 25%, age 20%, location 15%", () => {
    const now = Date.now();
    expect(
      computePriority({
        safety: 5,
        reportCount: 5,
        meTooCount: 0,
        createdAt: new Date(now - 72 * 3600_000).toISOString(),
        locationWeight: 5,
        now,
      }),
    ).toBe(100);
    expect(
      computePriority({
        safety: 5,
        reportCount: 5,
        meTooCount: 0,
        createdAt: new Date(now - 36 * 3600_000).toISOString(),
        locationWeight: 5,
        now,
      }),
    ).toBe(92);
  });

  it("caps affected at 5", () => {
    expect(affectedScore(12, 20)).toBe(5);
    expect(affectedScore(1, 0)).toBe(1);
  });

  it("ages linearly to 72 hours", () => {
    const now = Date.now();
    expect(ageScore(new Date(now).toISOString(), now)).toBe(1);
    expect(ageScore(new Date(now - 72 * 3600_000).toISOString(), now)).toBe(5);
    expect(ageScore(new Date(now - 200 * 3600_000).toISOString(), now)).toBe(5);
  });

  it("marks open tickets overdue after 72 hours", () => {
    const old = new Date(Date.now() - 80 * 3600_000).toISOString();
    expect(isOverdue({ status: "open", created_at: old })).toBe(true);
    expect(isOverdue({ status: "resolved", created_at: old })).toBe(false);
    expect(isOverdue({ status: "open", created_at: new Date().toISOString() })).toBe(false);
  });

  it("explains the four terms in plain language", () => {
    const tip = explainPriority({
      safety: 5,
      location_weight: 5,
      created_at: new Date(Date.now() - 18 * 3600_000).toISOString(),
      building: "Library, second floor",
      report_count: 3,
      me_too_count: 1,
    });
    expect(tip.label).toContain("Safety 5");
    expect(tip.label).toContain("4 people");
    expect(tip.label).toContain("Library");
    expect(tip.people).toBe(4);
  });
});
