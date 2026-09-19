import { describe, expect, it } from "vitest";
import { findMergeTarget, haversineMeters, jaccard, textSimilar, tokens } from "@/lib/duplicates";
import type { Cluster, Issue } from "@/lib/types";

describe("duplicate similarity", () => {
  it("treats overlapping issue text as similar", () => {
    expect(textSimilar("Library Wi-Fi is dead on the second floor", "wifi is dead in the library stacks")).toBe(true);
  });

  it("does not merge unrelated text", () => {
    expect(jaccard(tokens("broken chair near stacks"), tokens("food is cold in the mess"))).toBeLessThan(0.2);
    expect(textSimilar("broken chair near stacks", "food is cold in the mess")).toBe(false);
  });

  it("measures distance in meters", () => {
    const d = haversineMeters({ lat: 28.61, lng: 77.03 }, { lat: 28.6102, lng: 77.03 });
    expect(d).toBeGreaterThan(10);
    expect(d).toBeLessThan(40);
  });

  it("finds a merge target within 40m of similar text", () => {
    const cluster: Cluster = {
      id: "c1",
      title: "Library Wi-Fi dead",
      category: "Wi-Fi / network",
      building: "Library",
      report_count: 1,
      me_too_count: 0,
      priority: 50,
      is_recurring: false,
      lat: 28.61,
      lng: 77.03,
      status: "open",
      severity: "high",
      created_at: new Date().toISOString(),
    };
    const issue = {
      id: "i1",
      ticket_code: "CP-1001",
      description: "Library Wi-Fi is completely dead near the stacks",
      category: "Wi-Fi / network",
      cluster_id: "c1",
      status: "open",
      lat: 28.61,
      lng: 77.03,
      embedding: null,
    } as Issue;
    const hit = findMergeTarget([cluster], [issue], 28.6101, 77.0301, "wifi dead in the library reading room");
    expect(hit?.cluster.id).toBe("c1");
  });
});
