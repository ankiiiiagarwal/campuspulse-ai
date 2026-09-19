"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CampusMap } from "./CampusMap";
import { PlaceQr } from "./PlaceQr";
import { PrintPosterButton } from "./PrintPosterButton";
import { DEPARTMENTS } from "@/lib/departments";
import type { CampusBoundary, Department, ReportLocation } from "@/lib/types";

export function LocationManager({ editable = false }: { editable?: boolean }) {
  const [locations, setLocations] = useState<ReportLocation[]>([]);
  const [origin, setOrigin] = useState("");
  const [name, setName] = useState("");
  const [department, setDepartment] = useState<Department>("Library");
  const [pin, setPin] = useState<{lat: number; lng: number} | null>(null);
  const [boundary, setBoundary] = useState<CampusBoundary | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [copied, setCopied] = useState("");
  async function load() {
    try {
      const response = await fetch("/api/locations", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setLocations(data.locations); setLoaded(true); setError("");
    } catch(e) { setError(e instanceof Error ? e.message : "Could not load locations"); }
  }
  useEffect(() => {
    setOrigin(window.location.origin); void load();
    if (editable) void fetch("/api/campus").then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(data => setBoundary(data.boundary)).catch(() => setError("Could not load the campus boundary. Reload before creating a location."));
  }, [editable]);
  async function save(e: React.FormEvent) {
    e.preventDefault(); if (!pin) { setError("Tap the map to select the exact location."); return; }
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/locations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, department, ...pin }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setName(""); setPin(null); await load();
    } catch(e) { setError(e instanceof Error ? e.message : "Could not save location"); }
    finally { setBusy(false); }
  }
  return <section className="space-y-5">
    <div className="print:hidden"><h2 className="font-serif text-3xl text-navy">Exact-location QR posters</h2><p className="mt-2 text-ink/65">One code for a room, floor, or corridor. Scanning fills in the place and map pin so reports reach the right investigation.</p></div>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3">{error} <button className="underline" onClick={() => void load()}>Retry</button></p>}
    {editable && <form onSubmit={e => void save(e)} className="grid gap-5 rounded-3xl border border-rule bg-white/70 p-5 lg:grid-cols-2 print:hidden">
      <div className="space-y-4"><label className="block text-sm font-semibold">Department<select value={department} onChange={e => setDepartment(e.target.value as Department)} className="mt-1 block w-full rounded-xl border border-rule p-3">{DEPARTMENTS.map(d => <option key={d}>{d}</option>)}</select></label>
        <label className="block text-sm font-semibold">Specific place, including floor<input required minLength={3} maxLength={120} value={name} onChange={e => setName(e.target.value)} placeholder="Second floor, reading room" className="mt-1 block w-full rounded-xl border border-rule p-3" /></label>
        <p className="text-sm text-ink/60">Tap its position on the map. Use a different name for each floor. Published QR locations remain stable for printed posters.</p>
        <p className="text-xs">{pin ? `${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}` : "No map pin selected"}</p>
        <button disabled={busy} className="rounded-full bg-navy px-5 py-3 font-semibold text-paper disabled:opacity-50">{busy ? "Saving…" : "Create QR location"}</button>
      </div>
      <CampusMap clusters={[]} pick={pin} onPick={(lat,lng) => setPin({lat,lng})} interactivePick boundary={boundary} constrainPick={!!boundary} onOutsidePick={() => setError("Select a point inside the campus boundary.")} heightClass="h-[320px]" />
    </form>}
    {!loaded && !error && <p role="status">Loading QR locations…</p>}
    {loaded && !locations.length && <p className="rounded-2xl border border-dashed border-rule p-5 text-ink/60">No exact locations registered yet. {editable ? "Create your first location above." : <Link className="underline" href="/admin/locations">An admin can create them here.</Link>}</p>}
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 print:grid-cols-2">{locations.map(l => {
      const href = `${origin}/report?location=${l.id}`;
      return <article key={l.id} className="flex break-inside-avoid flex-col items-center rounded-3xl border border-rule bg-white p-5 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-ink/50">CampusPulse · {l.department}</p><h3 className="mt-2 font-serif text-2xl text-navy">{l.name}</h3><p className="my-3 text-sm text-ink/60">Scan to report here · यहाँ शिकायत करें</p>
        {origin && <PlaceQr value={href} />}<p className="mt-3 text-xs text-ink/50">Location and floor already filled in.</p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-sm print:hidden"><PrintPosterButton title={l.name} subtitle={l.department} href={origin ? href : ""} /><Link className="underline" href={`/report?location=${l.id}`}>Open report</Link><button className="underline" onClick={async () => { try { await navigator.clipboard.writeText(href); setCopied(l.id); } catch { setError("Could not copy. Open the report and copy its address."); } }}>{copied === l.id ? "Copied" : "Copy link"}</button></div>
      </article>;
    })}</div>
  </section>;
}
