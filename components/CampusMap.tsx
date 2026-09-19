"use client";

import { PIN_COLORS, pinKind, type PinKind } from "@/lib/campus";
import { statusLabel } from "@/lib/client";
import { boundaryRing, focusPoints, INDIA_VIEW, leafletBounds, pointInBoundary } from "@/lib/geo";
import type { CampusBoundary, ProofState } from "@/lib/types";
import { useEffect, useRef, useState } from "react";

export interface MapCluster {
  id: string;
  title: string;
  building: string;
  category: string;
  status: string;
  severity: string;
  lat: number;
  lng: number;
  report_count: number;
  me_too_count: number;
  ticket_code?: string;
  issue_id?: string;
  is_recurring?: boolean;
  expected_by?: string;
  proof?: ProofState;
}

interface Props {
  clusters: MapCluster[];
  pick?: { lat: number; lng: number } | null;
  onPick?: (lat: number, lng: number) => void;
  onMeToo?: (cluster: MapCluster) => void;
  interactivePick?: boolean;
  focusId?: string | null;
  boundary?: CampusBoundary | null;
  userLocation?: { lat: number; lng: number } | null;
  constrainPick?: boolean;
  onOutsidePick?: () => void;
  banner?: string | null;
  /** Bump token to fly the camera to this GPS fix, even if a campus fence is on screen. */
  recenter?: { token: number; lat: number; lng: number } | null;
  /** Driving line from the fixer to the job pin. */
  route?: { lat: number; lng: number }[] | null;
  onGo?: (cluster: MapCluster) => void;
  youLabel?: string;
  selectedId?: string | null;
  /** Field staff can be off campus. Do not snap the camera back to the fence. */
  tracker?: boolean;
  /** Soft density blobs under the pins. */
  heat?: boolean;
  /** Hide everything outside the admin-drawn campus area. */
  lockToCampus?: boolean;
  heightClass?: string;
}

