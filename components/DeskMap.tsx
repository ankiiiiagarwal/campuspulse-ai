"use client";

import { CampusMap, type MapCluster } from "@/components/CampusMap";
import { gpsFailureMessage, requestBrowserLocation, watchBrowserLocation, type GpsFix } from "@/lib/client";
import { haversineMeters } from "@/lib/duplicates";
import { driveRoute, formatDriveTime, formatMeters, openDirections, type DriveRoute } from "@/lib/navigate";
import type { CampusBoundary, IssueWithCluster } from "@/lib/types";
import { useEffect, useMemo, useRef, useState } from "react";

function toPins(issues: IssueWithCluster[]): MapCluster[] {
  const seen = new Set<string>();
  const pins: MapCluster[] = [];
  for (const issue of issues) {
    if (issue.status === "resolved" || seen.has(issue.cluster_id)) continue;
    seen.add(issue.cluster_id);
    pins.push({
      id: issue.cluster_id,
      issue_id: issue.id,
      title: issue.title,
      building: issue.building,
      category: issue.category,
      status: issue.status,
      severity: issue.severity,
      lat: issue.lat,
      lng: issue.lng,
      report_count: issue.report_count,
      me_too_count: issue.me_too_count,
      ticket_code: issue.ticket_code,
      is_recurring: issue.is_recurring,
    });
  }
  return pins;
}

export function DeskMap({
  issues,
  mode,
  trip,
}: {
  issues: IssueWithCluster[];
  mode: "admin" | "field";
  trip?: { id: string; nonce: number } | null;
}) {
  const field = mode === "field";
  const [boundary, setBoundary] = useState<CampusBoundary | null>(null);
  const [user, setUser] = useState<GpsFix | null>(null);
  const [note, setNote] = useState(field ? "Reading your GPS. You can be anywhere, not only on campus." : "");
  const [busy, setBusy] = useState(false);
  const [recenter, setRecenter] = useState<{ token: number; lat: number; lng: number } | null>(null);
  const [dest, setDest] = useState<MapCluster | null>(null);
  const [route, setRoute] = useState<DriveRoute | null>(null);
  const userRef = useRef<GpsFix | null>(null);
  const firstFix = useRef(true);
  userRef.current = user;
  const pins = useMemo(() => toPins(issues), [issues]);

  useEffect(() => {
    fetch("/api/campus", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => setBoundary(data.boundary || null))
      .catch(() => setBoundary(null));
  }, []);

  useEffect(() => {
    if (!field) return;
    return watchBrowserLocation(
      (fix) => {
        setUser(fix);
        if (firstFix.current) {
          firstFix.current = false;
          setRecenter({ token: Date.now(), lat: fix.lat, lng: fix.lng });
          setNote(`Tracking you at ${fix.lat.toFixed(5)}, ${fix.lng.toFixed(5)}.`);
        }
      },
      (reason) => setNote(gpsFailureMessage(reason)),
    );
  }, [field]);

  async function loadRoute(from: GpsFix, job: MapCluster) {
    setRoute(await driveRoute(from, job));
  }

  function go(job: MapCluster) {
    setDest(job);
    const from = userRef.current;
    openDirections(from, job);
    if (from) void loadRoute(from, job);
  }

  async function recalibrate() {
    setBusy(true);
    const res = await requestBrowserLocation({ enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
    setBusy(false);
    if (!res.ok) {
      setNote(gpsFailureMessage(res.reason));
      return;
    }
    setUser(res);
    setRecenter({ token: Date.now(), lat: res.lat, lng: res.lng });
    setNote(`Recalibrated · ${res.lat.toFixed(5)}, ${res.lng.toFixed(5)} · ±${Math.round(res.accuracy)} m`);
    if (dest) void loadRoute(res, dest);
  }

  useEffect(() => {
    if (!trip) return;
    const job = pins.find((pin) => pin.issue_id === trip.id || pin.id === trip.id);
    if (job) go(job);
    // go is recreated each render; nonce is the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip?.nonce]);

  const liveMeters = user && dest ? haversineMeters(user, dest) : null;
  const meters = route?.meters ?? liveMeters;
  const eta = formatDriveTime(route?.seconds);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl text-navy">{field ? "Field tracker" : "Campus map"}</h2>
          <p className="max-w-xl text-sm text-ink/65">
            {field
              ? "You can be off campus. The map follows your real GPS. Tap a pin and it opens directions to that job, like a pickup point."
              : "Recalibrate reads a fresh GPS fix and recenters this map on you."}
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void recalibrate()}
          className="rounded-full bg-navy px-4 py-2 text-sm font-semibold text-paper disabled:opacity-60"
        >
          {busy ? "Reading GPS…" : "Recalibrate map"}
        </button>
      </div>
      {field && user ? (
        <p className="text-sm text-ink/70">
          You · {user.lat.toFixed(5)}, {user.lng.toFixed(5)}
          {Number.isFinite(user.accuracy) ? ` · ±${Math.round(user.accuracy)} m` : ""}
        </p>
      ) : null}
      {note ? <p className="text-sm text-ink/70">{note}</p> : null}
      {field && dest ? (
        <div className="rounded-2xl border-2 border-navy bg-white p-4 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/50">Go to this pin</p>
          <p className="font-serif text-2xl text-navy">{dest.title}</p>
          <p className="mt-1 text-sm text-ink/70">
            {dest.building}
            {dest.ticket_code ? ` · ${dest.ticket_code}` : ""} · {dest.lat.toFixed(5)}, {dest.lng.toFixed(5)}
          </p>
          <p className="mt-2 text-sm font-semibold">
            {meters != null ? `${formatMeters(meters)} away` : "Waiting for your GPS"}
            {eta ? ` · about ${eta}` : ""}
          </p>
          <button type="button" onClick={() => go(dest)} className="mt-3 rounded-full bg-navy px-4 py-2 text-sm font-semibold text-paper">
            Start navigation
          </button>
        </div>
      ) : null}
      <CampusMap
        clusters={pins}
        boundary={boundary}
        userLocation={user}
        youLabel={field ? "You" : "Your GPS"}
        recenter={recenter}
        route={route?.points ?? null}
        selectedId={dest?.id ?? null}
        onGo={field ? go : undefined}
        tracker={field}
        banner={field ? "Tap a job pin — directions open to that location" : undefined}
      />
    </section>
  );
}
