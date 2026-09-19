/**
 * Optional demo dataset for presentations.
 * The live app does NOT load this automatically into .data/store.json.
 * Use `npm run demo` for an isolated, populated local demo without removing real data.
 */
import { locationWeightFor } from "./campus";
import { canonicalDepartment } from "./departments";
import { tokenEmbedding } from "./duplicates";
import { computePriority } from "./scoring";
import type { Category, Cluster, Confirmation, Issue, Severity, Status } from "./types";
import { VERIFY_WINDOW_HOURS, verifyDeadlineFrom } from "./verification";

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}

function id(kind: "c" | "i" | "m", n: number): string {
  const prefix = kind === "c" ? "a" : kind === "i" ? "b" : "c";
  return `${prefix}1000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

interface SeedIssue {
  n: number;
  code: number;
  cluster: number;
  title: string;
  description: string;
  category: Category;
  severity: Severity;
  department: string;
  status: Status;
  safety: number;
  building: string;
  lat: number;
  lng: number;
  createdH: number;
  assignedH?: number;
  resolvedH?: number;
  etaH?: number;
}

const RAW: SeedIssue[] = [
  {
    n: 1,
    code: 1001,
    cluster: 1,
    title: "Library Wi-Fi dead zone",
    description: "Wi-Fi is completely dead in the library reading area. Cannot load even a single page.",
    category: "Wi-Fi / network",
    severity: "high",
    department: "IT",
    status: "open",
    safety: 3,
    building: "Library",
    lat: 28.6108,
    lng: 77.0385,
    createdH: 8,
  },
  {
    n: 2,
    code: 1002,
    cluster: 1,
    title: "Library Wi-Fi dead zone",
    description: "Second floor library Wi-Fi still dropping every few minutes near the stacks.",
    category: "Wi-Fi / network",
    severity: "high",
    department: "IT",
    status: "resolved",
    safety: 3,
    building: "Library",
    lat: 28.61082,
    lng: 77.03848,
    createdH: 144,
    assignedH: 142,
    resolvedH: 132,
  },
  {
    n: 3,
    code: 1003,
    cluster: 1,
    title: "Library Wi-Fi dead zone",
    description: "Reading room Wi-Fi was down again during evening study hours.",
    category: "Wi-Fi / network",
    severity: "high",
    department: "IT",
    status: "resolved",
    safety: 3,
    building: "Library",
    lat: 28.61078,
    lng: 77.03852,
    createdH: 240,
    assignedH: 236,
    resolvedH: 220,
  },
  {
    n: 4,
    code: 1004,
    cluster: 2,
    title: "Flickering tube lights in library",
    description: "Tube lights flickering in the library west wing. Hard to read for long.",
    category: "Electrical / lights",
    severity: "medium",
    department: "Electrical",
    status: "open",
    safety: 4,
    building: "Library",
    lat: 28.61086,
    lng: 77.03862,
    createdH: 20,
  },
  {
    n: 5,
    code: 1005,
    cluster: 3,
    title: "Broken chair near library stacks",
    description: "Broken chair near the library stacks. One leg is loose and it tips over.",
    category: "Furniture",
    severity: "medium",
    department: "Estate",
    status: "open",
    safety: 2,
    building: "Library",
    lat: 28.6107,
    lng: 77.0384,
    createdH: 30,
  },
  {
    n: 6,
    code: 1006,
    cluster: 4,
    title: "Leaking tap in Hostel B washroom",
    description: "Leaking tap in the Hostel B ground-floor washroom. The floor is wet and slippery.",
    category: "Water / leakage",
    severity: "medium",
    department: "Plumbing",
    status: "open",
    safety: 3,
    building: "Hostel B",
    lat: 28.60898,
    lng: 77.03778,
    createdH: 12,
  },
  {
    n: 7,
    code: 1007,
    cluster: 5,
    title: "Hostel B Wi-Fi dead zone",
    description: "Hostel B Wi-Fi dead zone on the second floor. The router seems down and nobody can connect.",
    category: "Wi-Fi / network",
    severity: "high",
    department: "IT",
    status: "open",
    safety: 3,
    building: "Hostel B",
    lat: 28.609,
    lng: 77.0378,
    createdH: 5,
  },
  {
    n: 8,
    code: 1008,
    cluster: 6,
    title: "Hostel A washroom flush not working",
    description: "Flush in Hostel A washroom is not working. Queue forming in the morning.",
    category: "Washroom",
    severity: "low",
    department: "Housekeeping",
    status: "open",
    safety: 3,
    building: "Hostel A",
    lat: 28.6092,
    lng: 77.0368,
    createdH: 18,
  },
  {
    n: 9,
    code: 1009,
    cluster: 7,
    title: "Dark pathway behind hostels",
    description: "Pathway behind the hostels is completely dark at night. No street light. Feels unsafe to walk.",
    category: "Road / path / safety",
    severity: "critical",
    department: "Security + estate",
    status: "open",
    safety: 5,
    building: "Main Road",
    lat: 28.6114,
    lng: 77.03795,
    createdH: 6,
  },
  {
    n: 10,
    code: 1010,
    cluster: 8,
    title: "Flickering light in Lecture Hall 2",
    description: "Flickering tube light in Lecture Hall 2. Distracting during class and the fixture buzzes.",
    category: "Electrical / lights",
    severity: "high",
    department: "Electrical",
    status: "open",
    safety: 4,
    building: "Lecture Hall Complex",
    lat: 28.6105,
    lng: 77.0372,
    createdH: 15,
  },
  {
    n: 11,
    code: 1011,
    cluster: 9,
    title: "Wobbly table in the mess",
    description: "Wobbly dining table in the mess near the window. Trays slide off.",
    category: "Furniture",
    severity: "medium",
    department: "Estate",
    status: "assigned",
    safety: 2,
    building: "Mess",
    lat: 28.6094,
    lng: 77.0386,
    createdH: 108,
    assignedH: 100,
  },
  {
    n: 12,
    code: 1012,
    cluster: 10,
    title: "Academic block projector blank",
    description: "Projector in Academic Block room 204 stays blank after power on.",
    category: "Electrical / lights",
    severity: "low",
    department: "Electrical",
    status: "assigned",
    safety: 2,
    building: "Academic Block",
    lat: 28.611,
    lng: 77.037,
    createdH: 40,
    assignedH: 36,
  },
  {
    n: 13,
    code: 1013,
    cluster: 11,
    title: "Lab door lock jammed",
    description: "Lab Block door lock is jammed. People are propping the door open.",
    category: "Furniture",
    severity: "low",
    department: "Estate",
    status: "on_it",
    safety: 2,
    building: "Lab Block",
    lat: 28.6102,
    lng: 77.0365,
    createdH: 20,
    assignedH: 16,
    etaH: -4,
  },
  {
    n: 14,
    code: 1014,
    cluster: 12,
    title: "Garden sprinkler stuck on",
    description: "Garden sprinkler is stuck on and flooding the lawn path.",
    category: "Water / leakage",
    severity: "low",
    department: "Plumbing",
    status: "on_it",
    safety: 2,
    building: "Garden",
    lat: 28.61,
    lng: 77.0392,
    createdH: 10,
    assignedH: 8,
    etaH: -2,
  },
  {
    n: 15,
    code: 1015,
    cluster: 13,
    title: "Parking lot light out",
    description: "Parking lot light near the far row is out.",
    category: "Electrical / lights",
    severity: "low",
    department: "Electrical",
    status: "resolved",
    safety: 2,
    building: "Parking",
    lat: 28.6096,
    lng: 77.036,
    createdH: 192,
    assignedH: 188,
    resolvedH: 176,
  },
  {
    n: 16,
    code: 1016,
    cluster: 14,
    title: "Hostel A broken window latch",
    description: "Broken window latch in Hostel A corridor. Window slams in the wind.",
    category: "Hostel",
    severity: "low",
    department: "Hostel warden",
    status: "resolved",
    safety: 3,
    building: "Hostel A",
    lat: 28.60922,
    lng: 77.03682,
    createdH: 168,
    assignedH: 164,
    resolvedH: 150,
  },
  {
    n: 17,
    code: 1017,
    cluster: 15,
    title: "Mess serving counter messy",
    description: "Mess serving counter was left messy after dinner service.",
    category: "Mess",
    severity: "low",
    department: "Mess committee",
    status: "resolved",
    safety: 3,
    building: "Mess",
    lat: 28.60942,
    lng: 77.03862,
    createdH: 120,
    assignedH: 118,
    resolvedH: 110,
  },
  {
    n: 18,
    code: 1018,
    cluster: 16,
    title: "Sports complex bench split",
    description: "Wooden bench at the sports complex is split and has a sharp edge.",
    category: "Furniture",
    severity: "low",
    department: "Estate",
    status: "resolved",
    safety: 2,
    building: "Sports Complex",
    lat: 28.6086,
    lng: 77.0382,
    createdH: 216,
    assignedH: 210,
    resolvedH: 198,
  },
  {
    n: 19,
    code: 1019,
    cluster: 17,
    title: "Admin block AC drip",
    description: "AC in the admin lobby was dripping onto the floor.",
    category: "Water / leakage",
    severity: "low",
    department: "Plumbing",
    status: "resolved",
    safety: 3,
    building: "Admin Block",
    lat: 28.6112,
    lng: 77.0388,
    createdH: 96,
    assignedH: 94,
    resolvedH: 82,
  },
  {
    n: 20,
    code: 1020,
    cluster: 18,
    title: "Pothole near main gate",
    description: "Pothole near the main gate filled after last week’s repair.",
    category: "Road / path / safety",
    severity: "medium",
    department: "Security + estate",
    status: "resolved",
    safety: 4,
    building: "Main Road",
    lat: 28.6115,
    lng: 77.03805,
    createdH: 288,
    assignedH: 280,
    resolvedH: 260,
  },
  {
    n: 21,
    code: 1021,
    cluster: 19,
    title: "Broken chair in Lecture Hall 1",
    description: "Broken chair in Lecture Hall 1 last row.",
    category: "Furniture",
    severity: "low",
    department: "Estate",
    status: "assigned",
    safety: 2,
    building: "Lecture Hall Complex",
    lat: 28.61048,
    lng: 77.03718,
    createdH: 25,
    assignedH: 20,
  },
  {
    n: 22,
    code: 1022,
    cluster: 20,
    title: "Hostel B washroom soap dispenser",
    description: "Soap dispenser empty and loose in Hostel B washroom.",
    category: "Washroom",
    severity: "low",
    department: "Housekeeping",
    status: "on_it",
    safety: 3,
    building: "Hostel B",
    lat: 28.60902,
    lng: 77.03776,
    createdH: 14,
    assignedH: 10,
    etaH: -3,
  },
  {
    n: 23,
    code: 1023,
    cluster: 21,
    title: "Library AC loud rattle",
    description: "Library AC had a loud rattle near the entrance.",
    category: "Other",
    severity: "low",
    department: "Estate",
    status: "resolved",
    safety: 2,
    building: "Library",
    lat: 28.61076,
    lng: 77.03844,
    createdH: 72,
    assignedH: 70,
    resolvedH: 58,
  },
  {
    n: 24,
    code: 1024,
    cluster: 22,
    title: "Lab sink leak",
    description: "Lab sink was leaking under the bench. Wiped and sealed.",
    category: "Water / leakage",
    severity: "medium",
    department: "Plumbing",
    status: "resolved",
    safety: 3,
    building: "Lab Block",
    lat: 28.61022,
    lng: 77.03652,
    createdH: 144,
    assignedH: 140,
    resolvedH: 128,
  },
  {
    n: 25,
    code: 1025,
    cluster: 23,
    title: "Academic stairs light replaced",
    description: "Stairwell light in the academic block was out and has been replaced.",
    category: "Electrical / lights",
    severity: "low",
    department: "Electrical",
    status: "resolved",
    safety: 4,
    building: "Academic Block",
    lat: 28.61102,
    lng: 77.03704,
    createdH: 48,
    assignedH: 46,
    resolvedH: 36,
  },
];

const CLUSTER_ME_TOO: Record<number, number> = {
  1: 5,
  5: 2,
  7: 3,
  4: 1,
};

/** Closed but nobody checked, so the desk gets no credit for it. */
const UNCONFIRMED_CLUSTERS = new Set([21]);

/** Students rejected the first fix claim on these, so the job came back once. */
const SENT_BACK_CLUSTERS = new Set([9, 13]);

/** Demo spread of fix-claim outcomes across verified, awaiting and unconfirmed. */
function seedProof(row: SeedIssue): Pick<
  Issue,
  "verify_deadline_at" | "verified_count" | "disputed_count" | "verified_at" | "reopen_count" | "claim_round"
> {
  const sentBack = SENT_BACK_CLUSTERS.has(row.cluster);
  const reopen_count = sentBack ? 1 : 0;
  const claim_round = reopen_count;
  if (row.status !== "resolved" || row.resolvedH == null) {
    return {
      verify_deadline_at: null,
      verified_count: 0,
      disputed_count: 0,
      verified_at: null,
      reopen_count,
      claim_round,
    };
  }
  const claimedAt = hoursAgo(row.resolvedH);
  const deadline = verifyDeadlineFrom(claimedAt);
  if (UNCONFIRMED_CLUSTERS.has(row.cluster)) {
    return { verify_deadline_at: deadline, verified_count: 0, disputed_count: 0, verified_at: null, reopen_count, claim_round };
  }
  if (row.resolvedH < VERIFY_WINDOW_HOURS) {
    // Window still open — one student has confirmed, the claim is not settled yet.
    return { verify_deadline_at: deadline, verified_count: 1, disputed_count: 0, verified_at: null, reopen_count, claim_round };
  }
  return {
    verify_deadline_at: deadline,
    verified_count: 2,
    disputed_count: 0,
    verified_at: hoursAgo(Math.max(1, row.resolvedH - 2)),
    reopen_count,
    claim_round,
  };
}

export function buildSeed(): { issues: Issue[]; clusters: Cluster[]; confirmations: Confirmation[] } {
  const issues: Issue[] = RAW.map((row) => {
    const created_at = hoursAgo(row.createdH);
    const assigned_at = row.assignedH != null ? hoursAgo(row.assignedH) : null;
    const resolved_at = row.resolvedH != null ? hoursAgo(row.resolvedH) : null;
    const eta_at = row.etaH != null ? hoursAgo(row.etaH) : null;
    const location_weight = locationWeightFor(row.building, {
      category: row.category,
      description: row.description,
    });
    const report_count = RAW.filter((r) => r.cluster === row.cluster).length;
    const me_too = CLUSTER_ME_TOO[row.cluster] ?? 0;
    return {
      id: id("i", row.n),
      ticket_code: `CP-${row.code}`,
      description: row.description,
      category: row.category,
      severity: row.severity,
      department: canonicalDepartment(row.department, row.building, row.category),
      status: row.status,
      safety: row.safety,
      location_weight,
      priority: computePriority({
        safety: row.safety,
        reportCount: report_count,
        meTooCount: me_too,
        createdAt: created_at,
        locationWeight: location_weight,
      }),
      lat: row.lat,
      lng: row.lng,
      building: row.building,
      photo_url: null,
      resolve_photo_url: null,
      eta_at,
      embedding: tokenEmbedding(row.description),
      cluster_id: id("c", row.cluster),
      created_at,
      assigned_at,
      resolved_at,
      worker_name: null,
      escalated_at: row.status === "open" && row.createdH > 72 ? hoursAgo(72) : null,
      ...seedProof(row),
    };
  });

  const clusterIds = [...new Set(RAW.map((r) => r.cluster))];
  const clusters: Cluster[] = clusterIds.map((cid) => {
    const members = RAW.filter((r) => r.cluster === cid);
    const lead = members.find((m) => m.status !== "resolved") ?? members[0];
    const created_at = hoursAgo(Math.max(...members.map((m) => m.createdH)));
    const me_too = CLUSTER_ME_TOO[cid] ?? 0;
    const leadIssue = issues.find((i) => i.id === id("i", lead.n))!;
    const recurring = cid === 1;
    return {
      id: id("c", cid),
      title: lead.title,
      category: lead.category,
      building: lead.building,
      report_count: members.length,
      me_too_count: me_too,
      priority: computePriority({
        safety: lead.safety,
        reportCount: members.length,
        meTooCount: me_too,
        createdAt: created_at,
        locationWeight: leadIssue.location_weight,
      }),
      is_recurring: recurring,
      lat: lead.lat,
      lng: lead.lng,
      status: lead.status,
      severity: lead.severity,
      created_at,
    };
  });

  const confirmations: Confirmation[] = [];
  let m = 1;
  for (const [cid, count] of Object.entries(CLUSTER_ME_TOO)) {
    for (let i = 0; i < count; i++) {
      confirmations.push({
        id: id("m", m++),
        cluster_id: id("c", Number(cid)),
        client_hash: `seed-device-${cid}-${i}`,
        created_at: hoursAgo(4 + i),
      });
    }
  }

  return { issues, clusters, confirmations };
}
