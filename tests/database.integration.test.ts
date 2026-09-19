import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { databaseClient } from "./helpers/pglite-supabase";

const backend = vi.hoisted(() => ({ client: null as unknown as ReturnType<typeof databaseClient> }));
vi.mock("@/lib/supabase", () => ({ hasSupabase: () => true, supabaseAdmin: () => backend.client }));
vi.mock("@/lib/audit", () => ({ appendAudit: vi.fn() }));
vi.mock("@/lib/classify", () => ({ classifyReport: async () => ({
  category:"Water / leakage",severity:"medium",department:"Campus",safety:3,source:"fallback",
}) }));

let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create function auth.role() returns text language sql as $$ select current_user::text $$;
    create schema storage;
    create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects(id uuid primary key, bucket_id text);
  `);
  const schema = (await readFile("supabase/schema.sql", "utf8")).replace('create extension if not exists "pgcrypto";', "");
  await db.exec(schema);
  // Existing installations can apply the standalone migration repeatedly.
  await db.exec(await readFile("supabase/migrations/202609190001_atomic_writes.sql", "utf8"));
  await db.exec(await readFile("supabase/migrations/202609190002_incident_detective.sql", "utf8"));
  backend.client = databaseClient(db);
}, 30_000);
afterAll(async () => { await db?.close(); });

async function revision() { return Number((await db.query<{revision:number}>("select revision from campuspulse_state")).rows[0].revision); }
async function commit(rev: number, changes: object) {
  return db.query("select campuspulse_commit($1,$2::jsonb)", [rev, JSON.stringify(changes)]);
}
function cluster(id: string) { return { id, title:"Leak", category:"Water / leakage", building:"Campus", report_count:1, me_too_count:0, priority:10, is_recurring:false, lat:10, lng:10, status:"open", severity:"medium", created_at:new Date().toISOString() }; }

describe("PostgreSQL transaction migration", () => {
  it("keeps raw records private while allowing the server to read them", async () => {
    const result = await db.query<{allowed:boolean}>("select has_table_privilege('anon','public.issues','SELECT') as allowed");
    expect(result.rows[0].allowed).toBe(false);
    const server = await db.query<{allowed:boolean}>("select has_table_privilege('service_role','public.issues','SELECT') as allowed");
    expect(server.rows[0].allowed).toBe(true);
  });

  it("persists registered places and staff decisions through the atomic SQL writer", async () => {
    const store=await import("@/lib/store");
    const {detectIncidents}=await import("@/lib/incidents");
    const location=await store.registerLocation({name:"Second floor lab",department:"IT",lat:10.5,lng:10.5});
    for(const description of ["Lights down","Projector not working"]) await store.createIssue({description,building:"Ignored",location_id:location.id,lat:10.6,lng:10.6,forceNew:true});
    const snapshot=await store.loadSnapshot();
    const candidate=detectIncidents(snapshot)[0];
    expect(candidate.issue_ids).toHaveLength(2);
    await store.decideIncident(candidate.id,"confirmed",{email:"admin",role:"admin"});
    const saved=await store.loadSnapshot();
    expect(saved.locations?.[0]).toMatchObject(location);
    expect(saved.incidents?.[0]).toMatchObject({id:candidate.id,decision:"confirmed"});
    expect(saved.issues.every(i=>i.status==="open")).toBe(true);
    expect((await db.query("select location_id from issues where location_id=$1",[location.id])).rows).toHaveLength(2);
  });
  it("runs the application report, vote and verification workflow through SQL", async () => {
    const store = await import("@/lib/store");
    await store.saveCampusBoundary({ type:"rectangle",vertices:[{lat:10,lng:10},{lat:11,lng:11}],updated_at:new Date().toISOString() });
    const report = await store.createIssue({description:"Leaking pipe outside lecture hall",building:"Campus",lat:10.5,lng:10.5,forceNew:true});
    const issue = report.issue!;
    expect(await store.getIssueByCode(issue.ticket_code.toLowerCase())).toMatchObject({id:issue.id});
    expect((await store.getPublicTicket(issue.ticket_code))?.siblings).toHaveLength(1);
    await Promise.all(Array.from({length:8}, (_,i)=>store.meToo(issue.cluster_id,`sql-${i}`)));
    expect((await store.getIssueById(issue.id))?.me_too_count).toBe(8);
    await store.updateIssue(issue.id,{status:"resolved"});
    await Promise.all([store.recordVerification(issue.id,"sql-a","broken"),store.recordVerification(issue.id,"sql-b","broken")]);
    expect(await store.getIssueById(issue.id)).toMatchObject({status:"assigned",reopen_count:1});
    await store.updateIssue(issue.id,{status:"resolved"});
    await Promise.all([store.recordVerification(issue.id,"sql-a","fixed"),store.recordVerification(issue.id,"sql-b","fixed")]);
    expect(await store.getIssueById(issue.id)).toMatchObject({status:"resolved",verified_count:2});
  });
  it("rejects a stale concurrent writer without overwriting counts", async () => {
    const id = crypto.randomUUID(), row = cluster(id);
    await commit(await revision(), {issue_clusters:[row]});
    const rev = await revision();
    const writes = await Promise.allSettled([
      commit(rev,{issue_clusters:[{...row,me_too_count:1}]}),
      commit(rev,{issue_clusters:[{...row,me_too_count:2}]}),
    ]);
    expect(writes.filter(r => r.status === "fulfilled")).toHaveLength(1);
    const rejected = writes.find(r => r.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason.code).toBe("40001");
  });
  it("rolls back every related write when one row is invalid", async () => {
    const id = crypto.randomUUID(), rev = await revision();
    await expect(commit(rev,{issue_clusters:[cluster(id)],issues:[{id:crypto.randomUUID()}]})).rejects.toThrow();
    expect((await db.query("select id from issue_clusters where id=$1",[id])).rows).toHaveLength(0);
    expect(await revision()).toBe(rev);
  });
  it("shares rate limits atomically and resets expired windows", async () => {
    const calls = await Promise.all(Array.from({length:8}, () => db.query<{allowed:boolean}>("select campuspulse_rate_limit('visitor',3,60000) as allowed")));
    expect(calls.filter(r => r.rows[0].allowed)).toHaveLength(3);
    await db.exec("update campuspulse_rate_limits set expires_at=now()-interval '1 second'");
    expect((await db.query<{allowed:boolean}>("select campuspulse_rate_limit('visitor',3,60000) as allowed")).rows[0].allowed).toBe(true);
  });
  it("increments password epochs atomically and restricts privileged functions", async () => {
    await Promise.all(Array.from({length:4}, () => db.query("select campuspulse_rotate_password('it','hash','admin')")));
    expect((await db.query<{epoch:number}>("select epoch from dept_password_overrides where key='it'")).rows[0].epoch).toBe(4);
    for (const role of ["anon","authenticated"]) {
      expect((await db.query<{allowed:boolean}>("select has_function_privilege($1,'public.campuspulse_commit(bigint,jsonb)','execute') as allowed",[role])).rows[0].allowed).toBe(false);
    }
    expect((await db.query("select * from pg_policies where schemaname='storage' and cmd='INSERT'")).rows).toHaveLength(0);
  });
});
