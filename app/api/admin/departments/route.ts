import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { appendAudit, requestIp } from "@/lib/audit";
import { DEPT_KEYS, DEPT_LABEL, DEMO_DEPT_EMAIL, DEPARTMENTS, departmentAccounts, departmentKeyForIssue } from "@/lib/departments";
import { listDeptPasswordOverrides, setDeptPasswordOverride } from "@/lib/dept-secrets";
import { passwordPolicyError } from "@/lib/passwords";
import { listIssues } from "@/lib/store";
import type { DeptKey } from "@/lib/types";

export const dynamic = "force-dynamic";

const REPORT_PLACES = DEPARTMENTS;

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin login required" }, { status: 401 });

  const [overrides, issues, accounts] = await Promise.all([
    listDeptPasswordOverrides(),
    listIssues(),
    Promise.resolve(departmentAccounts()),
  ]);
  const overrideMap = new Map(overrides.map((o) => [o.key, o]));

  const desks = DEPT_KEYS.map((key) => {
    const acct = accounts.find((a) => a.key === key)!;
    const override = overrideMap.get(key);
    const open = issues.filter((i) => i.status !== "resolved" && departmentKeyForIssue(i) === key).length;
    return {
      key,
      label: DEPT_LABEL[key],
      email: acct.email,
      demoEmail: DEMO_DEPT_EMAIL[key],
      openIssues: open,
      passwordUpdatedAt: override?.updated_at || null,
      passwordUpdatedBy: override?.updated_by || null,
      customPassword: Boolean(override),
    };
  });

  return NextResponse.json({
    admin: { email: admin.email },
    desks,
    reportPlaces: REPORT_PLACES,
  });
}

export async function PATCH(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin login required" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    key?: string;
    password?: string;
    confirm?: string;
  };
  const key = String(body.key || "").trim() as DeptKey;
  if (!DEPT_KEYS.includes(key)) {
    return NextResponse.json({ error: "Unknown department desk." }, { status: 400 });
  }
  const password = String(body.password || "");
  const confirm = String(body.confirm || "");
  if (password !== confirm) {
    return NextResponse.json({ error: "The two passwords do not match." }, { status: 400 });
  }
  const policy = passwordPolicyError(password);
  if (policy) return NextResponse.json({ error: policy }, { status: 400 });

  const saved = await setDeptPasswordOverride(key, password, admin.email);
  await appendAudit({
    actor_email: admin.email,
    actor_role: "admin",
    action: "admin.dept_password_change",
    target: key,
    detail: `Changed password for ${DEPT_LABEL[key]}. That desk must sign in again.`,
    ip: requestIp(req),
  });

  return NextResponse.json({
    ok: true,
    key,
    passwordUpdatedAt: saved.updated_at,
    passwordUpdatedBy: saved.updated_by,
  });
}
