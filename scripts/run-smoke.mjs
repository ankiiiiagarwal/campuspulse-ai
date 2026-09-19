const base = process.env.NEXT_BASE || "http://127.0.0.1:3006";

async function req(method, path, { body, cookie, desk } = {}) {
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (cookie) headers.Cookie = cookie;
  // Desk-scoped endpoints read the staff cookie only when the browser names its desk.
  if (desk) headers["X-CP-Desk"] = desk;
  const res = await fetch(base + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 200) };
  }
  const setCookie = res.headers.getSetCookie?.() || [];
  const nextCookie = setCookie.map((c) => c.split(";")[0]).join("; ") || cookie || "";
  return { status: res.status, json, cookie: nextCookie };
}

function assert(ok, msg) {
  if (!ok) throw new Error(msg);
  console.log("OK  " + msg);
}

const out = [];
function log(title, data) {
  const line = `${title}: ${JSON.stringify(data)}`;
  out.push(line);
  console.log(line);
}

const classify = await req("POST", "/api/classify", {
  body: { description: "Library Wi-Fi is dead on the second floor" },
});
assert(classify.status === 200, `classify 200 (got ${classify.status})`);
assert(classify.json.category, "classify has category");
log("classify", { category: classify.json.category, dept: classify.json.department, source: classify.json.source });

const badLogin = await req("POST", "/api/admin/login", {
  body: { email: "admin@campus.local", password: "wrong" },
});
assert(badLogin.status === 401, `bad login 401 (got ${badLogin.status})`);

const admin = await req("POST", "/api/admin/login", {
  body: { email: "admin@campus.local", password: "campuspulse" },
});
assert(admin.status === 200 && admin.json.session?.role === "admin", "admin login");
const adminCookie = admin.cookie;

const sess = await req("GET", "/api/admin/session?desk=admin", { cookie: adminCookie, desk: "admin" });
assert(sess.json.session?.role === "admin", "admin session cookie");

const campusDesk = await req("POST", "/api/admin/login", {
  body: { email: "campus@campus.local", password: "campuspulse" },
});
assert(campusDesk.status === 200 && campusDesk.json.session?.department === "campus", "campus login");
const campusCookie = campusDesk.cookie;

const it = await req("POST", "/api/admin/login", {
  body: { email: "it@campus.local", password: "campuspulse" },
});
assert(it.status === 200 && it.json.session?.department === "it", "IT login");
const itCookie = it.cookie;

const fence403 = await req("PUT", "/api/admin/campus", {
  cookie: campusCookie,
  desk: "department",
  body: {
    type: "rectangle",
    vertices: [
      { lat: 28.6, lng: 77.03 },
      { lat: 28.62, lng: 77.05 },
    ],
  },
});
assert(fence403.status === 401 || fence403.status === 403, `dept cannot set fence (got ${fence403.status})`);

const fence = await req("PUT", "/api/admin/campus", {
  cookie: adminCookie,
  desk: "admin",
  body: {
    type: "rectangle",
    vertices: [
      { lat: 28.6, lng: 77.03 },
      { lat: 28.62, lng: 77.05 },
    ],
  },
});
assert(fence.status === 200, `admin can set fence (got ${fence.status})`);

const campusIssue = await req("POST", "/api/issues", {
  body: {
    description: "Broken chair near the lecture hall doorway and it tips over",
    lat: 28.611,
    lng: 77.04,
    building: "Campus, lecture hall",
    forceNew: true,
  },
});
assert(campusIssue.status === 201, `campus issue created (got ${campusIssue.status})`);
assert(campusIssue.json.issue?.department === "Campus", `campus issue routes to Campus (got ${campusIssue.json.issue?.department})`);
const campusId = campusIssue.json.issue.id;
log("campus issue", { id: campusId, ticket: campusIssue.json.issue.ticket_code });

const itOnCampus = await req("GET", `/api/issues/${campusId}`, { cookie: itCookie, desk: "department" });
assert(itOnCampus.status === 403, `IT cannot read Campus issue (got ${itOnCampus.status})`);

const campusOnOwn = await req("GET", `/api/issues/${campusId}`, { cookie: campusCookie, desk: "department" });
assert(campusOnOwn.status === 200, "Campus can read own issue");

const outside = await req("POST", "/api/issues", {
  body: {
    description: "Wi-Fi is dead far from campus in another city",
    lat: 19.07,
    lng: 72.87,
    building: "Campus",
  },
});
assert(outside.status === 400 && outside.json.code === "OUTSIDE_BOUNDARY", `outside fence rejected (${outside.status} ${outside.json.code})`);

const firstLights = await req("POST", "/api/issues", {
  body: {
    description: "Library lights flickering during evening study again",
    lat: 28.6102,
    lng: 77.0401,
    building: "Library",
    forceNew: true,
  },
});
assert(firstLights.status === 201, `first lights ticket (got ${firstLights.status})`);

