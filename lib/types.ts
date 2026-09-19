export type Status = "open" | "assigned" | "on_it" | "resolved";
export type Severity = "low" | "medium" | "high" | "critical";

/** A student's answer to "is this actually fixed?" */
export type Verdict = "fixed" | "broken";

/**
 * Where a department's fix claim stands.
 * `none` — no claim yet. `awaiting` — claimed, students still have time to check.
 * `verified` — students confirmed it. `unconfirmed` — window closed, nobody checked.
 * `reopened` — students rejected the claim and the job came back.
 */
export type ProofState = "none" | "awaiting" | "verified" | "unconfirmed" | "reopened";

export type Category =
  | "Electrical / lights"
  | "Water / leakage"
  | "Wi-Fi / network"
  | "Furniture"
  | "Washroom"
  | "Hostel"
  | "Mess"
  | "Road / path / safety"
  | "Other";

export type Department = "IT" | "Hostel" | "Mess" | "Campus" | "Library";

/** Login / queue desk keys. Stored `Department` values normalize onto these. */
export type DeptKey = "it" | "hostel" | "mess" | "campus" | "library";

export type StaffRole = "admin" | "department";

export interface StaffSession {
  email: string;
  role: StaffRole;
  department?: DeptKey;
  departmentLabel?: string;
}

export interface Issue {
  id: string;
  /** Registered QR location; null for a manually placed pin. */
  location_id?: string | null;
  ticket_code: string;
  description: string;
  category: Category;
  severity: Severity;
  department: Department;
  status: Status;
  safety: number;
  location_weight: number;
  priority: number;
  lat: number;
  lng: number;
  building: string;
  photo_url: string | null;
  resolve_photo_url: string | null;
  eta_at: string | null;
  embedding: number[] | null;
  cluster_id: string;
  created_at: string;
  assigned_at: string | null;
  resolved_at: string | null;
  worker_name: string | null;
  escalated_at: string | null;
  /** Fix claim is open for checking until this time. Null unless a claim is live. */
  verify_deadline_at: string | null;
  /** Students who confirmed the current claim. */
  verified_count: number;
  /** Students who rejected the current claim. */
  disputed_count: number;
  verified_at: string | null;
  /** How many times students sent this job back after a fix claim. */
  reopen_count: number;
  /** Bumped on every reopen so one browser can check each fresh claim once. */
  claim_round: number;
}

/** One anonymous check of one fix claim. */
export interface Verification {
  id: string;
  issue_id: string;
  cluster_id: string;
  client_hash: string;
  verdict: Verdict;
  round: number;
  photo_url: string | null;
  created_at: string;
}

export interface Cluster {
  id: string;
  title: string;
  category: Category;
  building: string;
  report_count: number;
  me_too_count: number;
  priority: number;
  is_recurring: boolean;
  lat: number;
  lng: number;
  status: Status;
  severity: Severity;
  created_at: string;
}

export interface Confirmation {
  id: string;
  cluster_id: string;
  client_hash: string;
  created_at: string;
}

export interface GeoPoint {
  lat: number;
  lng: number;
}

export type BoundaryKind = "polygon" | "rectangle";

/** Admin-drawn campus geofence on the real map. */
export interface CampusBoundary {
  type: BoundaryKind;
  vertices: GeoPoint[];
  updated_at: string;
  updated_by?: string | null;
}

export interface IssueWithCluster extends Issue {
  title: string;
  report_count: number;
  me_too_count: number;
  is_recurring: boolean;
}

export interface HealthBreakdown {
  score: number;
  critical_open: number;
  high_open: number;
  medium_open: number;
  overdue: number;
  recurring_hotspots: number;
  /** Closed, check window expired, nobody confirmed the fix. */
  unconfirmed_claims: number;
  /** Open again because students rejected a fix claim. */
  reopened_open: number;
}

/** Whether fix claims survive student checks. A desk cannot improve this by closing faster. */
export interface ProofStats {
  claims: number;
  verified: number;
  disputed: number;
  awaiting: number;
  unconfirmed: number;
  /** verified ÷ (verified + disputed). Null until students have judged a claim. */
  verified_rate: number | null;
  /** disputed ÷ claims. Null until a claim exists. */
  reopen_rate: number | null;
}

export interface TrailStats {
  avg_assign_hrs: number | null;
  avg_resolve_hrs: number | null;
  assigned_or_resolved: number;
  resolved_count: number;
}

export interface PlaceHealth extends HealthBreakdown {
  name: Department;
  open_count: number;
}

export interface FixedIssue {
  id: string;
  ticket_code: string;
  title: string;
  building: string;
  department: Department;
  resolved_at: string;
  proof: ProofState;
  verified_count: number;
  verify_deadline_at: string | null;
}

export interface Hotspot {
  building: string;
  category: string;
  count: number;
  open_count: number;
  ticket_code: string;
  title: string;
}

export interface AppSnapshot {
  revision?: number;
  locations?: ReportLocation[];
  incidents?: IncidentRecord[];
  issues: Issue[];
  clusters: Cluster[];
  confirmations: Confirmation[];
  verifications: Verification[];
  campus_boundary: CampusBoundary | null;
}

export interface ReportLocation {
  id: string;
  name: string;
  department: Department;
  lat: number;
  lng: number;
  created_at: string;
}

export type IncidentKind = "power" | "network" | "water";
export interface IncidentRecord {
  id: string;
  kind: IncidentKind;
  issue_ids: string[];
  decision: "confirmed" | "separate";
  title: string;
  place: string;
  created_at: string;
  decided_by: string;
}

export interface ClassifyResult {
  category: Category;
  severity: Severity;
  department: Department;
  safety: number;
  building?: string;
  source: "gemini" | "groq" | "fallback";
}
