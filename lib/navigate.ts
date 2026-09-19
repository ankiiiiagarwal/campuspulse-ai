import { haversineMeters } from "./duplicates";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface DriveRoute {
  points: LatLng[];
  meters: number;
  seconds: number | null;
}

export function formatMeters(meters: number): string {
  if (!Number.isFinite(meters)) return "—";
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(meters < 10000 ? 1 : 0)} km`;
}

export function formatDriveTime(seconds: number | null | undefined): string | null {
  if (seconds == null || !Number.isFinite(seconds)) return null;
  const min = Math.max(1, Math.round(seconds / 60));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** Turn-by-turn in the device maps app. Origin is omitted if GPS is not ready yet. */
export function mapsDirectionsUrl(from: LatLng | null, to: LatLng): string {
  const destination = `${to.lat},${to.lng}`;
  const origin = from ? `&origin=${from.lat},${from.lng}` : "";
  return `https://www.google.com/maps/dir/?api=1${origin}&destination=${destination}&travelmode=driving`;
}

export function openDirections(from: LatLng | null, to: LatLng): void {
  window.open(mapsDirectionsUrl(from, to), "_blank", "noopener,noreferrer");
}

/** Driving line from the public OSRM demo. Falls back to a straight line if the call fails. */
export async function driveRoute(from: LatLng, to: LatLng): Promise<DriveRoute> {
  const straight = haversineMeters(from, to);
  const fallback: DriveRoute = { points: [from, to], meters: straight, seconds: null };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return fallback;
    const data = (await res.json()) as {
      routes?: Array<{ distance?: number; duration?: number; geometry?: { coordinates?: [number, number][] } }>;
    };
    const route = data.routes?.[0];
    const coords = route?.geometry?.coordinates;
    if (!coords?.length) return fallback;
    return {
      points: coords.map(([lng, lat]) => ({ lat, lng })),
      meters: Number.isFinite(route?.distance) ? Number(route?.distance) : straight,
      seconds: Number.isFinite(route?.duration) ? Number(route?.duration) : null,
    };
  } catch {
    return fallback;
  } finally {
    clearTimeout(timer);
  }
}