const merged = await req("POST", "/api/issues", {
  body: {
    description: "Library lights flickering during evening study again",
    lat: 28.6102,
    lng: 77.0401,
    building: "Library",
  },
});
assert(merged.status === 201, `merge create 201 (got ${merged.status})`);
assert(merged.json.merged === true, `nearby second report merges (merged=${merged.json.merged})`);
log("merge create", { ticket: merged.json.issue?.ticket_code, merged: merged.json.merged, cluster: merged.json.issue?.cluster_id });

const byCode = await req("GET", `/api/issues/code/${encodeURIComponent(merged.json.issue.ticket_code)}`);
assert(byCode.status === 200 && byCode.json.issue?.ticket_code === merged.json.issue.ticket_code, "ticket by code");
assert(byCode.json.issue.embedding === undefined, "public ticket has no embedding");

const forced = await req("POST", "/api/issues", {
  body: {
    description: "Library lights flickering during evening study again",
    lat: 28.6102,
    lng: 77.0401,
    building: "Library",
    forceNew: true,
  },
});
assert(forced.status === 201 && forced.json.merged === false, `forceNew creates new cluster (merged=${forced.json.merged})`);
assert(forced.json.issue.cluster_id !== firstLights.json.issue.cluster_id, "forceNew cluster differs from original");

const nearby = await req(
  "GET",
  `/api/nearby?lat=28.6102&lng=77.0401&text=${encodeURIComponent("Library lights flickering during evening study")}`,
);
assert((nearby.json.matches || []).length >= 1, `nearby matches (${nearby.json.matches?.length || 0})`);

const meToo = await req("POST", `/api/issues/${campusId}/me-too`, {
  body: { cluster_id: campusIssue.json.issue.cluster_id },
});
assert(meToo.status === 200 || meToo.json.already, `me-too (${meToo.status})`);

const meToo2 = await req("POST", `/api/issues/${campusId}/me-too`, {
  cookie: meToo.cookie,
  body: { cluster_id: campusIssue.json.issue.cluster_id },
});
assert(meToo2.status === 409 || meToo2.json.already, `me-too duplicate blocked (${meToo2.status})`);

const wifi = await req("POST", "/api/issues", {
  body: {
    description: "Library Wi-Fi is completely dead near the stacks and students cannot study",
    lat: 28.611,
    lng: 77.041,
    building: "Library",
    forceNew: true,
  },
});
assert(wifi.status === 201 && wifi.json.issue.department === "IT", `wifi routes to IT (got ${wifi.json.issue?.department})`);
const wifiId = wifi.json.issue.id;

const itSeesWifi = await req("GET", "/api/issues", { cookie: itCookie, desk: "department" });
assert(
  itSeesWifi.json.issues.some((i) => i.id === wifiId),
  "IT queue includes wifi ticket",
);
assert(
  !itSeesWifi.json.issues.some((i) => i.id === campusId),
  "IT queue hides other-desk ticket",
);
assert(
  itSeesWifi.json.issues.every((i) => i.embedding === undefined),
  "issue list strips embeddings",
);

const campusPatchWifi = await req("PATCH", `/api/issues/${wifiId}`, {
  cookie: campusCookie,
  desk: "department",
  body: { status: "assigned" },
});
assert(campusPatchWifi.status === 403, `Campus cannot patch IT ticket (got ${campusPatchWifi.status})`);

const badStatus = await req("PATCH", `/api/issues/${wifiId}`, {
  cookie: itCookie,
  desk: "department",
  body: { status: "done" },
});
assert(badStatus.status === 400, `invalid status rejected (${badStatus.status})`);

const itOnIt = await req("PATCH", `/api/issues/${wifiId}`, {
  cookie: itCookie,
  desk: "department",
  body: { status: "on_it", worker_name: "Smoke Tech", eta_at: new Date(Date.now() + 2 * 3600_000).toISOString() },
});
assert(itOnIt.status === 200 && itOnIt.json.issue.status === "on_it", "IT marks On it");

const adminResolve = await req("PATCH", `/api/issues/${wifiId}`, {
  cookie: adminCookie,
  desk: "admin",
  body: { status: "resolved" },
});
assert(adminResolve.status === 200 && adminResolve.json.issue.status === "resolved", "admin resolve");

// --- Student fix verification -------------------------------------------------
// Each req() without a cookie gets a fresh cp_visitor, so it acts as a new browser.

const claimed = await req("GET", `/api/issues/code/${wifi.json.issue.ticket_code}`);
assert(Boolean(claimed.json.issue.verify_deadline_at), "closing a ticket opens a check window");

const staffCheck = await req("POST", `/api/issues/${wifiId}/verify`, {
  cookie: adminCookie,
  desk: "admin",
  body: { verdict: "fixed" },
});
assert(staffCheck.status === 403, `staff cannot check their own fix (got ${staffCheck.status})`);

const badVerdict = await req("POST", `/api/issues/${wifiId}/verify`, { body: { verdict: "maybe" } });
assert(badVerdict.status === 400, `bad verdict rejected (${badVerdict.status})`);

