import type { Cluster, Issue } from "./types";

const EARTH_M = 6371000;
export const MERGE_RADIUS_M = 40;
export const TEXT_JACCARD_MIN = 0.28;
export const TEXT_OVERLAP_MIN = 0.45;

export function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

const STOP = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "is",
  "in",
  "on",
  "at",
  "to",
  "of",
  "for",
  "it",
  "this",
  "that",
  "with",
  "not",
  "no",
  "are",
  "was",
  "be",
  "very",
  "just",
  "from",
]);

export function tokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .map((w) => w.replace(/-/g, ""))
      .filter((w) => w.length > 2 && !STOP.has(w)),
  );
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size && !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

export function overlapCoeff(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  return inter / Math.min(a.size, b.size);
}

/** Tiny hashed bag-of-words vector so we can store an "embedding" without MiniLM. */
export function tokenEmbedding(text: string, dims = 64): number[] {
  const vec = new Array<number>(dims).fill(0);
  const ts = tokens(text);
  for (const t of ts) {
    let h = 2166136261;
    for (let i = 0; i < t.length; i++) {
      h ^= t.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    const idx = Math.abs(h) % dims;
    vec[idx] += 1;
  }
  const norm = Math.sqrt(vec.reduce((s, x) => s + x * x, 0)) || 1;
  return vec.map((x) => x / norm);
}

export function cosine(a: number[] | null | undefined, b: number[] | null | undefined): number {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const d = Math.sqrt(na) * Math.sqrt(nb);
  return d === 0 ? 0 : dot / d;
}

export function textSimilar(a: string, b: string, embedA?: number[] | null, embedB?: number[] | null): boolean {
  const ta = tokens(a);
  const tb = tokens(b);
  if (jaccard(ta, tb) >= TEXT_JACCARD_MIN) return true;
  if (overlapCoeff(ta, tb) >= TEXT_OVERLAP_MIN) return true;
  if (embedA && embedB && cosine(embedA, embedB) >= 0.78) return true;
  const shared = [...ta].filter((t) => tb.has(t));
  const strong = ["wifi", "internet", "router", "leak", "light", "dark", "washroom", "chair", "path"];
  if (shared.some((t) => strong.includes(t)) && shared.length >= 1 && (ta.has("wifi") || tb.has("wifi") ? true : shared.length >= 2)) {
    if (shared.includes("wifi") || shared.includes("internet") || shared.includes("router")) return true;
  }
  return false;
}

export interface NearbyMatch {
  cluster: Cluster;
  issue: Issue;
  meters: number;
}

export function findNearby(
  clusters: Cluster[],
  issues: Issue[],
  lat: number,
  lng: number,
  text: string,
  embedding?: number[] | null,
): NearbyMatch[] {
  const openClusters = clusters.filter((c) => c.status !== "resolved");
  const matches: NearbyMatch[] = [];
  for (const cluster of openClusters) {
    const meters = haversineMeters({ lat, lng }, cluster);
    if (meters > MERGE_RADIUS_M * 2.2 && meters > 90) continue;
    const members = issues.filter((i) => i.cluster_id === cluster.id);
    const lead = members.find((i) => i.status !== "resolved") ?? members[0];
    if (!lead) continue;
    const close = meters <= MERGE_RADIUS_M;
    const nearby = meters <= 90;
    const similar = textSimilar(text, `${cluster.title} ${lead.description}`, embedding, lead.embedding);
    const sameBuilding = cluster.building && text.toLowerCase().includes(cluster.building.toLowerCase());
    if ((close && similar) || (nearby && similar) || (close && sameBuilding && similar)) {
      matches.push({ cluster, issue: lead, meters: Math.round(meters) });
    }
  }
  return matches.sort((a, b) => a.meters - b.meters);
}

export function findMergeTarget(
  clusters: Cluster[],
  issues: Issue[],
  lat: number,
  lng: number,
  text: string,
  embedding?: number[] | null,
): NearbyMatch | null {
  const hits = findNearby(clusters, issues, lat, lng, text, embedding).filter((m) => m.meters <= MERGE_RADIUS_M + 8);
  return hits[0] ?? null;
}
