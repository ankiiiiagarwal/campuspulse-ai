"use client";

import { AdminHeader } from "@/components/AdminHeader";
import { BoundaryEditor } from "@/components/BoundaryEditor";
import { gpsFailureMessage, requestBrowserLocation, staffDeskHeaders } from "@/lib/client";
import type { BoundaryKind, CampusBoundary, GeoPoint } from "@/lib/types";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function AdminCampusPage() {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<{ email: string; role?: string } | null>(null);
  const [boundary, setBoundary] = useState<CampusBoundary | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [flyTo, setFlyTo] = useState<{ token: number; lat: number; lng: number } | null>(null);
  const [locBusy, setLocBusy] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const s = await fetch("/api/admin/session?desk=admin", {
      cache: "no-store",
      headers: staffDeskHeaders("admin"),
    });
    const sData = await s.json();
    const staff = sData.admin || (sData.session?.role === "admin" ? sData.session : null);
    setSession(staff);
    if (staff) {
      const c = await fetch("/api/campus", { cache: "no-store" });
      const cData = await c.json();
      setBoundary(cData.boundary || null);
    }
    setReady(true);
  }

  useEffect(() => {
    refresh().catch(() => setReady(true));
    void requestBrowserLocation().then((res) => {
      if (res.ok) setUserLocation({ lat: res.lat, lng: res.lng });
    });
  }, []);

  async function save(payload: { type: BoundaryKind; vertices: GeoPoint[] }) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/campus", {
        method: "PUT",
        headers: staffDeskHeaders("admin", { "Content-Type": "application/json" }),
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save campus area");
      setBoundary(data.boundary);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Save failed";
      setError(message);
      throw e;
    } finally {
      setBusy(false);
    }
  }

  async function recalibrate() {
    setLocBusy(true);
    setError("");
    const res = await requestBrowserLocation({ enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
    setLocBusy(false);
    if (!res.ok) {
      setError(gpsFailureMessage(res.reason));
      return;
    }
    setUserLocation({ lat: res.lat, lng: res.lng });
    setFlyTo({ token: Date.now(), lat: res.lat, lng: res.lng });
  }

  async function clear() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/campus", {
        method: "DELETE",
        headers: staffDeskHeaders("admin"),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not remove campus area");
      setBoundary(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Remove failed");
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return <p className="text-ink/60">Loading campus editor…</p>;

  if (!session) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-rule bg-white/80 p-6 shadow-card">
        <h1 className="font-serif text-3xl text-navy">Campus area</h1>
        <Link href="/admin" className="mt-4 inline-flex rounded-full bg-navy px-4 py-2 text-sm font-semibold text-paper">
          Go to admin login
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminHeader title="Campus area" />

      <p className="rounded-2xl border border-rule bg-white/80 px-4 py-3 text-sm text-ink/75">
        Optional. Save a fence only if you want report pins to stay inside campus. If you skip this, students can pin
        anywhere.
      </p>

      {boundary ? (
        <p className="rounded-xl bg-resolved/10 px-3 py-2 text-sm text-resolved">
          Campus area is set ({boundary.type}, {boundary.vertices.length} points
          {boundary.updated_at ? ` · saved ${new Date(boundary.updated_at).toLocaleString()}` : ""}). Draw again and save
          to update it.
        </p>
      ) : null}
      {error ? <p className="rounded-xl bg-critical/10 px-3 py-2 text-sm text-critical">{error}</p> : null}

      <section className="space-y-4 rounded-2xl border border-rule bg-white/80 p-4 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-serif text-2xl text-navy">Draw the area</h2>
          <button
            type="button"
            disabled={locBusy}
            onClick={() => void recalibrate()}
            className="rounded-full border border-rule px-4 py-2 text-sm font-semibold disabled:opacity-60"
          >
            {locBusy ? "Reading GPS…" : "Recalibrate map"}
          </button>
        </div>
        <BoundaryEditor initial={boundary} userLocation={userLocation} flyTo={flyTo} busy={busy} onSave={save} onClear={clear} />
      </section>
    </div>
  );
}
