/**
 * Starts nothing by itself. Expects NEXT_BASE (default http://127.0.0.1:3011)
 * and two issue ids in the store: VERIFY_CAMPUS_ID, VERIFY_IT_ID (or defaults).
 */
const base = process.env.NEXT_BASE || "http://127.0.0.1:3011";
const campusId = process.env.VERIFY_CAMPUS_ID || process.env.VERIFY_ELEC_ID || "a1111111-1111-4111-8111-111111111111";
const itId = process.env.VERIFY_IT_ID || "a2222222-2222-4222-8222-222222222222";

function cookieFrom(res) {
  const list = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  if (list.length) return list.map((c) => c.split(";")[0]).join("; ");
  const single = res.headers.get("set-cookie");
  return single ? single.split(";")[0] : "";
}

async function login(email) {
  const res = await fetch(`${base}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "campuspulse" }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`login ${email}: ${data.error || res.status}`);
  return { cookie: cookieFrom(res), session: data.session };
}

async function getIssue(id, cookie) {
  return fetch(`${base}/api/issues/${id}`, { headers: cookie ? { cookie } : {} });
}

const failures = [];
function check(name, ok, detail) {
  console.log(`${ok ? "ok" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures.push(name);
}

const it = await login("it@campus.local");
check("IT login role", it.session?.role === "department" && it.session?.department === "it", JSON.stringify(it.session));

const campusAsIt = await getIssue(campusId, it.cookie);
const campusBody = await campusAsIt.json();
check("IT cannot GET Campus issue", campusAsIt.status === 403, `${campusAsIt.status} ${campusBody.error || ""}`);

const itAsIt = await getIssue(itId, it.cookie);
check("IT can GET IT issue", itAsIt.status === 200, String(itAsIt.status));

const listAsIt = await fetch(`${base}/api/issues`, { headers: { cookie: it.cookie } });
const listData = await listAsIt.json();
const leaked = (listData.issues || []).filter((i) => i.department && !/it|wi-?fi|network/i.test(String(i.department + i.category)));
check("IT list has no foreign departments", leaked.length === 0, leaked.map((i) => i.department).join(","));

const patchForeign = await fetch(`${base}/api/issues/${campusId}`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json", cookie: it.cookie },
  body: JSON.stringify({ status: "on_it" }),
});
check("IT cannot PATCH Campus issue", patchForeign.status === 403, String(patchForeign.status));

const fence = await fetch(`${base}/api/admin/campus`, {
  method: "PUT",
  headers: { "Content-Type": "application/json", cookie: it.cookie },
  body: JSON.stringify({ type: "rectangle", vertices: [{ lat: 1, lng: 1 }, { lat: 2, lng: 2 }] }),
});
check("IT cannot set campus fence", fence.status === 403, String(fence.status));

const admin = await login("admin@campus.local");
check("admin login role", admin.session?.role === "admin", JSON.stringify(admin.session));
const campusAsAdmin = await getIssue(campusId, admin.cookie);
check("admin can GET Campus issue", campusAsAdmin.status === 200, String(campusAsAdmin.status));

if (failures.length) {
  console.error(`failed: ${failures.join(", ")}`);
  process.exit(1);
}
console.log("department access checks passed");
