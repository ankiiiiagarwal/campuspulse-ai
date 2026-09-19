import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ admin: vi.fn(), model: vi.fn(), fallback: vi.fn(), snapshot: vi.fn(), limit: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.admin }));
vi.mock("@/lib/gemini", () => ({ geminiGenerate: mocks.model }));
vi.mock("@/lib/groq", () => ({ groqChat: mocks.fallback }));
vi.mock("@/lib/store", () => ({ loadSnapshot: mocks.snapshot }));
vi.mock("@/lib/rate-limit", () => ({ limited: mocks.limit }));
import { POST } from "@/app/api/incidents/review/route";
import { detectIncidents } from "@/lib/incidents";
import { buildSeed } from "@/lib/seed-data";
let id: string;
beforeEach(() => {
  vi.resetAllMocks(); mocks.admin.mockResolvedValue({email:"admin"}); mocks.limit.mockResolvedValue(false);
  const base=buildSeed();
  const snap={...base,incidents:[],verifications:[],campus_boundary:null,issues:["Lights down","Projector down"].map((description,n)=>({...base.issues[0],id:String(n),description,status:"open" as const,building:"Library, second floor",created_at:new Date(Date.now()-1000).toISOString()}))};
  mocks.snapshot.mockResolvedValue(snap); id=detectIncidents(snap)[0].id;
});
const request=()=>POST(new Request("http://localhost/api/incidents/review",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id})}));
describe("optional AI incident advisory", () => {
  it("uses a labelled Groq advisory when Gemini is unavailable",async()=>{
    mocks.model.mockResolvedValue(null);
    mocks.fallback.mockResolvedValue(JSON.stringify({assessment:"uncertain",summary:"Inspect the shared supply.",evidence_ids:["0","1"]}));
    const response=await request(); expect(response.status).toBe(200);
    expect((await response.json()).summary).toContain("Groq advisory");
  });
  it("requires admin authorization before calling a model",async()=>{
    mocks.admin.mockResolvedValue(null); expect((await request()).status).toBe(401); expect(mocks.model).not.toHaveBeenCalled();
  });
  it("labels a validated model response as advisory",async()=>{
    mocks.model.mockResolvedValue(JSON.stringify({assessment:"uncertain",summary:"Both devices stopped working; the shared supply still needs inspection.",evidence_ids:["0","1"]}));
    const response=await request(); expect(response.status).toBe(200); expect((await response.json()).summary).toContain("Gemini advisory (uncertain)");
  });
  it.each([null,"invalid JSON",JSON.stringify({assessment:"supported",summary:"A made-up witness",evidence_ids:["unrelated"]})])("handles missing or ungrounded model output: %s",async output=>{
    mocks.model.mockResolvedValue(output); expect((await request()).status).toBe(output===null?503:502);
  });
  it("rejects a stale suggestion before calling a model",async()=>{
    id="f".repeat(64); expect((await request()).status).toBe(409); expect(mocks.model).not.toHaveBeenCalled();
  });
});
