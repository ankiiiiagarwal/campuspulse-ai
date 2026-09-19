import { mkdir, readFile, writeFile, link, unlink } from "fs/promises";
import path from "path";
import { mutate, WriteConflict } from "./mutation";
import { readRows } from "./database-read";
import { commitRemote } from "./snapshot-write";
import { validatePhoto } from "./upload";
import { appendAudit } from "./audit";
import { locationWeightFor, GENERIC_PLACE } from "./campus";
import { classifyReport } from "./classify";
import { canonicalDepartment, departmentForbidden } from "./departments";
import { findMergeTarget, tokenEmbedding } from "./duplicates";
import { assertIssueLocation, HttpError } from "./geo";
import { markRecurring } from "./health";
import { clusterPriorityFromIssues, computePriority, isOverdue, recomputeIssuePriority } from "./scoring";
import { buildSeed } from "./seed-data";
import { buildDemo } from "./demo-data";
import { replaceFile } from "./atomic-file";
import { isDemoMode, localDataFile } from "./local-mode";
import { hasSupabase, supabaseAdmin } from "./supabase";
import type {
  AppSnapshot,
  CampusBoundary,
  Cluster,
  Confirmation,
  Issue,
  IssueWithCluster,
  Status,
  Verdict,
  Verification,
  StaffSession,
} from "./types";
import {
  alreadyChecked,
  DISPUTE_WEIGHT_TO_REOPEN,
  disputeWeight,
  disputeWeightFor,
  CONFIRMATIONS_TO_VERIFY,
  proofState,
  verifyDeadlineFrom,
} from "./verification";
import { describeReportPhoto } from "./vision";
import { detectIncidents } from "./incidents";
import type { ReportLocation, IncidentRecord } from "./types";

const FILE = process.env.VERCEL
  ? path.join("/tmp", "campuspulse-store.json")
  : localDataFile("store.json");



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

function emptySnapshot(): AppSnapshot {
  return { issues: [], clusters: [], confirmations: [], verifications: [], campus_boundary: null };
}

/** Columns added by the verification loop, defaulted so older rows load clean. */
function withProofDefaults(issue: Issue): Issue {
  return {
    ...issue,
    verify_deadline_at: issue.verify_deadline_at ?? null,
    verified_count: Number(issue.verified_count ?? 0),
    disputed_count: Number(issue.disputed_count ?? 0),
    verified_at: issue.verified_at ?? null,
    reopen_count: Number(issue.reopen_count ?? 0),
    claim_round: Number(issue.claim_round ?? 0),
  };
}

function allowOptionalSeed(): boolean {
  return isDemoMode() || (process.env.NODE_ENV === "development" && process.env.LOAD_SEED === "1");
}

/** IDs produced by lib/seed-data.ts and supabase/seed.sql — never shown in normal mode. */
export function isLegacySeedId(id: string): boolean {
  return /^[abc]1000000-0000-4000-8000-[0-9a-f]{12}$/i.test(id);
}

function dropLegacySeed(snap: AppSnapshot): AppSnapshot {
  if (allowOptionalSeed()) return snap;
  const issues = snap.issues.filter((i) => !isLegacySeedId(i.id) && !isLegacySeedId(i.cluster_id));
  const keep = new Set(issues.map((i) => i.cluster_id));
  const live = new Set(issues.map((i) => i.id));
  const clusters = snap.clusters.filter((c) => keep.has(c.id) && !isLegacySeedId(c.id));
  const confirmations = snap.confirmations.filter((c) => keep.has(c.cluster_id) && !isLegacySeedId(c.id));
  const verifications = snap.verifications.filter((v) => live.has(v.issue_id));
  return { ...snap, issues, clusters, confirmations, verifications };
}

