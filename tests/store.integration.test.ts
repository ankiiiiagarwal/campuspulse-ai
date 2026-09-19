import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";

vi.mock("@/lib/supabase", () => ({ hasSupabase: () => false }));
vi.mock("@/lib/audit", () => ({ appendAudit: vi.fn() }));
vi.mock("@/lib/vision", () => ({ describeReportPhoto: async () => null }));
vi.mock("@/lib/classify", () => ({ classifyReport: async () => ({
  category: "Water / leakage", severity: "medium", department: "Campus", safety: 3, source: "fallback",
}) }));

let store: typeof import("@/lib/store");
beforeEach(async () => {
  vi.resetModules(); vi.stubEnv("VERCEL", ""); vi.stubEnv("LOAD_SEED", "");
  const directory = await mkdtemp(path.join(tmpdir(), "campuspulse-store-"));
  vi.spyOn(process, "cwd").mockReturnValue(directory);
  store = await import("@/lib/store");
  await store.saveCampusBoundary({ type: "rectangle", vertices: [{lat:10,lng:10},{lat:11,lng:11}], updated_at: new Date().toISOString() });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

const report = () => store.createIssue({ description: "Water pipe leaking in courtyard", lat: 10.5, lng: 10.5, building: "Campus", forceNew: true });

describe("real local store workflow", () => {
  it("persists QR coordinates and incident decisions without changing original tickets", async () => {
    const { detectIncidents } = await import("@/lib/incidents");
    const location = await store.registerLocation({ name:"Second floor reading room",department:"Library",lat:10.5,lng:10.5 });
    const a = (await store.createIssue({description:"Lights not working",lat:10.6,lng:10.6,building:"Wrong",location_id:location.id,forceNew:true})).issue!;
    const b = (await store.createIssue({description:"Projector down",lat:10.6,lng:10.6,building:"Wrong",location_id:location.id,forceNew:true})).issue!;
    expect(a).toMatchObject({lat:10.5,lng:10.5,building:"Library, Second floor reading room",location_id:location.id});
    const before=await store.loadSnapshot();
    const candidate=detectIncidents(before)[0];
    await expect(store.decideIncident(candidate.id,"confirmed",{email:"dept",role:"department"})).rejects.toThrow();
    const record=await store.decideIncident(candidate.id,"confirmed",{email:"admin",role:"admin"});
    expect(record.issue_ids.sort()).toEqual([a.id,b.id].sort());
    const after=await store.loadSnapshot();
    expect(after.issues).toEqual(before.issues);
    expect(after.incidents).toHaveLength(1);
    expect(after.locations).toHaveLength(1);
    expect(detectIncidents(after)).toHaveLength(0);
    await expect(store.decideIncident("f".repeat(64),"confirmed",{email:"admin",role:"admin"})).rejects.toThrow();
  });
  it("rejects unknown QR locations, outside pins and duplicate location names", async () => {
    await store.registerLocation({name:"Reading room",department:"Library",lat:10.5,lng:10.5});
    await expect(store.registerLocation({name:"reading room",department:"Library",lat:10.5,lng:10.5})).rejects.toThrow();
    await expect(store.registerLocation({name:"Outside room",department:"Library",lat:90.1,lng:10.5})).rejects.toThrow();
    await expect(store.createIssue({description:"Lights down",lat:10.5,lng:10.5,location_id:crypto.randomUUID()})).rejects.toThrow();
  });
  it("preserves simultaneous reports and votes", async () => {
    const results = await Promise.all(Array.from({length:12}, report));
    const issues = await store.listIssues();
    expect(issues).toHaveLength(12);
    expect(new Set(issues.map(i => i.ticket_code)).size).toBe(12);
    const cluster = results[0].issue!.cluster_id;
    await Promise.all(Array.from({length:12}, (_,i) => store.meToo(cluster, `visitor-${i}`)));
    expect((await store.listClusters()).find(c => c.id === cluster)?.me_too_count).toBe(12);
    const duplicates = await Promise.all([store.meToo(cluster, "same"), store.meToo(cluster, "same")]);
    expect(duplicates.filter(r => r.ok)).toHaveLength(1);
  });

  it("runs report → resolve → verify → reopen → resolve across claim rounds", async () => {
    const issue = (await report()).issue!;
    await store.updateIssue(issue.id, { status: "assigned", department: "Campus" });
    await store.updateIssue(issue.id, { status: "on_it", worker_name: "Worker", eta_at: new Date(Date.now()+3600000).toISOString() });
    await store.updateIssue(issue.id, { status: "resolved" });
    await expect(store.recordVerification(issue.id, "bad", "broken", "fake")).rejects.toThrow();
    expect((await store.getIssueById(issue.id))?.status).toBe("resolved");
    const votes = await Promise.all([store.recordVerification(issue.id, "a", "broken"), store.recordVerification(issue.id, "b", "broken")]);
    expect(votes.some(r => r.ok && r.reopened)).toBe(true);
    expect(await store.getIssueById(issue.id)).toMatchObject({ status:"assigned", reopen_count:1, claim_round:1 });
    await store.updateIssue(issue.id, { status:"resolved" });
    await Promise.all([store.recordVerification(issue.id,"a","fixed"),store.recordVerification(issue.id,"b","fixed")]);
    expect(await store.getIssueById(issue.id)).toMatchObject({ status:"resolved", verified_count:2 });
    // Repeating a closure must not erase student verification.
    await store.updateIssue(issue.id, { status:"resolved" });
    expect((await store.getIssueById(issue.id))?.verified_count).toBe(2);
  });

  it("allows one genuine uploaded photo to support reopening", async () => {
    const issue = (await report()).issue!;
    await store.updateIssue(issue.id, { status:"resolved" });
    const { savePhoto } = await import("@/lib/upload");
    const png = await sharp({create:{width:2,height:2,channels:3,background:"blue"}}).png().toBuffer();
    const photo = await savePhoto(`data:image/png;base64,${png.toString("base64")}`,"report");
    expect(await store.recordVerification(issue.id,"student","broken",photo)).toMatchObject({ok:true,reopened:true});
  });

  it("does not erase a status when patch fields are omitted", async () => {
    const issue = (await report()).issue!;
    await store.updateIssue(issue.id, {status:undefined,worker_name:"Worker"});
    expect(await store.getIssueById(issue.id)).toMatchObject({status:"open",worker_name:"Worker"});
  });
});
