import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { locationWeightFor, nearestBuilding } from "./campus";
import { classifyReport } from "./classify";
import { findMergeTarget, tokenEmbedding } from "./duplicates";
import { markRecurring } from "./health";
import { clusterPriorityFromIssues, computePriority, recomputeIssuePriority } from "./scoring";
import { buildSeed } from "./seed-data";
import { hasSupabase, supabaseAdmin } from "./supabase";
import type { AppSnapshot, Cluster, Confirmation, Issue, IssueWithCluster, Status } from "./types";

const FILE = path.join(process.cwd(), ".data", "store.json");

let memory: AppSnapshot | null = null;
let writeChain: Promise<void> = Promise.resolve();

function withCluster(issue: Issue, cluster: Cluster | undefined): IssueWithCluster {
  return {
    ...issue,
    title: cluster?.title || issue.description.slice(0, 72),
    report_count: cluster?.report_count ?? 1,
    me_too_count: cluster?.me_too_count ?? 0,
    is_recurring: cluster?.is_recurring ?? false,
    priority: cluster
      ? recomputeIssuePriority({ ...issue, priority: issue.priority }, cluster)
      : issue.priority,
  };
}

function refreshPriorities(snap: AppSnapshot): AppSnapshot {
  const clusters = markRecurring(snap.issues, snap.clusters).map((c) => ({
    ...c,
    priority: clusterPriorityFromIssues(c, snap.issues),
  }));
  const cmap = new Map(clusters.map((c) => [c.id, c]));
  const issues = snap.issues.map((i) => {
    const c = cmap.get(i.cluster_id);
    return c ? { ...i, priority: recomputeIssuePriority(i, c) } : i;
  });
  return { ...snap, issues, clusters };
}

async function loadFile(): Promise<AppSnapshot> {
  if (memory) return memory;
  try {
    const raw = await readFile(FILE, "utf8");
    memory = JSON.parse(raw) as AppSnapshot;
  } catch {
    memory = buildSeed();
    await persist(memory);
  }
  return memory;
}

async function persist(snap: AppSnapshot) {
  memory = snap;
  writeChain = writeChain.then(async () => {
    await mkdir(path.dirname(FILE), { recursive: true });
    await writeFile(FILE, JSON.stringify(snap, null, 2), "utf8");
  });
  await writeChain;
}

function newId(): string {
  return crypto.randomUUID();
}

function nextTicket(issues: Issue[]): string {
  const nums = issues.map((i) => Number(String(i.ticket_code).replace(/\D/g, ""))).filter((n) => Number.isFinite(n));
  const next = Math.max(1000, ...nums) + 1;
  return `CP-${next}`;
}

function rowToIssue(row: Record<string, unknown>): Issue {
  return {
    id: String(row.id),
    ticket_code: String(row.ticket_code),
    description: String(row.description),
    category: row.category as Issue["category"],
    severity: row.severity as Issue["severity"],
    department: row.department as Issue["department"],
    status: row.status as Issue["status"],
    safety: Number(row.safety),
    location_weight: Number(row.location_weight),
    priority: Number(row.priority),
    lat: Number(row.lat),
    lng: Number(row.lng),
    building: String(row.building),
    photo_url: (row.photo_url as string) || null,
    resolve_photo_url: (row.resolve_photo_url as string) || null,
    eta_at: (row.eta_at as string) || null,
    embedding: (row.embedding as number[]) || null,
    cluster_id: String(row.cluster_id),
    created_at: String(row.created_at),
    assigned_at: (row.assigned_at as string) || null,
    resolved_at: (row.resolved_at as string) || null,
  };
}

function rowToCluster(row: Record<string, unknown>): Cluster {
  return {
    id: String(row.id),
    title: String(row.title),
    category: row.category as Cluster["category"],
    building: String(row.building),
    report_count: Number(row.report_count),
    me_too_count: Number(row.me_too_count),
    priority: Number(row.priority),
    is_recurring: Boolean(row.is_recurring),
    lat: Number(row.lat),
    lng: Number(row.lng),
    status: row.status as Cluster["status"],
    severity: row.severity as Cluster["severity"],
    created_at: String(row.created_at),
  };
}