export function CampusMap({
  clusters,
  pick,
  onPick,
  onMeToo,
  interactivePick,
  focusId,
  boundary,
  userLocation,
  constrainPick,
  onOutsidePick,
  banner,
  recenter,
  route,
  onGo,
  youLabel = "Your GPS",
  selectedId,
  tracker,
  heat,
  lockToCampus,
  heightClass,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const layerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const fenceRef = useRef<import("leaflet").Polygon | null>(null);
  const youRef = useRef<import("leaflet").CircleMarker | null>(null);
  const pickRef = useRef<import("leaflet").Marker | null>(null);
  const routeRef = useRef<import("leaflet").Polyline | null>(null);
  const heatRef = useRef<import("leaflet").LayerGroup | null>(null);
  const heatEnabledRef = useRef(Boolean(heat));
  const lockRef = useRef(Boolean(lockToCampus));
  const clustersRef = useRef(clusters);
  const maskRef = useRef<import("leaflet").Polygon | null>(null);
  heatEnabledRef.current = Boolean(heat);
  lockRef.current = Boolean(lockToCampus);
  clustersRef.current = clusters;
  const [mapTick, setMapTick] = useState(0);
  const [mapError, setMapError] = useState(false);
  const lastGoodPick = useRef<{ lat: number; lng: number } | null>(null);
  const onPickRef = useRef(onPick);
  const onMeTooRef = useRef(onMeToo);
  const onGoRef = useRef(onGo);
  const onOutsideRef = useRef(onOutsidePick);
  const boundaryRef = useRef(boundary);
  const userRef = useRef(userLocation);
  const youLabelRef = useRef(youLabel);
  const constrainRef = useRef(constrainPick);
  const trackerRef = useRef(tracker);
  onPickRef.current = onPick;
  onMeTooRef.current = onMeToo;
  onGoRef.current = onGo;
  onOutsideRef.current = onOutsidePick;
  boundaryRef.current = boundary;
  userRef.current = userLocation;
  youLabelRef.current = youLabel;
  constrainRef.current = constrainPick;
  trackerRef.current = tracker;
  if (pick) lastGoodPick.current = pick;

  function campusLocked() {
    return Boolean(lockRef.current && boundaryRef.current);
  }

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !ref.current) return;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      const map = L.map(ref.current, {
        center: [INDIA_VIEW.lat, INDIA_VIEW.lng],
        zoom: INDIA_VIEW.zoom,
        minZoom: 2,
        maxZoom: 19,
        zoomControl: true,
        scrollWheelZoom: false,
        zoomAnimation: !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        fadeAnimation: !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        worldCopyJump: true,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);
      map.on("click", (e: { latlng: { lat: number; lng: number } }) => {
        const lat = e.latlng.lat;
        const lng = e.latlng.lng;
        if (constrainRef.current && !pointInBoundary({ lat, lng }, boundaryRef.current)) {
          onOutsideRef.current?.();
          return;
        }
        onPickRef.current?.(lat, lng);
      });
      heatRef.current = L.layerGroup().addTo(map);
      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      drawFence(L);
      drawYou(L);
      drawHeat(L);
      drawPins(L);
      if (!trackerRef.current) applyView(map, L);
      else if (userRef.current) map.setView([userRef.current.lat, userRef.current.lng], 16);
      if (!cancelled) setMapTick((n) => n + 1);
      setTimeout(() => {
        if (cancelled || mapRef.current !== map) return;
        map.invalidateSize();
        if (!trackerRef.current) applyView(map, L);
      }, 80);
    }
    void boot().catch(() => { if (!cancelled) setMapError(true); });
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
      heatRef.current = null;
      fenceRef.current = null;
      maskRef.current = null;
      youRef.current = null;
      pickRef.current = null;
      routeRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver(() => mapRef.current?.invalidateSize({ pan: false }));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    void import("leaflet").then((mod) => {
      const L = mod.default;
      const map = mapRef.current;
      drawHeat(L);
      drawPins(L);
      if (map && !trackerRef.current) applyView(map, L);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clusters, focusId, selectedId, heat, lockToCampus, mapTick]);

  useEffect(() => {
    void import("leaflet").then((mod) => {
      const L = mod.default;
      const map = mapRef.current;
      if (!map) return;
      drawFence(L);
      if (!trackerRef.current) applyView(map, L);
    });
  }, [boundary, lockToCampus, mapTick]);

  useEffect(() => {
    void import("leaflet").then((mod) => {
      const L = mod.default;
      const map = mapRef.current;
      if (!map) return;
      drawYou(L);
      // GPS is only a fallback camera. Pins or a campus fence already frame the map.
      // A far-away browser fix (or the first locate) must not yank the campus off screen.
      if (trackerRef.current) return;
      if (clustersRef.current.length > 0 || boundaryRef.current) return;
      if (userLocation && !lockRef.current) {
        map.setView([userLocation.lat, userLocation.lng], Math.max(map.getZoom(), 16));
      }
    });
  }, [userLocation, youLabel, mapTick]);

  useEffect(() => {
    if (!recenter) return;
    let cancelled = false;
    let timer = 0;
    let stop = 0;
    void import("leaflet").then((mod) => {
      const L = mod.default;
      const fly = () => {
        const map = mapRef.current;
        if (!map) return false;
        map.invalidateSize();
        if (campusLocked() && !pointInBoundary({ lat: recenter.lat, lng: recenter.lng }, boundaryRef.current)) {
          applyView(map, L);
          return true;
        }
        map.flyTo([recenter.lat, recenter.lng], Math.max(map.getZoom(), 16), { duration: 0.7, animate: !window.matchMedia("(prefers-reduced-motion: reduce)").matches });
        return true;
      };
      if (cancelled || fly()) return;
      timer = window.setInterval(() => {
        if (cancelled) return;
        if (fly()) window.clearInterval(timer);
      }, 200);
      stop = window.setTimeout(() => window.clearInterval(timer), 4000);
    });
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.clearTimeout(stop);
    };
  }, [recenter]);

  useEffect(() => {
    void import("leaflet").then((mod) => {
      const L = mod.default;
      const map = mapRef.current;
      if (!map) return;
      if (routeRef.current) {
        routeRef.current.remove();
        routeRef.current = null;
      }
      if (!route || route.length < 2) return;
      const line = L.polyline(
        route.map((p) => [p.lat, p.lng] as [number, number]),
        { color: "#1e2a3a", weight: 5, opacity: 0.88 },
      ).addTo(map);
      routeRef.current = line;
      map.fitBounds(line.getBounds(), { padding: [48, 48], maxZoom: 17 });
    });
  }, [route, mapTick]);

  useEffect(() => {
    void import("leaflet").then((mod) => {
      const L = mod.default;
      const map = mapRef.current;
      if (!map) return;
      if (pickRef.current) {
        pickRef.current.remove();
        pickRef.current = null;
      }
      if (!pick) return;
      const marker = L.marker([pick.lat, pick.lng], {
        icon: L.divIcon({ className: "cp-pin pick", iconSize: [18, 18], iconAnchor: [9, 9] }),
        zIndexOffset: 800,
        draggable: Boolean(interactivePick),
      }).addTo(map);
      marker.on("dragend", () => {
        const ll = marker.getLatLng();
        if (constrainRef.current && !pointInBoundary({ lat: ll.lat, lng: ll.lng }, boundaryRef.current)) {
          const back = lastGoodPick.current;
          if (back) marker.setLatLng([back.lat, back.lng]);
          onOutsideRef.current?.();
          return;
        }
        onPickRef.current?.(ll.lat, ll.lng);
      });
      pickRef.current = marker;
    });
  }, [pick, interactivePick, mapTick]);

  function applyView(map: import("leaflet").Map, L: typeof import("leaflet")) {
    const fence = boundaryRef.current;
    if (campusLocked() && fence && fence.vertices.length >= 2) {
      const bounds = L.latLngBounds(leafletBounds(fence));
      map.fitBounds(bounds, { padding: [16, 16], maxZoom: 18 });
      const size = map.getSize();
      if (size.x > 40 && size.y > 40) {
        const min = map.getBoundsZoom(bounds, false);
        if (Number.isFinite(min) && min > 4) {
          map.setMinZoom(min - 0.1);
          map.setMaxBounds(bounds.pad(0.02));
        }
      }
      return;
    }
    map.setMaxBounds(undefined as unknown as import("leaflet").LatLngBounds);
    map.setMinZoom(2);
    const pinPts = focusPoints(clustersRef.current);
    if (pinPts.length > 0) {
      const bounds = L.latLngBounds(pinPts.map((c) => [c.lat, c.lng] as [number, number]));
      map.fitBounds(bounds, { padding: [56, 56], maxZoom: 17 });
      return;
    }
    if (fence && fence.vertices.length >= 2) {
      map.fitBounds(leafletBounds(fence), { padding: [28, 28], maxZoom: 18 });
      return;
    }
    const you = userRef.current;
    if (you) {
      map.setView([you.lat, you.lng], 16);
      return;
    }
    map.setView([INDIA_VIEW.lat, INDIA_VIEW.lng], INDIA_VIEW.zoom);
  }

  function drawFence(L: typeof import("leaflet")) {
    const map = mapRef.current;
    if (!map) return;
    if (fenceRef.current) {
      fenceRef.current.remove();
      fenceRef.current = null;
    }
    if (maskRef.current) {
      maskRef.current.remove();
      maskRef.current = null;
    }
    const fence = boundaryRef.current;
    if (!fence) return;
    const ring = boundaryRing(fence);
    if (ring.length < 3) return;
    const hole = ring.map((v) => [v.lat, v.lng] as [number, number]);
    if (campusLocked()) {
      const world: [number, number][] = [
        [90, -180],
        [90, 180],
        [-90, 180],
        [-90, -180],
      ];
      maskRef.current = L.polygon([world, hole], {
        stroke: false,
        fillColor: "#f4f7f6",
        fillOpacity: 1,
        interactive: true,
      }).addTo(map);
      fenceRef.current = L.polygon(hole, {
        color: "#2b5ea8",
        weight: 2,
        fill: false,
      }).addTo(map);
      return;
    }
    fenceRef.current = L.polygon(hole, {
      color: "#2b5ea8",
      weight: 2,
      fillColor: "#2b5ea8",
      fillOpacity: 0.12,
      dashArray: "6 4",
    }).addTo(map);
  }

  function drawYou(L: typeof import("leaflet")) {
    const map = mapRef.current;
    if (!map) return;
    if (youRef.current) {
      youRef.current.remove();
      youRef.current = null;
    }
    const you = userRef.current;
    if (!you) return;
    if (campusLocked() && !pointInBoundary(you, boundaryRef.current)) return;
    youRef.current = L.circleMarker([you.lat, you.lng], {
      radius: 7,
      color: "#ffffff",
      weight: 2,
      fillColor: "#2b5ea8",
      fillOpacity: 0.95,
    })
      .bindTooltip(youLabelRef.current, { direction: "top" })
      .addTo(map);
  }

  function drawHeat(L: typeof import("leaflet")) {
    const heatLayer = heatRef.current;
    if (!heatLayer) return;
    heatLayer.clearLayers();
    if (!heatEnabledRef.current) return;
    const buckets = new Map<string, { lat: number; lng: number; intensity: number; kind: PinKind; n: number }>();
    for (const c of clustersRef.current) {
      if (campusLocked() && !pointInBoundary(c, boundaryRef.current)) continue;
      const key = `${c.lat.toFixed(4)},${c.lng.toFixed(4)}`;
      const kind = pinKind(c.status, c.severity);
      const intensity = Math.max(1, c.report_count + c.me_too_count);
      const prev = buckets.get(key);
      if (!prev) {
        buckets.set(key, { lat: c.lat, lng: c.lng, intensity, kind, n: 1 });
        continue;
      }
      prev.lat = (prev.lat * prev.n + c.lat) / (prev.n + 1);
      prev.lng = (prev.lng * prev.n + c.lng) / (prev.n + 1);
      prev.intensity += intensity;
      prev.n += 1;
      if (kind === "critical" || (kind === "open" && prev.kind !== "critical")) prev.kind = kind;
    }
    for (const b of buckets.values()) {
      const color = PIN_COLORS[b.kind];
      const core = 28 + Math.min(90, b.intensity * 16);
      const rings = [
        { radius: core * 2.2, opacity: 0.1 },
        { radius: core * 1.3, opacity: 0.2 },
        { radius: core * 0.55, opacity: 0.36 },
      ];
      for (const ring of rings) {
        L.circle([b.lat, b.lng], {
          radius: ring.radius,
          stroke: false,
          fillColor: color,
          fillOpacity: ring.opacity,
          interactive: false,
        }).addTo(heatLayer);
      }
    }
  }

  function drawPins(L: typeof import("leaflet")) {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    for (const c of clustersRef.current) {
      if (campusLocked() && !pointInBoundary(c, boundaryRef.current)) continue;
      const kind: PinKind = pinKind(c.status, c.severity);
      const awaiting = c.proof === "awaiting";
      const selected = selectedId && (c.id === selectedId || c.issue_id === selectedId);
      const marker = L.marker([c.lat, c.lng], {
        title: `${c.title} · ${c.building}`,
        alt: c.title,
        icon: L.divIcon({
          className: `cp-pin ${kind}${awaiting ? " awaiting" : ""}${selected ? " dest" : ""}`,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        }),
        zIndexOffset: selected ? 700 : kind === "critical" ? 400 : awaiting ? 300 : kind === "resolved" ? 50 : 200,
      });
      const affected = c.report_count + c.me_too_count;
      const ticket = c.ticket_code ? `<a href="/ticket/${c.ticket_code}">${c.ticket_code}</a>` : "";
      const meToo =
        c.status !== "resolved" && onMeTooRef.current
          ? `<button type="button" data-metoo="${c.id}" class="mt-btn">Me too</button>`
          : "";
      const go =
        onGoRef.current
          ? `<button type="button" data-go="${c.id}" class="go-btn">Start navigation</button>`
          : "";
      const check =
        awaiting && c.ticket_code
          ? `<a href="/ticket/${c.ticket_code}" class="check-btn">Check this fix</a>`
          : "";
      marker.bindPopup(
        `<div style="min-width:180px;font-family:Source Sans 3,sans-serif">
          <strong>${escapeHtml(c.title)}</strong>
          <div style="margin:6px 0;font-size:12px;color:#5b5348">
            ${escapeHtml(c.building)} · ${escapeHtml(c.category)}
            ${c.is_recurring ? " · hotspot" : ""}
          </div>
          <div style="font-size:12px">
            <span style="color:${PIN_COLORS[kind]};font-weight:700">${c.severity === "critical" && c.status !== "resolved" ? "Critical" : statusLabel(c.status)}</span>
            · ${affected} affected
          </div>
          ${proofNote(c.proof)}
          ${
            c.expected_by
              ? `<div style="margin-top:6px;font-size:12px;font-weight:700;color:#1e2a3a">${escapeHtml(c.expected_by)}</div>`
              : ""
          }
          <div style="margin-top:8px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">${ticket} ${meToo} ${check} ${go}</div>
        </div>`,
      );
      marker.on("click", () => {
        onGoRef.current?.(c);
      });
      marker.on("popupopen", () => {
        const btn = document.querySelector(`[data-metoo="${c.id}"]`);
        if (btn && onMeTooRef.current) {
          btn.addEventListener("click", () => onMeTooRef.current?.(c), { once: true });
        }
        const goBtn = document.querySelector(`[data-go="${c.id}"]`);
        if (goBtn && onGoRef.current) {
          goBtn.addEventListener(
            "click",
            (ev) => {
              ev.preventDefault();
              ev.stopPropagation();
              onGoRef.current?.(c);
            },
            { once: true },
          );
        }
      });
      marker.addTo(layer);
      if (focusId && c.id === focusId) {
        marker.openPopup();
        map.setView([c.lat, c.lng], 18);
      }
    }
  }

  const label =
    banner === undefined
      ? interactivePick
        ? constrainPick
          ? "Tap the map to place your pin — it must stay inside the campus area"
          : "Tap the map to drop your pin"
        : null
      : banner;

  return (
    <div className={`cp-map-shell overflow-hidden rounded-2xl border border-rule bg-white shadow-card ${lockToCampus && boundary ? "cp-campus-lock" : ""}`}>
      {label ? <p className="border-b border-rule bg-white px-4 py-3 text-sm font-semibold text-navy">{label}</p> : null}
      {mapError && <p role="alert" className="bg-red-50 p-3 text-sm text-critical">The map could not load. Refresh the page or choose a registered QR location.</p>}
      <div className={`w-full ${heightClass || "h-[320px] md:h-[440px]"}`}><div ref={ref} role="region" aria-label="Campus map. Use arrow keys to pan and zoom buttons to zoom." className="h-full w-full" /></div>
      {interactivePick && <div className="flex flex-wrap items-center justify-between gap-2 border-t border-rule px-3 py-2"><p className="text-xs text-ink/60">{pick ? "Pin selected · drag it to fine-tune" : "Tap a spot or move the map to your location"}</p><button type="button" disabled={!mapTick || mapError} onClick={() => {
        const centre = mapRef.current?.getCenter();
        if (!centre) return;
        if (constrainRef.current && !pointInBoundary(centre, boundaryRef.current)) { onOutsideRef.current?.(); return; }
        onPickRef.current?.(centre.lat, centre.lng);
      }} className="rounded-full bg-navy px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">Use map centre</button></div>}
    </div>
  );
}

/** Where the fix claim stands, so a green pin never reads as proof on its own. */
function proofNote(proof?: ProofState): string {
  if (!proof || proof === "none") return "";
  const line: Record<Exclude<ProofState, "none">, { text: string; color: string }> = {
    awaiting: { text: "Staff closed this — no student has confirmed it yet", color: "#2b5ea8" },
    verified: { text: "Students confirmed this fix", color: "#2f7d4a" },
    unconfirmed: { text: "Closed with no student check", color: "#8a8172" },
    reopened: { text: "Students sent this back after a failed fix", color: "#c43828" },
  };
  const { text, color } = line[proof];
  return `<div style="margin-top:6px;font-size:12px;font-weight:700;color:${color}">${text}</div>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
}