const confirm1 = await req("POST", `/api/issues/${wifiId}/verify`, { body: { verdict: "fixed" } });
assert(confirm1.status === 200 && confirm1.json.reopened === false, `first confirmation (${confirm1.status})`);
assert(confirm1.json.issue.verified_count === 1, `verified_count 1 (got ${confirm1.json.issue.verified_count})`);
assert(confirm1.json.state === "awaiting", `one confirmation is not enough (${confirm1.json.state})`);

const confirmDup = await req("POST", `/api/issues/${wifiId}/verify`, {
  cookie: confirm1.cookie,
  body: { verdict: "fixed" },
});
assert(confirmDup.status === 409, `same browser cannot check twice (${confirmDup.status})`);

const confirm2 = await req("POST", `/api/issues/${wifiId}/verify`, { body: { verdict: "fixed" } });
assert(confirm2.json.state === "verified", `two confirmations verify the fix (${confirm2.json.state})`);
assert(confirm2.json.issue.status === "resolved", "a verified fix stays closed");
log("verified fix", { ticket: confirm2.json.issue.ticket_code, confirmations: confirm2.json.issue.verified_count });

const settled = await req("POST", `/api/issues/${wifiId}/verify`, { body: { verdict: "broken" } });
assert(settled.status === 409, `a settled claim takes no more checks (${settled.status})`);

// Two plain disputes send a job back to the department that claimed it.
const campusResolve = await req("PATCH", `/api/issues/${campusId}`, {
  cookie: adminCookie,
  desk: "admin",
  body: { status: "resolved" },
});
assert(campusResolve.status === 200, `campus ticket closed (${campusResolve.status})`);
const priorityBefore = campusResolve.json.issue.priority;

const dispute1 = await req("POST", `/api/issues/${campusId}/verify`, { body: { verdict: "broken" } });
assert(dispute1.status === 200 && dispute1.json.reopened === false, `one dispute alone does not reopen (${dispute1.json.reopened})`);

const dispute2 = await req("POST", `/api/issues/${campusId}/verify`, { body: { verdict: "broken" } });
assert(dispute2.status === 200 && dispute2.json.reopened === true, `two disputes reopen the job (${dispute2.json.reopened})`);
assert(dispute2.json.issue.status === "assigned", `reopened job returns to the desk (got ${dispute2.json.issue.status})`);
assert(dispute2.json.issue.reopen_count === 1, `reopen counted (got ${dispute2.json.issue.reopen_count})`);
assert(dispute2.json.issue.resolved_at === null, "reopened job is no longer closed");
assert(
  dispute2.json.issue.priority > priorityBefore,
  `reopened job outranks its old priority (${priorityBefore} -> ${dispute2.json.issue.priority})`,
);
log("sent back", {
  ticket: dispute2.json.issue.ticket_code,
  priority: `${priorityBefore} -> ${dispute2.json.issue.priority}`,
});

const campusDeskSeesReopen = await req("GET", "/api/issues", { cookie: campusCookie, desk: "department" });
assert(
  campusDeskSeesReopen.json.issues.some((i) => i.id === campusId && i.reopen_count === 1),
  "the department desk sees the job it has to redo",
);

// One dispute carrying a photo is enough on its own.
const photoTarget = forced.json.issue.id;
await req("PATCH", `/api/issues/${photoTarget}`, { cookie: adminCookie, body: { status: "resolved" } });
const photoDispute = await req("POST", `/api/issues/${photoTarget}/verify`, {
  body: { verdict: "broken", photo_url: "/uploads/smoke-still-broken.jpg" },
});
assert(photoDispute.status === 200 && photoDispute.json.reopened === true, `photo dispute reopens alone (${photoDispute.json.reopened})`);

const health = await req("GET", "/api/health", { cookie: adminCookie, desk: "admin" });
assert(health.status === 200 && typeof health.json.campus.score === "number", "health score");
assert(Array.isArray(health.json.departments), "public department trail is present");
assert(health.json.campus.reopened_open >= 2, `health counts sent-back jobs (${health.json.campus.reopened_open})`);
assert(health.json.proof.verified >= 1, `a claim was verified (${health.json.proof?.verified})`);
assert(health.json.proof.disputed >= 2, `claims were rejected (${health.json.proof?.disputed})`);
assert(health.json.proof.verified_rate !== null, "verified fix rate is published");
assert(Array.isArray(health.json.proofByDepartment), "per-desk fix record is published");
log("health", health.json.campus);
log("fix claims", health.json.proof);

const audit = await req("GET", "/api/admin/audit", { cookie: adminCookie, desk: "admin" });
assert(audit.json.intact === true, "audit chain still intact after verification writes");
assert(
  (audit.json.entries || []).some((e) => e.action === "student.fix_rejected"),
  "rejected fix claims are logged",
);

console.log("\nSMOKE PASS");
