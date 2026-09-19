"use client";

import { requestBrowserLocation } from "@/lib/client";
import { INDIA_VIEW, leafletBounds } from "@/lib/geo";
import type { BoundaryKind, CampusBoundary, GeoPoint } from "@/lib/types";
import { useEffect, useRef, useState } from "react";

const SATELLITE = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const SATELLITE_LABELS =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";
const STREETS = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

interface Props {
  initial?: CampusBoundary | null;
  userLocation?: { lat: number; lng: number } | null;
  flyTo?: { token: number; lat: number; lng: number } | null;
  busy?: boolean;
  onSave: (payload: { type: BoundaryKind; vertices: GeoPoint[] }) => Promise<void>;
  onClear?: () => Promise<void>;
}

export function BoundaryEditor({ initial, userLocation, flyTo, busy, onSave, onClear }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const shapeRef = useRef<import("leaflet").Polygon | import("leaflet").Rectangle | null>(null);
  const handlesRef = useRef<import("leaflet").Marker[]>([]);
  const youRef = useRef<import("leaflet").CircleMarker | null>(null);
  const layersRef = useRef<{
    satellite?: import("leaflet").TileLayer;
    labels?: import("leaflet").TileLayer;
    streets?: import("leaflet").TileLayer;
  }>({});
  const [mode, setMode] = useState<BoundaryKind>(initial?.type || "rectangle");
  const [base, setBase] = useState<"satellite" | "streets">("satellite");
  const [vertices, setVertices] = useState<GeoPoint[]>(initial?.vertices || []);
  const [note, setNote] = useState("Reading your GPS so the map opens on the real campus…");
  const [mapReady, setMapReady] = useState(false);
  const modeRef = useRef(mode);
  const verticesRef = useRef(vertices);
  const userRef = useRef(userLocation);
  const initialRef = useRef(initial);
  modeRef.current = mode;
  verticesRef.current = vertices;
  userRef.current = userLocation;
  initialRef.current = initial;

  useEffect(() => {
    if (initial) {
      setMode(initial.type);
      setVertices(initial.vertices);
    }
  }, [initial]);

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !ref.current) return;
      const known = userRef.current;
      const loc = known
        ? { ok: true as const, lat: known.lat, lng: known.lng }
        : await requestBrowserLocation({ enableHighAccuracy: true, maximumAge: 0, timeout: 12000 });
      if (cancelled || !ref.current) return;
      const fenced = Boolean(initialRef.current && initialRef.current.vertices.length >= 2);
      const here = loc.ok ? loc : null;
      mapRef.current?.remove();
      const map = L.map(ref.current, {
        center: here && !fenced ? [here.lat, here.lng] : [INDIA_VIEW.lat, INDIA_VIEW.lng],
        zoom: here && !fenced ? 18 : INDIA_VIEW.zoom,
        minZoom: 2,
        maxZoom: 19,
        worldCopyJump: true,
      });
      const satellite = L.tileLayer(SATELLITE, {
        attribution: "Imagery &copy; Esri",
        maxZoom: 19,
        maxNativeZoom: 19,
      });
      const labels = L.tileLayer(SATELLITE_LABELS, {
        attribution: "Labels &copy; Esri",
        maxZoom: 19,
        maxNativeZoom: 19,
      });
      const streets = L.tileLayer(STREETS, {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 19,
      });
      layersRef.current = { satellite, labels, streets };
      satellite.addTo(map);
      labels.addTo(map);
      map.on("click", (e: { latlng: { lat: number; lng: number } }) => {
        const next = { lat: e.latlng.lat, lng: e.latlng.lng };
        if (modeRef.current === "rectangle") {
          const cur = verticesRef.current;
          if (cur.length >= 2) setVertices([next]);
          else setVertices([...cur, next]);
        } else {
          setVertices((v) => [...v, next]);
        }
      });
      mapRef.current = map;
      redraw(L);
      const fence = initialRef.current;
      if (fence && fence.vertices.length >= 2) {
        map.fitBounds(leafletBounds(fence), { padding: [28, 28], maxZoom: 18 });
      }
      if (here) {
        setNote(
          `Map is on your GPS (${here.lat.toFixed(5)}, ${here.lng.toFixed(5)}). Draw the campus around the buildings you see.`,
        );
      } else {
        setNote("GPS was not available. Allow location, then press Recalibrate map so this opens on your campus.");
      }
      setMapReady(true);
      setTimeout(() => map.invalidateSize(), 80);
    }
    void boot();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!userLocation && !flyTo) return;
    void import("leaflet").then((mod) => {
      const L = mod.default;
      const map = mapRef.current;
      if (!map) return;
      youRef.current?.remove();
      youRef.current = null;
      if (userLocation) {
        youRef.current = L.circleMarker([userLocation.lat, userLocation.lng], {
          radius: 7,
          color: "#ffffff",
          weight: 2,
          fillColor: "#2b5ea8",
          fillOpacity: 0.95,
        })
          .bindTooltip("Your GPS", { direction: "top" })
          .addTo(map);
      }
      const fence = initialRef.current;
      const fenced = Boolean(fence && fence.vertices.length >= 2);
      if (flyTo) {
        map.invalidateSize();
        map.flyTo([flyTo.lat, flyTo.lng], 18, { duration: 0.7 });
      } else if (userLocation && !fenced && verticesRef.current.length === 0 && map.getZoom() < 15) {
        map.invalidateSize();
        map.flyTo([userLocation.lat, userLocation.lng], 18, { duration: 0.7 });
        setNote(
          `Map is on your GPS (${userLocation.lat.toFixed(5)}, ${userLocation.lng.toFixed(5)}). Draw the campus around the buildings you see.`,
        );
      }
    });
  }, [userLocation, flyTo]);

  useEffect(() => {
    const map = mapRef.current;
    const layers = layersRef.current;
    if (!map || !layers.satellite || !layers.labels || !layers.streets) return;
    if (base === "satellite") {
      if (!map.hasLayer(layers.satellite)) layers.satellite.addTo(map);
      if (!map.hasLayer(layers.labels)) layers.labels.addTo(map);
      if (map.hasLayer(layers.streets)) map.removeLayer(layers.streets);
    } else {
      if (map.hasLayer(layers.satellite)) map.removeLayer(layers.satellite);
      if (map.hasLayer(layers.labels)) map.removeLayer(layers.labels);
      if (!map.hasLayer(layers.streets)) layers.streets.addTo(map);
    }
  }, [base, mapReady]);

  useEffect(() => {
    void import("leaflet").then((mod) => redraw(mod.default));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vertices, mode]);

  function handleIcon(L: typeof import("leaflet")) {
    return L.divIcon({ className: "cp-vertex", iconSize: [14, 14], iconAnchor: [7, 7] });
  }

  function redraw(L: typeof import("leaflet")) {
    const map = mapRef.current;
    if (!map) return;
    shapeRef.current?.remove();
    for (const h of handlesRef.current) h.remove();
    handlesRef.current = [];
    shapeRef.current = null;

    if (mode === "rectangle" && vertices.length >= 2) {
      const b = L.latLngBounds(
        [vertices[0].lat, vertices[0].lng],
        [vertices[vertices.length - 1].lat, vertices[vertices.length - 1].lng],
      );
      shapeRef.current = L.rectangle(b, {
        color: "#2b5ea8",
        weight: 2,
        fillColor: "#2b5ea8",
        fillOpacity: 0.16,
      }).addTo(map);
    } else if (mode === "polygon" && vertices.length >= 2) {
      const latlngs = vertices.map((v) => [v.lat, v.lng] as [number, number]);
      shapeRef.current = L.polygon(latlngs, {
        color: "#2b5ea8",
        weight: 2,
        fillColor: "#2b5ea8",
        fillOpacity: vertices.length >= 3 ? 0.16 : 0,
      }).addTo(map);
    }

    vertices.forEach((v, index) => {
      const marker = L.marker([v.lat, v.lng], {
        icon: handleIcon(L),
        draggable: true,
        zIndexOffset: 900,
      }).addTo(map);
      marker.on("dragend", () => {
        const ll = marker.getLatLng();
        setVertices((cur) => cur.map((p, i) => (i === index ? { lat: ll.lat, lng: ll.lng } : p)));
      });
      handlesRef.current.push(marker);
    });
  }

  function resetDraw() {
    setVertices([]);
    setNote("Shape cleared. Click the map to start again.");
  }

  function undo() {
    setVertices((v) => v.slice(0, -1));
  }

  async function save() {
    setNote("");
    try {
      await onSave({ type: mode, vertices });
      setNote("Campus area saved.");
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Save failed");
    }
  }

  const canSave = mode === "rectangle" ? vertices.length >= 2 : vertices.length >= 3;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setMode("rectangle");
            setVertices([]);
            setNote("Click two opposite corners of the campus.");
          }}
          className={`rounded-full px-3 py-1.5 text-sm font-semibold ${mode === "rectangle" ? "bg-navy text-paper" : "border border-rule text-ink/70 hover:bg-paper"}`}
        >
          Rectangle
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("polygon");
            setVertices([]);
            setNote("Click to add corners, then save. Need at least three points.");
          }}
          className={`rounded-full px-3 py-1.5 text-sm font-semibold ${mode === "polygon" ? "bg-navy text-paper" : "border border-rule text-ink/70 hover:bg-paper"}`}
        >
          Polygon
        </button>
        <button type="button" onClick={undo} className="rounded-full border border-rule px-3 py-1.5 text-sm font-semibold text-ink/70 hover:bg-paper">
          Undo point
        </button>
        <button type="button" onClick={resetDraw} className="rounded-full border border-rule px-3 py-1.5 text-sm font-semibold text-ink/70 hover:bg-paper">
          Redraw
        </button>
        <button
          type="button"
          onClick={() => setBase("satellite")}
          className={`rounded-full px-3 py-1.5 text-sm font-semibold ${base === "satellite" ? "bg-navy text-paper" : "border border-rule text-ink/70 hover:bg-paper"}`}
        >
          Satellite
        </button>
        <button
          type="button"
          onClick={() => setBase("streets")}
          className={`rounded-full px-3 py-1.5 text-sm font-semibold ${base === "streets" ? "bg-navy text-paper" : "border border-rule text-ink/70 hover:bg-paper"}`}
        >
          Streets
        </button>
      </div>
      <p className="text-sm text-ink/65">
        {mode === "rectangle"
          ? "Click two opposite corners to box the campus. Drag a corner to adjust."
          : "Click each corner of the campus. Drag vertices to edit. Need at least three points."}
      </p>
      <div className="overflow-hidden rounded-2xl border border-rule">
        <div ref={ref} className="h-[460px] w-full md:h-[560px]" />
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!canSave || busy}
          onClick={() => void save()}
          className="rounded-full bg-navy px-5 py-2 text-sm font-semibold text-paper disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save campus area"}
        </button>
        {onClear ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void onClear()}
            className="rounded-full border border-critical/40 px-5 py-2 text-sm font-semibold text-critical"
          >
            Remove campus area
          </button>
        ) : null}
      </div>
      {note ? <p className="text-sm text-ink/70">{note}</p> : null}
      <p className="text-xs text-ink/45">{vertices.length} point{vertices.length === 1 ? "" : "s"} drawn.</p>
    </div>
  );
}