function normalizeSnap(raw: Partial<AppSnapshot> | null | undefined): AppSnapshot {
  return {
    locations: raw?.locations ?? [],
    incidents: raw?.incidents ?? [],
    issues: (raw?.issues || []).map((i) =>
      withProofDefaults({
        ...i,
        worker_name: i.worker_name ?? null,
        escalated_at: i.escalated_at ?? null,
        department: canonicalDepartment(i.department, i.building, i.category),
      }),
    ),
    clusters: raw?.clusters || [],
    confirmations: raw?.confirmations || [],
    verifications: raw?.verifications || [],
    campus_boundary: raw?.campus_boundary ?? null,
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
  try {
    return dropLegacySeed(normalizeSnap(JSON.parse(await readFile(FILE, "utf8"))));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    if (isDemoMode()) {
      const demo = buildDemo();
      // Exclusive creation also keeps simultaneous first-page reads consistent.
      await mkdir(path.dirname(FILE), { recursive: true });
      const initial = `${FILE}.${crypto.randomUUID()}.tmp`;
      await writeFile(initial, JSON.stringify(demo, null, 2), "utf8");
      try { await link(initial, FILE); }
      catch (failure) { if ((failure as NodeJS.ErrnoException).code !== "EEXIST") throw failure; }
      finally { await unlink(initial); }
      return normalizeSnap(JSON.parse(await readFile(FILE, "utf8")));
    }
    return allowOptionalSeed() ? normalizeSnap(buildSeed()) : emptySnapshot();
  }
}

async function persist(snap: AppSnapshot) {
  await mkdir(path.dirname(FILE), { recursive: true });
  const temp = `${FILE}.${crypto.randomUUID()}.tmp`;
  await writeFile(temp, JSON.stringify(snap, null, 2), "utf8");
  await replaceFile(temp, FILE);
}

async function commitSnapshot(before: AppSnapshot, after: AppSnapshot) {
  if (hasSupabase()) await commitRemote(before, after);
  else await persist(after);
}

function newId(): string {
  return crypto.randomUUID();
}

function ticketSeq(code: string): number {
  const match = String(code).match(/^CP-(\d+)/i);
  return match ? Number(match[1]) : NaN;
}

function allocateTicketCode(issues: Issue[]): string {
  const nums = issues.map((i) => ticketSeq(i.ticket_code)).filter((n) => Number.isFinite(n));
  const next = Math.max(1000, ...nums, 1000) + 1;
  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 4).toUpperCase();
  return `CP-${next}-${suffix}`;
}

function rowToIssue(row: Record<string, unknown>): Issue {
  return {
    location_id: (row.location_id as string) || null,
    id: String(row.id),
    ticket_code: String(row.ticket_code),
    description: String(row.description),
    category: row.category as Issue["category"],
    severity: row.severity as Issue["severity"],
    department: canonicalDepartment(
      row.department as string,
      String(row.building || ""),
      row.category as string,
    ),
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
    worker_name: (row.worker_name as string) || null,
    escalated_at: (row.escalated_at as string) || null,
    verify_deadline_at: (row.verify_deadline_at as string) || null,
    verified_count: Number(row.verified_count ?? 0),
    disputed_count: Number(row.disputed_count ?? 0),
    verified_at: (row.verified_at as string) || null,
    reopen_count: Number(row.reopen_count ?? 0),
    claim_round: Number(row.claim_round ?? 0),
  };
}

