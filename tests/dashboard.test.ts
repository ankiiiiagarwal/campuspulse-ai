import { afterEach, expect, it, vi } from "vitest";
import { fetchDashboard } from "@/lib/dashboard";

afterEach(() => vi.restoreAllMocks());
it("does not present a failed health request as a healthy campus", async () => {
  vi.spyOn(globalThis,"fetch").mockResolvedValueOnce(Response.json({issues:[],clusters:[]}))
    .mockResolvedValueOnce(Response.json({error:"Health service unavailable"},{status:503}))
    .mockResolvedValueOnce(Response.json({boundary:null}));
  await expect(fetchDashboard()).rejects.toThrow("Health service unavailable");
});
it("rejects missing health data and succeeds on a subsequent retry", async () => {
  const fetch = vi.spyOn(globalThis,"fetch");
  for (const health of [{}, {campus:{score:82}}]) {
    fetch.mockResolvedValueOnce(Response.json({issues:[],clusters:[]}))
      .mockResolvedValueOnce(Response.json(health))
      .mockResolvedValueOnce(Response.json({boundary:null}));
  }
  await expect(fetchDashboard()).rejects.toThrow("health is unavailable");
  expect((await fetchDashboard()).health.campus.score).toBe(82);
});
