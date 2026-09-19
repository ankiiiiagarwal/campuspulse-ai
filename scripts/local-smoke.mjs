// Builds and runs a disposable source copy, never .env.local, .next, or .data.
import { cp, mkdtemp, writeFile, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import sharp from "sharp";

const root = process.cwd();
// Webpack on Windows cannot resolve linked Next entrypoints across drive letters.
const tempRoot = process.platform === "win32" && path.parse(root).root !== path.parse(tmpdir()).root
  ? path.dirname(root) : tmpdir();
const stage = await mkdtemp(path.join(tempRoot, ".campuspulse-http-"));
for (const name of ["app","components","lib","types","public","package.json","tsconfig.json","next.config.ts","postcss.config.mjs","tailwind.config.ts","instrumentation.ts"]) {
  await cp(path.join(root,name),path.join(stage,name),{
    recursive:true,
    filter: source => path.relative(root,source).replaceAll("\\","/") !== "public/uploads",
  });
}
// ESM packages do not use NODE_PATH; share dependencies, never application data.
await symlink(path.join(root,"node_modules"),path.join(stage,"node_modules"),process.platform === "win32" ? "junction" : "dir");
const env = {...process.env, NODE_PATH:path.join(root,"node_modules"), NODE_ENV:"production",
  USE_LOCAL_DB:"1", LOAD_SEED:"", VERCEL:"", VERCEL_ENV:"", TRUST_PROXY_HEADERS:"",
  ADMIN_EMAIL:"admin@campus.local", ADMIN_PASSWORD:"LocalSmokePassword-123",
  ADMIN_SESSION_SECRET:randomBytes(32).toString("hex"), DEPT_PASSWORD:"LocalSmokePassword-123",
  GEMINI_API_KEY:"", GROQ_API_KEY:"", NEXT_PUBLIC_SUPABASE_URL:"", NEXT_PUBLIC_SUPABASE_ANON_KEY:"", SUPABASE_SERVICE_ROLE_KEY:"",
};
for (const desk of ["IT","HOSTEL","MESS","CAMPUS","LIBRARY"]) {
  env[`DEPT_${desk}_EMAIL`] = `${desk.toLowerCase()}@campus.local`;
  env[`DEPT_${desk}_PASSWORD`] = "LocalSmokePassword-123";
}
console.log("Building isolated source copy (no live credentials or application data).");
await new Promise((resolve,reject) => {
  const build=spawn(process.execPath,[path.join(root,"node_modules/next/dist/bin/next"),"build",stage],{cwd:stage,env,windowsHide:true,stdio:["ignore","pipe","pipe"]});
  let log=""; build.stdout.on("data",data=>log+=data);build.stderr.on("data",data=>log+=data);
  build.on("error",reject);
  build.on("close",async code=>{
    await writeFile(path.join(stage,"build.log"),log,"utf8");
    if(code===0){console.log("PASS isolated production build");resolve();}
    else reject(new Error(log));
  });
});
const port = await new Promise((resolve,reject) => {
  const server = createServer(); server.on("error",reject);
  server.listen(0,"127.0.0.1",()=>{const port=server.address().port;server.close(()=>resolve(port));});
});
const child = spawn(process.execPath,[path.join(root,"node_modules/next/dist/bin/next"),"start",stage,"--hostname","127.0.0.1","--port",String(port)],{cwd:stage,env,windowsHide:true,stdio:["ignore","pipe","pipe"]});
let output=""; child.stdout.on("data",data=>output+=data); child.stderr.on("data",data=>output+=data);
const base=`http://127.0.0.1:${port}`;
let checks=0;
async function request(method,url,body,cookie="",desk="") {
  const response=await fetch(base+url,{method,headers:{"Content-Type":"application/json",Cookie:cookie,"X-CP-Desk":desk},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
  const data=await response.json();
  return {status:response.status,data,cookie:(response.headers.getSetCookie?.()||[]).map(value=>value.split(";")[0]).join("; ")};
}
function check(value,message) {assert.ok(value,message);checks++;console.log(`PASS ${message}`);}
try {
  let ready=false;
  for(let attempt=0;attempt<100;attempt++) {
    if(child.exitCode!==null) throw new Error(`Server exited: ${output}`);
    try {const res=await fetch(base+"/api/campus",{signal:AbortSignal.timeout(2000)});if(res.ok){ready=true;break;}} catch {}
    if(output.includes("Cannot find") || output.includes("Error:")) throw new Error(output.slice(-3000));
    await new Promise(resolve=>setTimeout(resolve,200));
  }
  assert.ok(ready,`Server did not start: ${output}`);
  const admin=await request("POST","/api/admin/login",{email:"admin@campus.local",password:env.ADMIN_PASSWORD,desk:"admin"});
  check(admin.status===200,"admin login");
  const staff=await request("POST","/api/admin/login",{email:"campus@campus.local",password:env.DEPT_PASSWORD,desk:"department"});
  check(staff.status===200,"department login");
  const it=await request("POST","/api/admin/login",{email:"it@campus.local",password:env.DEPT_PASSWORD,desk:"department"});
  check(it.status===200,"IT department login");
  const unknown=await request("POST","/api/admin/login",{email:"outsider@example.test",password:env.ADMIN_PASSWORD});
  check(unknown.status===401,"unknown account rejected");
  const boundary={type:"rectangle",vertices:[{lat:10,lng:10},{lat:11,lng:11}]};
  check((await request("PUT","/api/admin/campus",boundary,staff.cookie,"department")).status===401,"department cannot edit campus boundary");
  check((await request("PUT","/api/admin/campus",boundary,admin.cookie,"admin")).status===200,"admin saves campus boundary");
  const invalid=await request("POST","/api/issues",{description:[],lat:10.5,lng:10.5,building:"Campus"});
  check(invalid.status===400,"invalid report fields return 400");
  const report=await request("POST","/api/issues",{description:"Water pipe leaking outside classroom",lat:10.5,lng:10.5,building:"Campus",forceNew:true});
  check(report.status===201 && report.data.issue?.id,"report submitted");
  const id=report.data.issue.id;
  check((await request("PATCH",`/api/issues/${id}`,{status:"resolved"},it.cookie,"department")).status===403,"other department cannot change ticket");
  check((await request("PATCH",`/api/issues/${id}`,{verified_count:99},admin.cookie,"admin")).status===400,"unexpected patch fields rejected");
  check((await request("PATCH",`/api/issues/${id}`,{status:"resolved"})).status===401,"anonymous user cannot resolve a ticket");
  check((await request("PATCH",`/api/issues/${id}`,{status:"resolved"},staff.cookie,"department")).status===200,"assigned department resolves ticket");
  check((await request("POST",`/api/issues/${id}/verify`,{verdict:"broken",photo_url:"fake"})).status===400,"fake photo cannot reopen a ticket");
  const first=await request("POST",`/api/issues/${id}/verify`,{verdict:"broken"});
  check(first.status===200 && !first.data.reopened,"one text dispute does not reopen ticket");
  check((await request("POST",`/api/issues/${id}/verify`,{verdict:"broken"},first.cookie)).status===409,"duplicate browser vote rejected");
  const second=await request("POST",`/api/issues/${id}/verify`,{verdict:"broken"});
  check(second.status===200 && second.data.reopened,"second independent dispute reopens ticket");
  const health=await request("GET","/api/health");
  check(health.status===200 && Number.isFinite(health.data.campus?.score),"dashboard health loads");
  check((await request("GET","/api/incidents?review=1")).status===401,"incident suggestions require admin login");
  check((await request("GET","/api/incidents?review=1",undefined,it.cookie,"department")).status===401,"department cannot review campus incidents");
  const locationInput={name:"Second floor reading room",department:"Library",lat:10.5,lng:10.5};
  check((await request("POST","/api/locations",locationInput)).status===401,"anonymous visitors cannot register QR locations");
  const places=[];
  for(const name of ["Second floor reading room","First floor computer lab","Third floor washroom"]) {
    const result=await request("POST","/api/locations",{...locationInput,name},admin.cookie,"admin");
    check(result.status===201,`registered QR location: ${name}`); places.push(result.data.location);
  }
  const created=[];
  for(const [description,place] of [["लाइट बंद है",0],["Projector not working",0],["Chair has a broken leg",0],["वाईफाई काम नहीं कर रहा",1],["Internet is down",1],["पानी टपक रहा है",2],["Wet floor near the washroom",2]]) {
    const result=await request("POST","/api/issues",{description,location_id:places[place].id,lat:10.6,lng:10.6,building:"Spoofed place",forceNew:true});
    assert.equal(result.status,201,JSON.stringify(result.data)); created.push(result.data.issue);
  }
  check(created.every(i=>i.lat===10.5 && i.building.startsWith("Library,")),"QR reports use server-owned place and coordinates");
  const nearby=await request("GET",`/api/nearby?lat=10.5&lng=10.5&text=${encodeURIComponent("Wi-Fi down")}&location=${places[1].id}`);
  check(nearby.data.matches.some(m=>m.issue_id===created[3].id),"English report matches existing Hindi Wi-Fi report");
  const review=await request("GET","/api/incidents?review=1",undefined,admin.cookie,"admin");
  check(review.status===200 && review.data.candidates.length===3,"power, network and water investigations detected separately");
  check(review.data.ungrouped.some(i=>i.id===created[2].id),"unrelated broken chair stays separate");
  const publicBefore=await request("GET","/api/incidents");
  check(publicBefore.data.records.length===0 && publicBefore.data.candidates.length===0,"unreviewed hypotheses are not public investigations");
  const power=review.data.candidates.find(c=>c.kind==="power");
  check((await request("POST","/api/incidents",{id:power.id,decision:"confirmed"})).status===401,"anonymous incident confirmation rejected");
  check((await request("POST","/api/incidents",{id:"f".repeat(64),decision:"confirmed"},admin.cookie,"admin")).status===409,"fabricated incident members cannot be confirmed");
  check((await request("POST","/api/incidents",{id:power.id,decision:"confirmed"},admin.cookie,"admin")).status===200,"staff confirms shared investigation");
  const water=review.data.candidates.find(c=>c.kind==="water");
  check((await request("POST","/api/incidents",{id:water.id,decision:"separate"},admin.cookie,"admin")).status===200,"staff can keep related-looking reports separate");
  const afterReview=await request("GET","/api/incidents?review=1",undefined,admin.cookie,"admin");
  check(afterReview.data.candidates.length===1 && afterReview.data.candidates[0].kind==="network","decisions persist across reloads without resurfacing");
  const network=afterReview.data.candidates[0];
  check((await request("POST","/api/incidents/review",{id:network.id},admin.cookie,"admin")).status===503,"missing AI credentials produce an honest offline fallback");
  const publicAfter=await request("GET","/api/incidents");
  check(publicAfter.data.records.length===1 && publicAfter.data.records[0].evidence.every(i=>i.status==="open") && !JSON.stringify(publicAfter.data).includes("admin@"),"confirmed investigation preserves tickets and hides staff identity");
  const chat=await request("POST","/api/chat",{messages:[{role:"user",content:"The wifi is not working"}],context:{lang:"en"}});
  check(chat.status===200 && chat.data.reply?.length>20 && chat.data.source==="fallback","chatbot answers without external AI credentials");
  check((await request("POST","/api/chat",{messages:[{role:"user",content:42}]})).status===400,"malformed chatbot messages return a useful error");
  const classification=await request("POST","/api/classify",{description:"वाईफाई काम नहीं कर रहा",building:"Library"});
  check(classification.status===200 && classification.data.category==="Wi-Fi / network","standalone classification handles Hindi");
  check((await request("POST","/api/speech",{text:"Hello"})).status===503,"cloud speech reports missing credentials");
  check((await request("POST","/api/transcribe",{})).status===503,"cloud transcription reports missing credentials");
  const png=await sharp({create:{width:32,height:32,channels:3,background:"#42b883"}}).png().toBuffer();
  const uploaded=await request("POST","/api/upload",{kind:"report",image:`data:image/png;base64,${png.toString("base64")}`});
  check(uploaded.status===200 && uploaded.data.url.startsWith("/uploads/"),"report photo is decoded and stored");
  const image=await fetch(base+uploaded.data.url);
  check(image.status===200 && image.headers.get("content-type")?.includes("image"),"uploaded photo is actually accessible in production mode");
  check((await request("POST","/api/upload",{kind:"resolve",image:`data:image/png;base64,${png.toString("base64")}`})).status===401,"resolution uploads require staff login");
  const resolution=await request("POST","/api/upload",{kind:"resolve",image:`data:image/png;base64,${png.toString("base64")}`},admin.cookie,"admin");
  check(resolution.status===200,"staff can upload repair evidence");
  const vote=await request("POST",`/api/issues/${created[2].id}/me-too`,{});
  check(vote.status===200,"student can support an existing issue");
  check((await request("POST",`/api/issues/${created[2].id}/me-too`,{},vote.cookie)).status===409,"repeat support is rejected");
  for(const item of created.slice(0,2)) {
    check((await request("PATCH",`/api/issues/${item.id}`,{status:"assigned",department:"IT"},admin.cookie,"admin")).status===200,"admin routes incident member to department");
    const selectedEta = new Date(Date.now()+3*86400000).toISOString();
    const started = await request("PATCH",`/api/issues/${item.id}`,{status:"on_it",worker_name:"Test Worker",eta_at:selectedEta},it.cookie,"department");
    check(started.status===200 && started.data.issue?.eta_at===selectedEta,"department starts work with an exact ETA three days ahead");
    if (item === created[0]) {
      const revisedEta = new Date(Date.now()+7*86400000).toISOString();
      const revised = await request("PATCH",`/api/issues/${item.id}`,{eta_at:revisedEta},it.cookie,"department");
      check(revised.status===200 && revised.data.issue?.eta_at===revisedEta,"department updates the exact date and time beyond 24 hours");
      check((await request("PATCH",`/api/issues/${item.id}`,{eta_at:new Date(Date.now()-60000).toISOString()},it.cookie,"department")).status===400,"past resolution dates are rejected");
    }
    check((await request("PATCH",`/api/issues/${item.id}`,{status:"resolved",resolve_photo_url:resolution.data.url},it.cookie,"department")).status===200,"department closes with repair evidence");
    for(let voter=0;voter<2;voter++) assert.equal((await request("POST",`/api/issues/${item.id}/verify`,{verdict:"fixed"})).status,200);
  }
  check((await request("GET","/api/incidents")).data.records[0].progress==="Community-confirmed","incident completes only after each repair is verified");
  const ticket=await request("GET",`/api/issues/code/${created[0].ticket_code}`);
  check(ticket.status===200 && ticket.data.issue?.verified_count===2,"ticket tracking preserves final student verification");
  check((await request("GET","/api/issues/code/CP-NOT-FOUND")).status===404,"unknown ticket returns 404");
  check((await request("GET","/api/admin/audit",undefined,admin.cookie,"admin")).status===200,"admin audit log loads");
  check((await request("GET","/api/admin/departments",undefined,admin.cookie,"admin")).status===200,"department configuration loads");
  for(const route of ["/","/accountability","/admin","/admin/campus","/admin/departments","/admin/logs","/dept","/incidents","/admin/incidents","/admin/locations","/posters",`/report?location=${places[0].id}`,`/ticket/${created[0].ticket_code}`,`/submitted?code=${created[0].ticket_code}`]) {
    const page=await fetch(base+route,{headers:{Cookie:admin.cookie}});
    check(page.ok,`page renders: ${route.split("?")[0]}`);
    if (route === "/") {
      const html = await page.text();
      const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(match => match[1]).filter(src => src.startsWith("/_next/"));
      assert.ok(scripts.length > 0, "Page must include client scripts");
      for (const src of new Set(scripts)) {
        const asset = await fetch(base + src.replaceAll("&amp;", "&"));
        assert.ok(asset.ok && asset.headers.get("content-type")?.includes("javascript"), `Client script unavailable: ${src}`);
      }
      check(true, "home client scripts load, not just the HTML shell");
    }
  }
  const password="RotatedSmokePassword-456";
  check((await request("PATCH","/api/admin/departments",{key:"campus",password,confirm:password},admin.cookie,"admin")).status===200,"admin rotates department password");
  check((await request("PATCH",`/api/issues/${id}`,{status:"resolved"},staff.cookie,"department")).status===401,"old department session revoked");
  check((await request("POST","/api/admin/login",{email:"campus@campus.local",password:env.DEPT_PASSWORD,desk:"department"})).status===401,"old department password rejected");
  check((await request("POST","/api/admin/login",{email:"campus@campus.local",password,desk:"department"})).status===200,"new department password accepted");
  let throttled=false;
  for(let n=0;n<12;n++) {
    const result=await request("POST","/api/admin/login",{email:"admin@campus.local",password:"wrong"});
    if(result.status===429){throttled=true;break;}
  }
  check(throttled,"login attempts are rate limited");
  console.log(`All ${checks} isolated HTTP checks passed. Data stayed in ${stage}`);
} finally {
  child.kill();
  await writeFile(path.join(stage,"server.log"),output,"utf8");
}
