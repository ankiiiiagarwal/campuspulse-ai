export type StaffDeskKind = "admin" | "department";

export function staffDeskHeaders(desk: StaffDeskKind, extra?: HeadersInit): HeadersInit {
  return { "X-CP-Desk": desk, ...(extra || {}) };
}

export type GpsFix = { lat: number; lng: number; accuracy: number };

export type BrowserLocation =
  | ({ ok: true } & GpsFix)
  | { ok: false; reason: "denied" | "unavailable" | "timeout" | "unsupported" };

export function gpsFailureMessage(reason: Extract<BrowserLocation, { ok: false }>["reason"]): string {
  if (reason === "denied") return "Location permission denied. Allow GPS in the browser, then recalibrate.";
  if (reason === "unsupported") return "This browser cannot share GPS.";
  if (reason === "timeout") return "GPS timed out. Step outside or nearer a window, then recalibrate.";
  return "Could not read GPS. Try recalibrate again.";
}

function failReason(err: GeolocationPositionError): Extract<BrowserLocation, { ok: false }>["reason"] {
  if (err.code === 1) return "denied";
  if (err.code === 3) return "timeout";
  return "unavailable";
}

export function requestBrowserLocation(options?: PositionOptions): Promise<BrowserLocation> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.resolve({ ok: false, reason: "unsupported" });
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          ok: true,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      (err) => resolve({ ok: false, reason: failReason(err) }),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0, ...options },
    );
  });
}

/** Live GPS. Field staff can be anywhere — this is not limited to the campus fence. */
export function watchBrowserLocation(
  onFix: (fix: GpsFix) => void,
  onFail?: (reason: Extract<BrowserLocation, { ok: false }>["reason"]) => void,
): () => void {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    onFail?.("unsupported");
    return () => {};
  }
  const id = navigator.geolocation.watchPosition(
    (pos) =>
      onFix({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      }),
    (err) => onFail?.(failReason(err)),
    { enableHighAccuracy: true, timeout: 20000, maximumAge: 4000 },
  );
  return () => navigator.geolocation.clearWatch(id);
}

export function getClientHash(): string {
  const key = "cp_client_hash";
  let value = localStorage.getItem(key);
  if (!value) {
    value = crypto.randomUUID();
    localStorage.setItem(key, value);
  }
  return value;
}

export async function stripExif(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  const max = 1600;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not read photo");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.82);
}

export function formatHours(hours: number | null | undefined): string {
  if (hours == null || Number.isNaN(hours)) return "—";
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 48) return `${hours.toFixed(1)} h`;
  return `${(hours / 24).toFixed(1)} d`;
}

export function formatDateTime(iso: string, locale?: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(locale || undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ageLabel(iso: string): string {
  return formatDateTime(iso);
}

export function statusLabel(status: string): string {
  if (status === "on_it") return "On it";
  if (status === "assigned") return "Assigned";
  if (status === "resolved") return "Resolved";
  return "Open";
}

export function reportCoordinates(search: Pick<URLSearchParams, "get">): { lat: number; lng: number } | null {
  const latText = search.get("lat"), lngText = search.get("lng");
  if (!latText?.trim() || !lngText?.trim()) return null;
  const lat = Number(latText), lng = Number(lngText);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}