async function loadSupabase(): Promise<AppSnapshot> {
  const sb = supabaseAdmin();
  const [issuesRes, clustersRes, confRes] = await Promise.all([
    sb.from("issues").select("*").order("created_at", { ascending: false }),
    sb.from("issue_clusters").select("*"),
    sb.from("issue_confirmations").select("*"),
  ]);
  if (issuesRes.error) throw issuesRes.error;
  if (clustersRes.error) throw clustersRes.error;
  if (confRes.error) throw confRes.error;
  return refreshPriorities({
    issues: (issuesRes.data || []).map((r) => rowToIssue(r as Record<string, unknown>)),
    clusters: (clustersRes.data || []).map((r) => rowToCluster(r as Record<string, unknown>)),
    confirmations: (confRes.data || []).map((r) => ({
      id: String((r as { id: string }).id),
      cluster_id: String((r as { cluster_id: string }).cluster_id),
      client_hash: String((r as { client_hash?: string }).client_hash || ""),
      created_at: String((r as { created_at: string }).created_at),
    })),
  });
}

export async function loadSnapshot(): Promise<AppSnapshot> {
  const snap = hasSupabase() ? await loadSupabase() : await loadFile();
  return refreshPriorities(snap);
}

export async function listIssues(): Promise<IssueWithCluster[]> {
  const snap = await loadSnapshot();
  const cmap = new Map(snap.clusters.map((c) => [c.id, c]));
  return snap.issues
    .map((i) => withCluster(i, cmap.get(i.cluster_id)))
    .sort((a, b) => b.priority - a.priority);
}

export async function listClusters(): Promise<Cluster[]> {
  const snap = await loadSnapshot();
  return [...snap.clusters].sort((a, b) => b.priority - a.priority);
}

export async function getIssueByCode(code: string): Promise<IssueWithCluster | null> {
  const snap = await loadSnapshot();
  const issue = snap.issues.find((i) => i.ticket_code.toLowerCase() === code.toLowerCase());
  if (!issue) return null;
  return withCluster(issue, snap.clusters.find((c) => c.id === issue.cluster_id));
}

export async function getIssueById(id: string): Promise<IssueWithCluster | null> {
  const snap = await loadSnapshot();
  const issue = snap.issues.find((i) => i.id === id);
  if (!issue) return null;
  return withCluster(issue, snap.clusters.find((c) => c.id === issue.cluster_id));
}

export interface CreateIssueInput {
  description: string;
  lat: number;
  lng: number;
  building?: string;
  photo_url?: string | null;
  forceNew?: boolean;
}

export async function createIssue(input: CreateIssueInput) {
  const building = input.building || nearestBuilding(input.lat, input.lng).name;
  const classified = await classifyReport(input.description, building);
  const embedding = tokenEmbedding(input.description);
  const snap = await loadSnapshot();

  if (!input.forceNew) {
    const merge = findMergeTarget(snap.clusters, snap.issues, input.lat, input.lng, input.description, embedding);
    if (merge) {
      return addReportToCluster(snap, merge.cluster.id, {
        description: input.description,
        lat: input.lat,
        lng: input.lng,
        building: classified.building || building,
        photo_url: input.photo_url || null,
        classified,
        embedding,
      });
    }
  }

  const now = new Date().toISOString();
  const clusterId = newId();
  const issueId = newId();
  const location_weight = locationWeightFor(classified.building || building);
  const cluster: Cluster = {
    id: clusterId,
    title: titleFrom(input.description, classified.category, classified.building || building),
    category: classified.category,
    building: classified.building || building,
    report_count: 1,
    me_too_count: 0,
    priority: computePriority({
      safety: classified.safety,
      reportCount: 1,
      meTooCount: 0,
      createdAt: now,
      locationWeight: location_weight,
    }),
    is_recurring: false,
    lat: input.lat,
    lng: input.lng,
    status: "open",
    severity: classified.severity,
    created_at: now,
  };
  const issue: Issue = {
    id: issueId,
    ticket_code: nextTicket(snap.issues),
    description: input.description.trim(),
    category: classified.category,
    severity: classified.severity,
    department: classified.department,
    status: "open",
    safety: classified.safety,
    location_weight,
    priority: cluster.priority,
    lat: input.lat,
    lng: input.lng,
    building: cluster.building,
    photo_url: input.photo_url || null,
    resolve_photo_url: null,
    eta_at: null,
    embedding,
    cluster_id: clusterId,
    created_at: now,
    assigned_at: null,
    resolved_at: null,
  };

  if (hasSupabase()) {
    const sb = supabaseAdmin();
    const { error: cErr } = await sb.from("issue_clusters").insert(clusterRow(cluster));
    if (cErr) throw cErr;
    const { error: iErr } = await sb.from("issues").insert(issueRow(issue));
    if (iErr) throw iErr;
    await syncRecurringSupabase();
  } else {
    const next = refreshPriorities({
      issues: [issue, ...snap.issues],
      clusters: [cluster, ...snap.clusters],
      confirmations: snap.confirmations,
    });
    await persist(next);
  }

  const saved = await getIssueById(issueId);
  return { issue: saved, classified, merged: false };
}

