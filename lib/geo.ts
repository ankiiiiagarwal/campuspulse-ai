import type { CampusBoundary, GeoPoint } from "./types";

export const INDIA_VIEW = {
  lat: 20.5937,
  lng: 78.9629,
  zoom: 5,
};

export const NO_BOUNDARY_MESSAGE =
  "No campus area is set. Pins can be placed anywhere until an admin saves one.";

export const OUTSIDE_BOUNDARY_MESSAGE =
  "That pin is outside the campus area. Move it inside the campus boundary to submit this issue.";

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status = 400, code = "BAD_REQUEST") {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
  }
}

export function emptySnapshotBoundary(): CampusBoundary | null {
  return null;
}

export function parseVertices(raw: unknown): GeoPoint[] | null {
  if (!Array.isArray(raw) || raw.length < 2) return null;
  const verts: GeoPoint[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const lat = Number((item as GeoPoint).lat);
    const lng = Number((item as GeoPoint).lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    verts.push({ lat, lng });
  }
  return verts;
}

export function dropClosingDuplicate(verts: GeoPoint[]): GeoPoint[] {
  if (verts.length < 2) return verts;
  const first = verts[0];
  const last = verts[verts.length - 1];
  if (first.lat === last.lat && first.lng === last.lng) return verts.slice(0, -1);
  return verts;
}

export function boundsFromRing(ring: GeoPoint[]): { south: number; west: number; north: number; east: number } {
  const lats = ring.map((v) => v.lat);
  const lngs = ring.map((v) => v.lng);
  return {
    south: Math.min(...lats),
    west: Math.min(...lngs),
    north: Math.max(...lats),
    east: Math.max(...lngs),
  };
}

export function rectangleRing(vertices: GeoPoint[]): GeoPoint[] {
  const b = boundsFromRing(vertices);
  return [
    { lat: b.south, lng: b.west },
    { lat: b.south, lng: b.east },
    { lat: b.north, lng: b.east },
    { lat: b.north, lng: b.west },
  ];
}

export function boundaryRing(boundary: CampusBoundary): GeoPoint[] {
  if (boundary.type === "rectangle") return rectangleRing(boundary.vertices);
  return dropClosingDuplicate(boundary.vertices);
}

export function leafletBounds(boundary: CampusBoundary): [[number, number], [number, number]] {
  const b = boundsFromRing(boundaryRing(boundary));
  return [
    [b.south, b.west],
    [b.north, b.east],
  ];
}

/**
 * The tight group of pins that should frame the camera.
 * One report dropped on a far GPS fix must not zoom the campus map out to the whole country.
 */
export function focusPoints(points: GeoPoint[], maxSpanDeg = 0.08): GeoPoint[] {
  if (points.length <= 1) return points;
  const lats = points.map((p) => p.lat).sort((a, b) => a - b);
  const lngs = points.map((p) => p.lng).sort((a, b) => a - b);
  const mid = Math.floor(points.length / 2);
  const center = { lat: lats[mid], lng: lngs[mid] };
  const nearby = points.filter(
    (p) => Math.abs(p.lat - center.lat) <= maxSpanDeg && Math.abs(p.lng - center.lng) <= maxSpanDeg,
  );
  return nearby.length > 0 ? nearby : [center];
}

function pointOnSegment(p: GeoPoint, a: GeoPoint, b: GeoPoint): boolean {
  const cross = (p.lat - a.lat) * (b.lng - a.lng) - (p.lng - a.lng) * (b.lat - a.lat);
  if (Math.abs(cross) > 1e-12) return false;
  const dot = (p.lat - a.lat) * (b.lat - a.lat) + (p.lng - a.lng) * (b.lng - a.lng);
  if (dot < 0) return false;
  const len2 = (b.lat - a.lat) ** 2 + (b.lng - a.lng) ** 2;
  return dot <= len2 + 1e-12;
}

export function pointInPolygon(point: GeoPoint, ring: GeoPoint[]): boolean {
  const verts = dropClosingDuplicate(ring);
  if (verts.length < 3) return false;
  for (let i = 0; i < verts.length; i++) {
    const a = verts[i];
    const b = verts[(i + 1) % verts.length];
    if (pointOnSegment(point, a, b)) return true;
  }
  let inside = false;
  for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
    const yi = verts[i].lat;
    const yj = verts[j].lat;
    const xi = verts[i].lng;
    const xj = verts[j].lng;
    const denom = yj - yi || Number.EPSILON;
    const intersect = yi > point.lat !== yj > point.lat && point.lng < ((xj - xi) * (point.lat - yi)) / denom + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function pointInBoundary(point: GeoPoint, boundary: CampusBoundary | null | undefined): boolean {
  if (!boundary || !Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return false;
  if (boundary.type === "rectangle") {
    const b = boundsFromRing(rectangleRing(boundary.vertices));
    return point.lat >= b.south && point.lat <= b.north && point.lng >= b.west && point.lng <= b.east;
  }
  return pointInPolygon(point, boundary.vertices);
}

export function normalizeBoundary(input: {
  type?: string;
  vertices?: unknown;
  updated_by?: string | null;
}): { ok: true; boundary: CampusBoundary } | { ok: false; error: string } {
  const type = input.type === "rectangle" ? "rectangle" : input.type === "polygon" ? "polygon" : null;
  if (!type) return { ok: false, error: "Choose a polygon or a rectangle campus area." };
  const parsed = parseVertices(input.vertices);
  if (!parsed) return { ok: false, error: "Draw the campus area on the map first." };
  if (type === "rectangle" && parsed.length < 2) {
    return { ok: false, error: "Click two opposite corners to set the campus box." };
  }
  if (type === "polygon" && dropClosingDuplicate(parsed).length < 3) {
    return { ok: false, error: "A campus polygon needs at least three corners." };
  }
  const ring = type === "rectangle" ? rectangleRing(parsed) : dropClosingDuplicate(parsed);
  const bounds = boundsFromRing(ring);
  if (bounds.north - bounds.south < 1e-6 && bounds.east - bounds.west < 1e-6) {
    return { ok: false, error: "The campus area is too small. Draw a larger shape." };
  }
  const vertices =
    type === "rectangle"
      ? [
          { lat: bounds.south, lng: bounds.west },
          { lat: bounds.north, lng: bounds.east },
        ]
      : ring;
  return {
    ok: true,
    boundary: {
      type,
      vertices,
      updated_at: new Date().toISOString(),
      updated_by: input.updated_by ?? null,
    },
  };
}

export function assertIssueLocation(lat: number, lng: number, boundary: CampusBoundary | null | undefined): void {
  if (!boundary) return;
  if (!pointInBoundary({ lat, lng }, boundary)) {
    throw new HttpError(OUTSIDE_BOUNDARY_MESSAGE, 400, "OUTSIDE_BOUNDARY");
  }
}
