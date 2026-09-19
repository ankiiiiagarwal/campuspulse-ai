import type { Category, Department, DeptKey, Issue, StaffSession } from "./types";

export const DEPARTMENTS: Department[] = ["IT", "Hostel", "Mess", "Campus", "Library"];

export const DEPT_KEYS: DeptKey[] = ["it", "hostel", "mess", "campus", "library"];

export const DEPT_LABEL: Record<DeptKey, Department> = {
  it: "IT",
  hostel: "Hostel",
  mess: "Mess",
  campus: "Campus",
  library: "Library",
};

/** classify.ts / spec stored department → desk key */
export const STORED_DEPT_TO_KEY: Record<Department, DeptKey> = {
  IT: "it",
  Hostel: "hostel",
  Mess: "mess",
  Campus: "campus",
  Library: "library",
};

/** Same routing as CATEGORY_TABLE in lib/classify.ts (place can still override). */
export const CATEGORY_TO_KEY: Record<Category, DeptKey> = {
  "Electrical / lights": "campus",
  "Water / leakage": "campus",
  "Wi-Fi / network": "it",
  Furniture: "campus",
  Washroom: "campus",
  Hostel: "hostel",
  Mess: "mess",
  "Road / path / safety": "campus",
  Other: "campus",
};

export const DEMO_DEPT_EMAIL: Record<DeptKey, string> = {
  it: "it@campus.local",
  hostel: "hostel@campus.local",
  mess: "mess@campus.local",
  campus: "campus@campus.local",
  library: "library@campus.local",
};

const EMAIL_ENV: Record<DeptKey, string> = {
  it: "DEPT_IT_EMAIL",
  hostel: "DEPT_HOSTEL_EMAIL",
  mess: "DEPT_MESS_EMAIL",
  campus: "DEPT_CAMPUS_EMAIL",
  library: "DEPT_LIBRARY_EMAIL",
};

const PASSWORD_ENV: Record<DeptKey, string> = {
  it: "DEPT_IT_PASSWORD",
  hostel: "DEPT_HOSTEL_PASSWORD",
  mess: "DEPT_MESS_PASSWORD",
  campus: "DEPT_CAMPUS_PASSWORD",
  library: "DEPT_LIBRARY_PASSWORD",
};

const LEGACY_DEPT_TO_KEY: Record<string, DeptKey> = {
  electrical: "campus",
  plumbing: "campus",
  estate: "campus",
  housekeeping: "campus",
  security: "campus",
  "security estate": "campus",
  "hostel warden": "hostel",
  "hostel warden desk": "hostel",
  "mess committee": "mess",
};

export interface DeptAccount {
  key: DeptKey;
  label: Department;
  email: string;
  password: string;
}

export function defaultDeptPassword(): string {
  return process.env.DEPT_PASSWORD || process.env.ADMIN_PASSWORD || "campuspulse";
}

export function envDeptPassword(key: DeptKey): string {
  return process.env[PASSWORD_ENV[key]] || defaultDeptPassword();
}

export function departmentAccounts(): DeptAccount[] {
  const shared = defaultDeptPassword();
  return DEPT_KEYS.map((key) => ({
    key,
    label: DEPT_LABEL[key],
    email: (process.env[EMAIL_ENV[key]] || DEMO_DEPT_EMAIL[key]).trim().toLowerCase(),
    password: process.env[PASSWORD_ENV[key]] || shared,
  }));
}

export function accountForEmail(email: string): DeptAccount | null {
  const e = email.trim().toLowerCase();
  return departmentAccounts().find((a) => a.email === e) ?? null;
}