async function addReportToCluster(
  snap: AppSnapshot,
  clusterId: string,
  extra: {
    description: string;
    lat: number;
    lng: number;
    building: string;
    photo_url: string | null;
    classified: Awaited<ReturnType<typeof classifyReport>>;
    embedding: number[];
  },
) {
  const cluster = snap.clusters.find((c) => c.id === clusterId);
  if (!cluster) throw new Error("Cluster missing");
  const now = new Date().toISOString();
  const location_weight = locationWeightFor(extra.building);
  const issue: Issue = {
    id: newId(),
    ticket_code: nextTicket(snap.issues),
    description: extra.description.trim(),
    category: extra.classified.category,
    severity: extra.classified.severity,
    department: extra.classified.department,
    status: cluster.status === "resolved" ? "open" : cluster.status,
    safety: extra.classified.safety,
    location_weight,
    priority: 0,
    lat: extra.lat,
    lng: extra.lng,
    building: extra.building,
    photo_url: extra.photo_url,
    resolve_photo_url: null,
    eta_at: null,
    embedding: extra.embedding,
    cluster_id: clusterId,
    created_at: now,
    assigned_at: null,
    resolved_at: null,
  };
  const updated: Cluster = {
    ...cluster,
    report_count: cluster.report_count + 1,
    status: cluster.status === "resolved" ? "open" : cluster.status,
  };
  updated.priority = computePriority({
    safety: Math.max(cluster.severity === "critical" ? 5 : extra.classified.safety, extra.classified.safety),
    reportCount: updated.report_count,
    meTooCount: updated.me_too_count,
    createdAt: cluster.created_at,
    locationWeight: location_weight,
  });

  if (hasSupabase()) {
    const sb = supabaseAdmin();
    const { error: iErr } = await sb.from("issues").insert(issueRow(issue));
    if (iErr) throw iErr;
    const { error: cErr } = await sb
      .from("issue_clusters")
      .update({
        report_count: updated.report_count,
        priority: updated.priority,
        status: updated.status,
      })
      .eq("id", clusterId);
    if (cErr) throw cErr;
    await syncRecurringSupabase();
  } else {
    const next = refreshPriorities({
      issues: [issue, ...snap.issues],
      clusters: snap.clusters.map((c) => (c.id === clusterId ? updated : c)),
      confirmations: snap.confirmations,
    });
    await persist(next);
  }
  return { issue: await getIssueById(issue.id), classified: extra.classified, merged: true };
}

function titleFrom(description: string, category: string, building: string): string {
  const clean = description.replace(/\s+/g, " ").trim();
  if (clean.length <= 56) return clean;
  return `${building} ${category}`.replace(/\s+/g, " ");
}

export async function meToo(clusterId: string, clientHash: string) {
  const snap = await loadSnapshot();
  const cluster = snap.clusters.find((c) => c.id === clusterId);
  if (!cluster) return { ok: false as const, error: "Issue not found" };
  if (cluster.status === "resolved") return { ok: false as const, error: "This issue is already resolved" };
  const dup = snap.confirmations.find((c) => c.cluster_id === clusterId && c.client_hash === clientHash);
  if (dup) return { ok: false as const, error: "Already counted from this browser", cluster, already: true };
  const confirmation: Confirmation = {
    id: newId(),
    cluster_id: clusterId,
    client_hash: clientHash,
    created_at: new Date().toISOString(),
  };
  const updated = { ...cluster, me_too_count: cluster.me_too_count + 1 };
  updated.priority = computePriority({
    safety: snap.issues.find((i) => i.cluster_id === clusterId)?.safety ?? 3,
    reportCount: updated.report_count,
    meTooCount: updated.me_too_count,
    createdAt: updated.created_at,
    locationWeight: locationWeightFor(updated.building),
  });

  if (hasSupabase()) {
    const sb = supabaseAdmin();
    const { error: e1 } = await sb.from("issue_confirmations").insert({
      id: confirmation.id,
      cluster_id: clusterId,
      client_hash: clientHash,
    });
    if (e1) {
      if (e1.code === "23505") return { ok: false as const, error: "Already counted from this browser", cluster, already: true };
      throw e1;
    }
    const { error: e2 } = await sb
      .from("issue_clusters")
      .update({ me_too_count: updated.me_too_count, priority: updated.priority })
      .eq("id", clusterId);
    if (e2) throw e2;
  } else {
    await persist(
      refreshPriorities({
        ...snap,
        clusters: snap.clusters.map((c) => (c.id === clusterId ? updated : c)),
        confirmations: [...snap.confirmations, confirmation],
      }),
    );
  }
  const fresh = (await loadSnapshot()).clusters.find((c) => c.id === clusterId)!;
  return { ok: true as const, cluster: fresh };
}

