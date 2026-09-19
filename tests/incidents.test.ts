import { describe, expect, it } from "vitest";
import { detectIncidents, incidentProgress } from "@/lib/incidents";
import { classifyWithKeywords } from "@/lib/classify";
import { normalizeReportText } from "@/lib/report-language";
import { findNearby, textSimilar } from "@/lib/duplicates";
import { buildSeed } from "@/lib/seed-data";
import type { AppSnapshot, Issue } from "@/lib/types";

const now = Date.now();
function issue(id: string, description: string, patch: Partial<Issue> = {}): Issue {
  return { ...buildSeed().issues[0], id, cluster_id: id, description, building: "Library, second floor", lat: 10.5, lng: 10.5, location_id: null, created_at: new Date(now - 1000).toISOString(), status: "open", verified_count: 0, disputed_count: 0, verified_at: null, reopen_count: 0, verify_deadline_at: null, ...patch };
}
function snapshot(issues: Issue[]): AppSnapshot { return { issues, clusters: [], confirmations: [], verifications: [], campus_boundary: null }; }

describe("incident evidence boundaries", () => {
  it("connects mixed Hindi/English equipment failures but leaves the chair separate", () => {
    const snap = snapshot([issue("a", "लाइट बंद है"), issue("b", "Projector not working"), issue("c", "Wi-Fi down"), issue("d", "Chair broken")]);
    expect(detectIncidents(snap,now)).toMatchObject([{kind:"power",issue_ids:["a","b","c"]}]);
    expect(detectIncidents({ ...snap, issues: [...snap.issues].reverse() }, now)).toEqual(detectIncidents(snap,now));
  });
  it("detects network and water patterns without claiming a power failure", () => {
    expect(detectIncidents(snapshot([issue("a","वाईफाई काम नहीं कर रहा"),issue("b","Internet is down")]),now)[0]?.kind).toBe("network");
    expect(detectIncidents(snapshot([issue("a","पानी टपक रहा है"),issue("b","Wet floor near the washroom")]),now)[0]?.kind).toBe("water");
  });
  it("requires two reports and different equipment for power", () => {
    expect(detectIncidents(snapshot([issue("a","Lights down")]),now)).toHaveLength(0);
    expect(detectIncidents(snapshot([issue("a","Lights down"),issue("b","Light not working")]),now)).toHaveLength(0);
    expect(detectIncidents(snapshot([issue("a","Wifi working fine"),issue("b","Internet down")]),now)).toHaveLength(0);
    expect(detectIncidents(snapshot([issue("a","Pipe not leaking"),issue("b","Wet floor")]),now)).toHaveLength(0);
  });
  it.each([
    {building:"Library, first floor"}, {building:"Hostel, second floor"}, {lat:10.51},
    {created_at:new Date(now-31*60000).toISOString()}, {status:"resolved" as const}, {location_id:"different-qr"},
  ])("does not correlate incompatible place/time/status: %j", patch => {
    expect(detectIncidents(snapshot([issue("a","Lights down"),issue("b","Projector down",patch)]),now)).toHaveLength(0);
  });
  it("does not use broad department-only locations, stale reports, or transitive chains", () => {
    expect(detectIncidents(snapshot([issue("a","Lights down",{building:"Library"}),issue("b","Projector down",{building:"Library"})]),now)).toHaveLength(0);
    expect(detectIncidents(snapshot([issue("a","Lights down"),issue("b","Projector down")]),now+7*3600000)).toHaveLength(0);
    const matches=detectIncidents(snapshot([issue("a","Wifi down",{lat:10.5}),issue("b","Wifi down",{lat:10.5004}),issue("c","Wifi down",{lat:10.5008})]),now);
    expect(matches[0].issue_ids).toHaveLength(2);
  });
  it("honours staff decisions and never labels unverified closures community-confirmed", () => {
    const snap=snapshot([issue("a","Lights down"),issue("b","Projector down")]);
    const c=detectIncidents(snap,now)[0];
    for(const decision of ["confirmed","separate"] as const) expect(detectIncidents({...snap,incidents:[{...c,decision,created_at:new Date(now).toISOString(),decided_by:"admin"}]},now)).toHaveLength(0);
    expect(incidentProgress(snap.issues)).toBe("Investigating");
    const resolved=snap.issues.map(i=>({...i,status:"resolved" as const, resolved_at:new Date(now).toISOString(),verify_deadline_at:new Date(now+3600000).toISOString()}));
    expect(incidentProgress(resolved)).toBe("Awaiting student confirmation");
    expect(incidentProgress(resolved.map(i=>({...i,verified_count:2,verified_at:new Date(now).toISOString()})))).toBe("Community-confirmed");
  });
});

describe("Hindi and English matching", () => {
  it("classifies Hindi without an AI service and preserves unrelated Latin words", () => {
    expect(classifyWithKeywords("वाईफाई काम नहीं कर रहा").category).toBe("Wi-Fi / network");
    expect(classifyWithKeywords("पानी टपक रहा है").category).toBe("Water / leakage");
    expect(normalizeReportText("original signal terminal")).toBe("original signal terminal");
    expect(textSimilar("वाईफाई बंद है", "Wi-Fi down")).toBe(true);
    expect(textSimilar("Projector not working", "Lights not working")).toBe(false);
  });
  it("does not offer a duplicate on another QR location or floor", () => {
    const i=issue("a","Wi-Fi down",{location_id:"first"});
    const c={...buildSeed().clusters[0],id:"a",building:i.building,lat:i.lat,lng:i.lng,status:"open" as const};
    expect(findNearby([c],[i],10.5,10.5,"वाईफाई बंद है",null,{location_id:"second"})).toHaveLength(0);
    expect(findNearby([c],[i],10.5,10.5,"Wi-Fi down",null,{building:"Library, first floor"})).toHaveLength(0);
  });
});
