"use client";

import { BUILDINGS, CAMPUS, PIN_COLORS, pinKind, type PinKind } from "@/lib/campus";
import { statusLabel } from "@/lib/client";
import { useEffect, useRef } from "react";

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
}

interface Props {
  clusters: MapCluster[];
  pick?: { lat: number; lng: number } | null;
  onPick?: (lat: number, lng: number) => void;
  onMeToo?: (cluster: MapCluster) => void;
  interactivePick?: boolean;
  focusId?: string | null;
}

export function CampusMap({ clusters, pick, onPick, onMeToo, interactivePick, focusId }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const layerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const pickRef = useRef<import("leaflet").Marker | null>(null);
  const onPickRef = useRef(onPick);
  const onMeTooRef = useRef(onMeToo);
  onPickRef.current = onPick;
  onMeTooRef.current = onMeToo;

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !ref.current || mapRef.current) return;
      const map = L.map(ref.current, {
        center: [CAMPUS.center.lat, CAMPUS.center.lng],
        zoom: CAMPUS.defaultZoom,
        minZoom: 16,
        maxZoom: 19,
        zoomControl: true,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);
      map.setMaxBounds([
        [CAMPUS.bounds.south - 0.0015, CAMPUS.bounds.west - 0.0015],
        [CAMPUS.bounds.north + 0.0015, CAMPUS.bounds.east + 0.0015],
      ]);
      for (const b of BUILDINGS) {
        L.circleMarker([b.lat, b.lng], {
          radius: 3,
          color: "#1e2a3a",
          weight: 1,
          fillColor: "#f3eadc",
          fillOpacity: 0.9,
        })
          .bindTooltip(b.name, { permanent: true, direction: "top", className: "building-tip", offset: [0, -6] })
          .addTo(map);
      }
      map.on("click", (e: { latlng: { lat: number; lng: number } }) => {
        if (onPickRef.current) onPickRef.current(e.latlng.lat, e.latlng.lng);
      });
      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      drawPins(L);
    }
    void boot();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void import("leaflet").then((mod) => drawPins(mod.default));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clusters, focusId]);

  useEffect(() => {
    void import("leaflet").then((mod) => {
      const L = mod.default;
      const map = mapRef.current;
      if (!map || !pick) return;
      if (pickRef.current) pickRef.current.remove();
      pickRef.current = L.marker([pick.lat, pick.lng], {
        icon: L.divIcon({ className: "cp-pin pick", iconSize: [18, 18], iconAnchor: [9, 9] }),
        zIndexOffset: 600,
      }).addTo(map);
    });
  }, [pick]);

  function drawPins(L: typeof import("leaflet")) {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    for (const c of clusters) {
      const kind: PinKind = pinKind(c.status, c.severity);
      const marker = L.marker([c.lat, c.lng], {
        icon: L.divIcon({ className: `cp-pin ${kind}`, iconSize: [18, 18], iconAnchor: [9, 9] }),
        zIndexOffset: kind === "critical" ? 400 : kind === "resolved" ? 50 : 200,
      });
      const affected = c.report_count + c.me_too_count;
      const ticket = c.ticket_code ? `<a href="/ticket/${c.ticket_code}">${c.ticket_code}</a>` : "";
      const meToo =
        c.status !== "resolved" && onMeTooRef.current
          ? `<button type="button" data-metoo="${c.id}" class="mt-btn">Me too</button>`
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
          <div style="margin-top:8px;display:flex;gap:8px;align-items:center">${ticket} ${meToo}</div>
        </div>`,
      );
      marker.on("popupopen", () => {
        const btn = document.querySelector(`[data-metoo="${c.id}"]`);
        if (btn && onMeTooRef.current) {
          btn.addEventListener("click", () => onMeTooRef.current?.(c), { once: true });
        }
      });
      marker.addTo(layer);
      if (focusId && c.id === focusId) {
        marker.openPopup();
        map.setView([c.lat, c.lng], 18);
      }
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-rule shadow-card">
      {interactivePick ? (
        <p className="bg-navy px-3 py-2 text-sm font-semibold text-paper">Tap the map to drop your pin</p>
      ) : null}
      <div ref={ref} className="h-[420px] w-full md:h-[560px]" />
    </div>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
}