function rowToVerification(row: Record<string, unknown>): Verification {
  return {
    id: String(row.id),
    issue_id: String(row.issue_id),
    cluster_id: String(row.cluster_id),
    client_hash: String(row.client_hash || ""),
    verdict: row.verdict === "broken" ? "broken" : "fixed",
    round: Number(row.round ?? 0),
    photo_url: (row.photo_url as string) || null,
    created_at: String(row.created_at),
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

async function loadSupabase(includeEvidence = true): Promise<AppSnapshot> {
  const sb = supabaseAdmin();
  const { data: state, error: stateError } = await sb.from("campuspulse_state").select("revision").eq("id", 1).single();
  if (stateError) throw stateError;
  const [issueRows, clusterRows, confirmationRows, verificationRows, locations, incidents] = await Promise.all([
    readRows(sb, "issues"), readRows(sb, "issue_clusters"),
    includeEvidence ? readRows(sb, "issue_confirmations") : Promise.resolve([]),
    includeEvidence ? readRows(sb, "issue_verifications") : Promise.resolve([]),
    readRows(sb, "report_locations"), readRows(sb, "campus_incidents"),
  ]);
  const campus = await loadBoundaryFromSupabase();
  if (!campus.tableOk) throw new HttpError("Campus configuration unavailable", 503);
  const campus_boundary = campus.boundary;
  const { data: end, error: endError } = await sb.from("campuspulse_state").select("revision").eq("id", 1).single();
  if (endError) throw endError;
  if (Number(end.revision) !== Number(state.revision)) throw new WriteConflict("Snapshot changed while reading");
  return refreshPriorities(
    dropLegacySeed({
      revision: Number(state.revision),
      locations: locations as unknown as ReportLocation[],
      incidents: incidents as unknown as IncidentRecord[],
      issues: issueRows.map((r) => rowToIssue(r as Record<string, unknown>)),
      clusters: clusterRows.map((r) => rowToCluster(r as Record<string, unknown>)),
      confirmations: confirmationRows.map((r) => ({
        id: String((r as { id: string }).id),
        cluster_id: String((r as { cluster_id: string }).cluster_id),
        client_hash: String((r as { client_hash?: string }).client_hash || ""),
        created_at: String((r as { created_at: string }).created_at),
      })),
      verifications: verificationRows.map((r) => rowToVerification(r as Record<string, unknown>)),
      campus_boundary,
    }),
  );
}

async function loadBoundaryFromSupabase(): Promise<{ boundary: CampusBoundary | null; tableOk: boolean }> {
  try {
    const sb = supabaseAdmin();
    const { data, error } = await sb.from("campus_boundary").select("*").eq("id", "default").maybeSingle();
    if (error) return { boundary: null, tableOk: false };
    if (!data) return { boundary: null, tableOk: true };
    const row = data as { kind?: string; type?: string; vertices?: unknown; updated_at?: string; updated_by?: string | null };
    const vertices = Array.isArray(row.vertices) ? row.vertices : [];
    if (vertices.length < 2) return { boundary: null, tableOk: true };
    return {
      tableOk: true,
      boundary: {
        type: row.kind === "rectangle" || row.type === "rectangle" ? "rectangle" : "polygon",
        vertices: vertices as CampusBoundary["vertices"],
        updated_at: String(row.updated_at || new Date().toISOString()),
        updated_by: row.updated_by ?? null,
      },
    };
  } catch {
    return { boundary: null, tableOk: false };
  }
}

async function loadSnapshotOnce(includeEvidence = true): Promise<AppSnapshot> {
  const snap = hasSupabase() ? await loadSupabase(includeEvidence) : await loadFile();
  return persistEscalations(refreshPriorities(snap));
}

export async function getCampusBoundary(): Promise<CampusBoundary | null> {
  if (hasSupabase()) {
    const result = await loadBoundaryFromSupabase();
    if (!result.tableOk) throw new HttpError("Campus configuration unavailable", 503);
    return result.boundary;
  }
  return (await loadFile()).campus_boundary ?? null;
}

async function saveCampusBoundaryOnce(boundary: CampusBoundary): Promise<CampusBoundary> {
  const snap = await loadSnapshot();
  await commitSnapshot(snap, { ...snap, campus_boundary: boundary });
  return boundary;
}

async function clearCampusBoundaryOnce(): Promise<void> {
  const snap = await loadSnapshot();
  await commitSnapshot(snap, { ...snap, campus_boundary: null });
}

export async function listInventory(): Promise<{ issues: IssueWithCluster[]; clusters: Cluster[] }> {
  const snap = await loadSnapshot(false);
  const cmap = new Map(snap.clusters.map(c => [c.id, c]));
  return {
    issues: snap.issues.map(i => withCluster(i, cmap.get(i.cluster_id))).sort((a,b) => b.priority - a.priority),
    clusters: [...snap.clusters].sort((a,b) => b.priority - a.priority),
  };
}

export async function listIssues() { return (await listInventory()).issues; }
export async function listClusters() { return (await listInventory()).clusters; }

export async function registerLocation(input: Omit<ReportLocation, "id" | "created_at">): Promise<ReportLocation> {
  return mutate(async () => {
    if (!Number.isFinite(input.lat) || !Number.isFinite(input.lng) || Math.abs(input.lat) > 90 || Math.abs(input.lng) > 180) throw new HttpError("Choose a valid map location.", 400);
    const snap = await loadSnapshot();
    assertIssueLocation(input.lat, input.lng, snap.campus_boundary);
    if ((snap.locations ?? []).some(l => l.department === input.department && l.name.toLowerCase() === input.name.toLowerCase())) throw new HttpError("That location name already exists in this department.", 409);
    const location: ReportLocation = { ...input, id: newId(), created_at: new Date().toISOString() };
    await commitSnapshot(snap, { ...snap, locations: [...(snap.locations ?? []), location] });
    return location;
  });
}

export async function decideIncident(id: string, decision: IncidentRecord["decision"], actor: StaffSession): Promise<IncidentRecord> {
  if (actor.role !== "admin") throw new HttpError("Admin login required", 403);
  return mutate(async () => {
    const snap = await loadSnapshot();
    const existing = snap.incidents?.find(i => i.id === id);
    if (existing?.decision === decision) return existing;
    if (existing) throw new HttpError("This suggestion has already been reviewed.", 409);
    const candidate = detectIncidents(snap).find(c => c.id === id);
    if (!candidate) throw new HttpError("Reports changed. Refresh the suggestions before reviewing.", 409);
    const record: IncidentRecord = { id, kind: candidate.kind, title: candidate.title, place: candidate.place, issue_ids: candidate.issue_ids, decision, created_at: new Date().toISOString(), decided_by: actor.email };
    await commitSnapshot(snap, { ...snap, incidents: [...(snap.incidents ?? []), record] });
    return record;
  });
}

async function remoteTicket(column: "id" | "ticket_code", value: string) {
  const sb = supabaseAdmin();
  const { data, error } = await sb.from("issues").select("*").eq(column, value).maybeSingle();
  if (error) throw error;
  if (!data || (!allowOptionalSeed() && (isLegacySeedId(data.id) || isLegacySeedId(data.cluster_id)))) return null;
  const issue = rowToIssue(data);
  const { data: cluster, error: cError } = await sb.from("issue_clusters").select("*").eq("id", issue.cluster_id).single();
  if (cError) throw cError;
  return withCluster(issue, rowToCluster(cluster));
}

export async function getIssueByCode(code: string): Promise<IssueWithCluster | null> {
  if (hasSupabase()) return remoteTicket("ticket_code", code.toUpperCase());
  const snap = await loadSnapshot();
  const issue = snap.issues.find((i) => i.ticket_code.toLowerCase() === code.toLowerCase());
  if (!issue) return null;
  return withCluster(issue, snap.clusters.find((c) => c.id === issue.cluster_id));
}

export function clusterSiblings(snap: AppSnapshot, clusterId: string): Issue[] {
  return snap.issues
    .filter((i) => i.cluster_id === clusterId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function getPublicTicket(code: string): Promise<{
  issue: IssueWithCluster;
  siblings: Issue[];
} | null> {
  if (hasSupabase()) {
    const issue = await remoteTicket("ticket_code", code.toUpperCase());
    if (!issue) return null;
    const siblings = (await readRows(supabaseAdmin(), "issues", ["cluster_id", issue.cluster_id]))
      .map(rowToIssue).filter(i => allowOptionalSeed() || !isLegacySeedId(i.id))
      .sort((a,b) => a.created_at.localeCompare(b.created_at));
    return { issue, siblings };
  }

  const snap = await loadSnapshot();
  const issue = snap.issues.find((i) => i.ticket_code.toLowerCase() === code.toLowerCase());
  if (!issue) return null;
  return {
    issue: withCluster(issue, snap.clusters.find((c) => c.id === issue.cluster_id)),
    siblings: clusterSiblings(snap, issue.cluster_id),
  };
}

export async function getIssueById(id: string): Promise<IssueWithCluster | null> {
  if (hasSupabase()) return remoteTicket("id", id);
  const snap = await loadSnapshot();
  const issue = snap.issues.find((i) => i.id === id);
  if (!issue) return null;
  return withCluster(issue, snap.clusters.find((c) => c.id === issue.cluster_id));
}

export interface CreateIssueInput {
  location_id?: string | null;
  description: string;
  lat: number;
  lng: number;
  building?: string;
  photo_url?: string | null;
  forceNew?: boolean;
  mergeClusterId?: string;
}

async function createIssueOnce(input: CreateIssueInput) {
  if (typeof input.lat !== "number" || typeof input.lng !== "number" || !Number.isFinite(input.lat) || !Number.isFinite(input.lng)) {
    throw new HttpError("Drop a pin using your GPS or the map.", 400, "NO_PIN");
  }
  input = { ...input, photo_url: await validatePhoto(input.photo_url, "report") };
  const snap = await loadSnapshot();
  if (input.location_id) {
    const location = snap.locations?.find(l => l.id === input.location_id);
    if (!location) throw new HttpError("This QR location is no longer available. Choose a location manually.", 400);
    input = { ...input, lat: location.lat, lng: location.lng, building: `${location.department}, ${location.name}` };
  }
  assertIssueLocation(input.lat, input.lng, snap.campus_boundary);
  const building = input.building?.trim() || GENERIC_PLACE.name;
  const photoNote = await describeReportPhoto(input.photo_url);
  const classifyText = photoNote ? `${input.description}\n\n[Photo: ${photoNote}]` : input.description;
  const classified = await classifyReport(classifyText, building);
  const embedding = tokenEmbedding(input.description);

  if (!input.forceNew) {
    const matches = findMergeTarget(snap.clusters, snap.issues, input.lat, input.lng, input.description, embedding, input);
    if (input.mergeClusterId && matches?.cluster.id !== input.mergeClusterId) throw new HttpError("That report does not match this location and problem.", 400);
    const chosen = matches?.cluster;
    if (chosen) {
      return addReportToCluster(snap, chosen.id, {
        location_id: input.location_id,
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
  const location_weight = locationWeightFor(classified.building || building, {
    category: classified.category,
    description: input.description,
  });
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
    location_id: input.location_id ?? null,
    ticket_code: allocateTicketCode(snap.issues),
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
    worker_name: null,
    escalated_at: null,
    verify_deadline_at: null,
    verified_count: 0,
    disputed_count: 0,
    verified_at: null,
    reopen_count: 0,
    claim_round: 0,
  };

  await commitSnapshot(snap, refreshPriorities({
    ...snap, issues: [issue, ...snap.issues], clusters: [cluster, ...snap.clusters],
  }));

  const saved = await getIssueById(issueId);
  return { issue: saved, classified, merged: false };
}

async function addReportToCluster(
  snap: AppSnapshot,
  clusterId: string,
  extra: {
    location_id?: string | null;
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
  const location_weight = locationWeightFor(extra.building, {
    category: extra.classified.category,
    description: extra.description,
  });
  const issue: Issue = {
    id: newId(),
    location_id: extra.location_id ?? null,
    ticket_code: allocateTicketCode(snap.issues),
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
    worker_name: null,
    escalated_at: null,
    verify_deadline_at: null,
    verified_count: 0,
    disputed_count: 0,
    verified_at: null,
    reopen_count: 0,
    claim_round: 0,
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

  await commitSnapshot(snap, refreshPriorities({
    ...snap, issues: [issue, ...snap.issues],
    clusters: snap.clusters.map(c => c.id === clusterId ? updated : c),
  }));
  return { issue: await getIssueById(issue.id), classified: extra.classified, merged: true };
}

function titleFrom(description: string, category: string, building: string): string {
  const clean = description.replace(/\s+/g, " ").trim();
  if (clean.length <= 56) return clean;
  return `${building} ${category}`.replace(/\s+/g, " ");
}

async function meTooOnce(clusterId: string, clientHash: string) {
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
    locationWeight: locationWeightFor(updated.building, {
      category: updated.category,
      description: snap.issues.find((i) => i.cluster_id === clusterId)?.description,
    }),
  });

  await commitSnapshot(snap, refreshPriorities({
    ...snap, clusters: snap.clusters.map(c => c.id === clusterId ? updated : c),
    confirmations: [...snap.confirmations, confirmation],
  }));
  const fresh = (await loadSnapshot()).clusters.find((c) => c.id === clusterId)!;
  return { ok: true as const, cluster: fresh };
}

async function updateIssueOnce(
  id: string,
  patch: {
    status?: Status;
    eta_at?: string | null;
    resolve_photo_url?: string | null;
    department?: Issue["department"];
    worker_name?: string | null;
  },
  actor?: StaffSession,
) {
  const snap = await loadSnapshot();
  const issue = snap.issues.find((i) => i.id === id);
  if (!issue) return null;
  if (actor && departmentForbidden(actor, issue)) throw new HttpError("This issue is assigned to another department", 403);
  const now = new Date().toISOString();
  if (patch.department) {
    patch = { ...patch, department: canonicalDepartment(patch.department, issue.building, issue.category) };
  }
  patch = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
  if (patch.resolve_photo_url != null) patch.resolve_photo_url = await validatePhoto(patch.resolve_photo_url, "resolve");
  const next: Issue = { ...issue, ...patch };
  if (patch.status === "assigned" || patch.status === "on_it") {
    if (!next.assigned_at) next.assigned_at = now;
  }
  if (patch.status === "assigned") {
    if (patch.worker_name === undefined) next.worker_name = null;
    next.eta_at = null;
  }
  if (patch.eta_at && (patch.status === "on_it" || next.status === "on_it") && patch.status !== "assigned") {
    next.eta_at = patch.eta_at;
  }
  if (patch.status === "resolved" && issue.status !== "resolved") {
    next.resolved_at = now;
    if (patch.resolve_photo_url !== undefined) next.resolve_photo_url = patch.resolve_photo_url;
    // Closing a ticket is a claim, not a fact. Students get the window to accept or reject it.
    next.verify_deadline_at = verifyDeadlineFrom(now);
    next.verified_at = null;
    next.verified_count = 0;
    next.disputed_count = 0;
  } else if (patch.status && patch.status !== "resolved" && issue.status === "resolved") {
    // Staff walked their own closure back, so the old claim stops counting.
    next.resolved_at = null;
    next.verify_deadline_at = null;
    next.verified_at = null;
    next.verified_count = 0;
    next.disputed_count = 0;
    next.claim_round = issue.claim_round + 1;
  }

  const clusters = patch.status ? clustersAfterIssue(snap, id, next) : snap.clusters;

  await commitSnapshot(snap, refreshPriorities({
    ...snap, issues: snap.issues.map(i => i.id === id ? next : i), clusters,
  }));
  return getIssueById(id);
}

/** A cluster stays open while any member is open, so one fixed report cannot close the job. */
function clustersAfterIssue(snap: AppSnapshot, id: string, next: Issue): Cluster[] {
  const cluster = snap.clusters.find((c) => c.id === next.cluster_id);
  if (!cluster) return snap.clusters;
  const siblings = snap.issues.filter((i) => i.cluster_id === cluster.id && i.id !== id);
  const anyOpen = [next, ...siblings].some((i) => i.status !== "resolved");
  const updated: Cluster = {
    ...cluster,
    status: anyOpen ? (next.status === "resolved" ? cluster.status : next.status) : "resolved",
    severity: next.severity,
  };
  if (next.status !== "resolved") updated.status = next.status;
  if (next.status === "resolved" && !anyOpen) updated.status = "resolved";
  return snap.clusters.map((c) => (c.id === cluster.id ? updated : c));
}

export type VerificationOutcome =
  | { ok: true; reopened: boolean; state: "awaiting" | "verified" | "reopened"; issue: IssueWithCluster }
  | { ok: false; error: string; already?: boolean; status: number };

/**
 * Record one anonymous check of a fix claim.
 * Enough confirmations settle it as verified; enough dispute weight sends the job back
 * to the department with the round bumped so the next claim is checked fresh.
 */
async function recordVerificationOnce(
  issueId: string,
  clientHash: string,
  verdict: Verdict,
  photoUrl?: string | null,
): Promise<VerificationOutcome> {
  const snap = await loadSnapshot();
  const issue = snap.issues.find((i) => i.id === issueId);
  if (!issue) return { ok: false, error: "Ticket not found", status: 404 };

  const nowMs = Date.now();
  const state = proofState(issue, nowMs);
  if (state !== "awaiting") {
    const error =
      state === "verified"
        ? "This fix is already confirmed."
        : state === "unconfirmed"
          ? "The check window for this fix has closed."
          : "This ticket is not waiting for a check right now.";
    return { ok: false, error, status: 409 };
  }
  if (alreadyChecked(snap.verifications, issueId, issue.claim_round, clientHash)) {
    return { ok: false, error: "You already checked this fix from this browser.", already: true, status: 409 };
  }

  const now = new Date().toISOString();
  const photo_url = verdict === "broken" ? await validatePhoto(photoUrl, "report") : null;
  const verification: Verification = {
    id: newId(),
    issue_id: issueId,
    cluster_id: issue.cluster_id,
    client_hash: clientHash,
    verdict,
    round: issue.claim_round,
    photo_url,
    created_at: now,
  };

  const weight =
    disputeWeightFor(snap.verifications, issueId, issue.claim_round) +
    (verdict === "broken" ? disputeWeight(Boolean(photo_url)) : 0);
  const reopened = verdict === "broken" && weight >= DISPUTE_WEIGHT_TO_REOPEN;

  let next: Issue;
  if (reopened) {
    next = {
      ...issue,
      // Back to the department that claimed it, not to the unassigned pile.
      status: "assigned",
      resolved_at: null,
      eta_at: null,
      worker_name: null,
      verify_deadline_at: null,
      verified_at: null,
      verified_count: 0,
      disputed_count: 0,
      reopen_count: issue.reopen_count + 1,
      claim_round: issue.claim_round + 1,
    };
  } else {
    const verified_count = issue.verified_count + (verdict === "fixed" ? 1 : 0);
    const disputed_count = issue.disputed_count + (verdict === "broken" ? 1 : 0);
    next = {
      ...issue,
      verified_count,
      disputed_count,
      verified_at:
        issue.verified_at || (verified_count >= CONFIRMATIONS_TO_VERIFY ? now : null),
    };
  }

  const clusters = reopened ? clustersAfterIssue(snap, issueId, next) : snap.clusters;

  await commitSnapshot(snap, refreshPriorities({
    ...snap, issues: snap.issues.map(i => i.id === issueId ? next : i),
    clusters, verifications: [...snap.verifications, verification],
  }));

  const saved = await getIssueById(issueId);
  if (!saved) return { ok: false, error: "Ticket not found", status: 404 };
  return {
    ok: true,
    reopened,
    state: reopened ? "reopened" : proofState(saved, Date.now()) === "verified" ? "verified" : "awaiting",
    issue: saved,
  };
}

export async function listVerifications(issueId: string): Promise<Verification[]> {
  if (hasSupabase()) return (await readRows(supabaseAdmin(), "issue_verifications", ["issue_id", issueId]))
    .map(rowToVerification).sort((a,b) => a.created_at.localeCompare(b.created_at));
  const snap = await loadSnapshot();
  return snap.verifications
    .filter((v) => v.issue_id === issueId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

async function persistEscalations(snap: AppSnapshot): Promise<AppSnapshot> {
  const now = Date.now();
  const iso = new Date().toISOString();
  const newly: Issue[] = [];
  const issues = snap.issues.map((i) => {
    if (!i.escalated_at && isOverdue(i, now)) {
      const next = { ...i, escalated_at: iso };
      newly.push(next);
      return next;
    }
    return i;
  });
  if (!newly.length) return snap;
  const next = { ...snap, issues };
  await commitSnapshot(snap, next);
  for (const i of newly) {
    try {
      await appendAudit({
        actor_email: "system",
        actor_role: "unknown",
        action: "issue.auto_escalate",
        target: i.ticket_code,
        detail: "Open more than 72 hours — flagged for follow-up.",
      });
    } catch {
      // Reads must not fail because the activity log is down.
    }
  }
  return refreshPriorities(next);
}


export function loadSnapshot(...args: Parameters<typeof loadSnapshotOnce>): ReturnType<typeof loadSnapshotOnce> {
  return mutate(() => loadSnapshotOnce(...args));
}

export function saveCampusBoundary(...args: Parameters<typeof saveCampusBoundaryOnce>): ReturnType<typeof saveCampusBoundaryOnce> {
  return mutate(() => saveCampusBoundaryOnce(...args));
}

export function clearCampusBoundary(...args: Parameters<typeof clearCampusBoundaryOnce>): ReturnType<typeof clearCampusBoundaryOnce> {
  return mutate(() => clearCampusBoundaryOnce(...args));
}

export function createIssue(...args: Parameters<typeof createIssueOnce>): ReturnType<typeof createIssueOnce> {
  return mutate(() => createIssueOnce(...args));
}

export function meToo(...args: Parameters<typeof meTooOnce>): ReturnType<typeof meTooOnce> {
  return mutate(() => meTooOnce(...args));
}

export function updateIssue(...args: Parameters<typeof updateIssueOnce>): ReturnType<typeof updateIssueOnce> {
  return mutate(() => updateIssueOnce(...args));
}

export function recordVerification(...args: Parameters<typeof recordVerificationOnce>): ReturnType<typeof recordVerificationOnce> {
  return mutate(() => recordVerificationOnce(...args));
}
