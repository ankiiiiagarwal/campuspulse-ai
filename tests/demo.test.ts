import { afterEach, expect, it, vi } from "vitest";
import { buildDemo } from "@/lib/demo-data";
import { detectIncidents } from "@/lib/incidents";
import { pointInBoundary } from "@/lib/geo";
import { isDemoMode, localDataFile } from "@/lib/local-mode";

afterEach(() => vi.unstubAllEnvs());
it("provides map-ready reports, QR locations, actionable incidents and repair checks", () => {
  const demo = buildDemo();
  expect(demo.issues.length).toBeGreaterThan(25);
  expect(demo.issues.every(issue => pointInBoundary(issue, demo.campus_boundary))).toBe(true);
  expect(demo.locations).toHaveLength(3);
  expect(demo.incidents?.some(incident => incident.decision === "confirmed")).toBe(true);
  expect(detectIncidents(demo).map(incident => incident.kind)).toEqual(expect.arrayContaining(["power", "water"]));
  expect(demo.issues.some(issue => issue.status === "resolved" && issue.verified_count < 2 && Date.parse(issue.verify_deadline_at || "") > Date.now())).toBe(true);
});
it("isolates demo files and never activates demo storage in production", () => {
  vi.stubEnv("CAMPUSPULSE_DEMO", "1");
  vi.stubEnv("NODE_ENV", "development");
  expect(isDemoMode()).toBe(true);
  expect(localDataFile("store.json")).toContain(".data-demo");
  vi.stubEnv("NODE_ENV", "production");
  expect(isDemoMode()).toBe(false);
  expect(localDataFile("store.json")).not.toContain(".data-demo");
});