export async function updateIssue(
  id: string,
  patch: {
    status?: Status;
    eta_at?: string | null;
    resolve_photo_url?: string | null;
    department?: Issue["department"];
  },
) {
  const snap = await loadSnapshot();
  const issue = snap.issues.find((i) => i.id === id);
  if (!issue) return null;
  const now = new Date().toISOString();
  const next: Issue = { ...issue, ...patch };
  if (patch.status === "assigned" || patch.status === "on_it") {
    if (!next.assigned_at) next.assigned_at = now;
  }
  if (patch.status === "on_it" && patch.eta_at) next.eta_at = patch.eta_at;
  if (patch.status === "resolved") {
    next.resolved_at = now;
    if (patch.resolve_photo_url !== undefined) next.resolve_photo_url = patch.resolve_photo_url;
  }

  let clusters = snap.clusters;
  const cluster = snap.clusters.find((c) => c.id === issue.cluster_id);
  if (cluster && patch.status) {
    const siblings = snap.issues.filter((i) => i.cluster_id === cluster.id && i.id !== id);
    const leadStatus = next.status;
    const anyOpen = [next, ...siblings].some((i) => i.status !== "resolved");
    const updatedCluster: Cluster = {
      ...cluster,
      status: anyOpen ? (leadStatus === "resolved" ? cluster.status : leadStatus) : "resolved",
      severity: next.severity,
    };
    if (next.status !== "resolved") updatedCluster.status = next.status;
    if (next.status === "resolved" && !anyOpen) updatedCluster.status = "resolved";
    clusters = snap.clusters.map((c) => (c.id === cluster.id ? updatedCluster : c));
  }

  if (hasSupabase()) {
    const sb = supabaseAdmin();
    const { error } = await sb
      .from("issues")
      .update({
        status: next.status,
        assigned_at: next.assigned_at,
        resolved_at: next.resolved_at,
        eta_at: next.eta_at,
        resolve_photo_url: next.resolve_photo_url,
        department: next.department,
      })
      .eq("id", id);
    if (error) throw error;
    const c = clusters.find((x) => x.id === issue.cluster_id);
    if (c) {
      await sb.from("issue_clusters").update({ status: c.status, severity: c.severity }).eq("id", c.id);
    }
  } else {
    await persist(
      refreshPriorities({
        issues: snap.issues.map((i) => (i.id === id ? next : i)),
        clusters,
        confirmations: snap.confirmations,
      }),
    );
  }
  return getIssueById(id);
}

function clusterRow(c: Cluster) {
  return {
    id: c.id,
    title: c.title,
    category: c.category,
    building: c.building,
    report_count: c.report_count,
    me_too_count: c.me_too_count,
    priority: c.priority,
    is_recurring: c.is_recurring,
    lat: c.lat,
    lng: c.lng,
    status: c.status,
    severity: c.severity,
    created_at: c.created_at,
  };
}

function issueRow(i: Issue) {
  return {
    id: i.id,
    ticket_code: i.ticket_code,
    description: i.description,
    category: i.category,
    severity: i.severity,
    department: i.department,
    status: i.status,
    safety: i.safety,
    location_weight: i.location_weight,
    priority: i.priority,
    lat: i.lat,
    lng: i.lng,
    building: i.building,
    photo_url: i.photo_url,
    resolve_photo_url: i.resolve_photo_url,
    eta_at: i.eta_at,
    embedding: i.embedding,
    cluster_id: i.cluster_id,
    created_at: i.created_at,
    assigned_at: i.assigned_at,
    resolved_at: i.resolved_at,
  };
}

async function syncRecurringSupabase() {
  const snap = await loadSupabase();
  const marked = markRecurring(snap.issues, snap.clusters);
  const sb = supabaseAdmin();
  for (const c of marked) {
    await sb.from("issue_clusters").update({ is_recurring: c.is_recurring, priority: c.priority }).eq("id", c.id);
  }
}