function fold(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function placeDeskKey(value: string | null | undefined): DeptKey | null {
  const raw = fold(value || "");
  if (!raw) return null;
  if (raw.includes("librar")) return "library";
  if (raw.includes("hostel") || raw.includes("warden")) return "hostel";
  if (raw.includes("mess") || raw.includes("canteen") || raw.includes("dining")) return "mess";
  if (raw === "it" || raw.startsWith("it ") || raw.includes("it department") || raw.includes("it desk")) {
    return "it";
  }
  if (raw.includes("campus")) return "campus";
  return null;
}

/**
 * Map any classify / UI / login spelling onto a desk key.
 * Legacy Electrical / Plumbing / Estate / Housekeeping / Security become Campus.
 */
export function normalizeDepartment(value: string | null | undefined): DeptKey | null {
  if (!value) return null;
  const raw = fold(value);
  if (!raw) return null;

  for (const [name, key] of Object.entries(STORED_DEPT_TO_KEY) as [Department, DeptKey][]) {
    if (fold(name) === raw) return key;
  }
  for (const key of DEPT_KEYS) {
    if (key === raw.replace(/\s+/g, "") || fold(DEPT_LABEL[key]) === raw) return key;
  }
  for (const [category, key] of Object.entries(CATEGORY_TO_KEY) as [Category, DeptKey][]) {
    if (fold(category) === raw) return key;
  }
  if (LEGACY_DEPT_TO_KEY[raw]) return LEGACY_DEPT_TO_KEY[raw];

  if (raw.includes("wifi") || raw.includes("wi fi") || raw.includes("network") || raw === "it") return "it";
  if (raw.includes("librar")) return "library";
  if (raw.includes("hostel") || raw.includes("warden")) return "hostel";
  if (raw.includes("mess") || raw.includes("canteen")) return "mess";
  if (
    raw.includes("electrical") ||
    raw.includes("plumb") ||
    raw.includes("estate") ||
    raw.includes("housekeep") ||
    raw.includes("security") ||
    raw.includes("campus")
  ) {
    return "campus";
  }
  return placeDeskKey(raw);
}

export function isDepartment(value: unknown): value is Department {
  return typeof value === "string" && (DEPARTMENTS as string[]).includes(value);
}

export function departmentForReport(category: Category, building?: string): Department {
  if (category === "Wi-Fi / network") return "IT";
  if (category === "Mess") return "Mess";
  if (category === "Hostel") return "Hostel";
  const place = placeDeskKey(building);
  if (place) return DEPT_LABEL[place];
  return "Campus";
}

/** Keep an already-valid desk. Remap leftover Electrical / Plumbing / … using category + place. */
export function canonicalDepartment(dept?: string, building?: string, category?: string): Department {
  if (isDepartment(dept)) return dept;
  const key = normalizeDepartment(dept);
  if (key === "it" || key === "hostel" || key === "mess" || key === "library") return DEPT_LABEL[key];
  return departmentForReport((category as Category) || "Other", building);
}

export function coerceDepartment(value: unknown): Department | null {
  if (isDepartment(value)) return value;
  const key = normalizeDepartment(String(value ?? ""));
  return key ? DEPT_LABEL[key] : null;
}

export function departmentKeyForIssue(issue: Pick<Issue, "department" | "category" | "building">): DeptKey | null {
  const fromDept = normalizeDepartment(issue.department);
  if (fromDept) return fromDept;
  if (issue.category && CATEGORY_TO_KEY[issue.category]) {
    return normalizeDepartment(departmentForReport(issue.category, issue.building));
  }
  return normalizeDepartment(issue.category) || placeDeskKey(issue.building);
}

export function issueBelongsToDepartment(
  issue: Pick<Issue, "department" | "category" | "building">,
  key: DeptKey,
): boolean {
  return departmentKeyForIssue(issue) === key;
}

export function scopeIssuesForSession<
  TIssue extends Pick<Issue, "department" | "category" | "building" | "cluster_id">,
  TCluster extends { id: string },
>(session: StaffSession | null | undefined, issues: TIssue[], clusters: TCluster[]) {
  if (!session || session.role !== "department" || !session.department) {
    return { issues, clusters };
  }
  const scoped = issues.filter((i) => issueBelongsToDepartment(i, session.department!));
  const keep = new Set(scoped.map((i) => i.cluster_id));
  return { issues: scoped, clusters: clusters.filter((c) => keep.has(c.id)) };
}

export function departmentForbidden(
  session: StaffSession | null | undefined,
  issue: Pick<Issue, "department" | "category" | "building">,
): boolean {
  return Boolean(
    session && session.role === "department" && session.department && !issueBelongsToDepartment(issue, session.department),
  );
}
