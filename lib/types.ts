export type Status = "open" | "assigned" | "on_it" | "resolved";
export type Severity = "low" | "medium" | "high" | "critical";

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

export type Department =
  | "Electrical"
  | "Plumbing"
  | "IT"
  | "Estate"
  | "Housekeeping"
  | "Hostel warden"
  | "Mess committee"
  | "Security + estate";

export interface Issue {
  id: string;
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
}

export interface TrailStats {
  avg_assign_hrs: number | null;
  avg_resolve_hrs: number | null;
  assigned_or_resolved: number;
  resolved_count: number;
}

export interface AppSnapshot {
  issues: Issue[];
  clusters: Cluster[];
  confirmations: Confirmation[];
}

export interface ClassifyResult {
  category: Category;
  severity: Severity;
  department: Department;
  safety: number;
  building?: string;
  source: "groq" | "fallback";
}
