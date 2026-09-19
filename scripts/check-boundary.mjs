/** Offline checks for campus geofence helpers (mirrors lib/geo.ts). */
function boundsFromRing(ring) {
  const lats = ring.map((v) => v.lat);
  const lngs = ring.map((v) => v.lng);
  return { south: Math.min(...lats), west: Math.min(...lngs), north: Math.max(...lats), east: Math.max(...lngs) };
}
function rectangleRing(vertices) {
  const b = boundsFromRing(vertices);
  return [
    { lat: b.south, lng: b.west },
    { lat: b.south, lng: b.east },
    { lat: b.north, lng: b.east },
    { lat: b.north, lng: b.west },
  ];
}
function dropClosingDuplicate(verts) {
  if (verts.length < 2) return verts;
  const first = verts[0];
  const last = verts[verts.length - 1];
  if (first.lat === last.lat && first.lng === last.lng) return verts.slice(0, -1);
  return verts;
}
function pointOnSegment(p, a, b) {
  const cross = (p.lat - a.lat) * (b.lng - a.lng) - (p.lng - a.lng) * (b.lat - a.lat);
  if (Math.abs(cross) > 1e-12) return false;
  const dot = (p.lat - a.lat) * (b.lat - a.lat) + (p.lng - a.lng) * (b.lng - a.lng);
  if (dot < 0) return false;
  const len2 = (b.lat - a.lat) ** 2 + (b.lng - a.lng) ** 2;
  return dot <= len2 + 1e-12;
}
function pointInPolygon(point, ring) {
  const verts = dropClosingDuplicate(ring);
  if (verts.length < 3) return false;
  for (let i = 0; i < verts.length; i++) {
    if (pointOnSegment(point, verts[i], verts[(i + 1) % verts.length])) return true;
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
function pointInBoundary(point, boundary) {
  if (!boundary) return false;
  if (boundary.type === "rectangle") {
    const b = boundsFromRing(rectangleRing(boundary.vertices));
    return point.lat >= b.south && point.lat <= b.north && point.lng >= b.west && point.lng <= b.east;
  }
  return pointInPolygon(point, boundary.vertices);
}

const box = { type: "rectangle", vertices: [{ lat: 28.6, lng: 77.0 }, { lat: 28.61, lng: 77.02 }] };
const poly = {
  type: "polygon",
  vertices: [
    { lat: 12.97, lng: 77.59 },
    { lat: 12.97, lng: 77.6 },
    { lat: 12.98, lng: 77.6 },
    { lat: 12.98, lng: 77.59 },
  ],
};

const cases = [
  ["rect inside", pointInBoundary({ lat: 28.605, lng: 77.01 }, box), true],
  ["rect edge", pointInBoundary({ lat: 28.6, lng: 77.01 }, box), true],
  ["rect outside", pointInBoundary({ lat: 28.7, lng: 77.01 }, box), false],
  ["poly inside", pointInBoundary({ lat: 12.975, lng: 77.595 }, poly), true],
  ["poly outside", pointInBoundary({ lat: 13.0, lng: 77.7 }, poly), false],
  ["no boundary", pointInBoundary({ lat: 28.605, lng: 77.01 }, null), false],
];

let failed = 0;
for (const [name, got, want] of cases) {
  const ok = got === want;
  console.log(`${ok ? "ok" : "FAIL"} ${name}: ${got}`);
  if (!ok) failed += 1;
}
if (failed) {
  process.exitCode = 1;
} else {
  console.log("boundary checks passed");
}
