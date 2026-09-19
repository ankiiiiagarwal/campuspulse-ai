"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { IncidentSuggestion } from "@/lib/incidents";

interface Evidence { id: string; ticket_code: string; description: string; department: string; created_at: string; status: string; proof: string; verified_count: number; disputed_count: number; }
interface Card extends Partial<IncidentSuggestion> { id: string; title: string; place: string; evidence: Evidence[]; decision?: string; progress?: string; }
interface Board { candidates: Card[]; records: Card[]; ungrouped: Evidence[]; }

function Reports({ items }: { items: Evidence[] }) {
  return <ul className="mt-4 divide-y divide-rule rounded-2xl border border-rule bg-white/70 px-4">
    {items.map(i => <li key={i.id} className="py-3">
      <div className="flex flex-wrap justify-between gap-2 text-xs font-semibold text-ink/60"><Link className="text-navy underline" href={`/ticket/${i.ticket_code}`}>{i.ticket_code} ↗</Link><span>{i.department} · {new Date(i.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span></div>
      <p className="mt-1 text-sm">{i.description}</p>
      <p className="mt-2 text-xs text-ink/60">{i.status.replaceAll("_", " ")} · {i.proof === "none" ? "No fix claimed" : i.proof} · {i.verified_count} fixed / {i.disputed_count} still broken</p>
    </li>)}
  </ul>;
}

export function IncidentBoard({ review = false }: { review?: boolean }) {
  const [data, setData] = useState<Board | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [reviews, setReviews] = useState<Record<string, string>>({});
  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/incidents${review ? "?review=1" : ""}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setData(body); setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load incidents"); }
  }, [review]);
  useEffect(() => { void refresh(); const timer = setInterval(() => void refresh(), 15000); return () => clearInterval(timer); }, [refresh]);
  async function decide(id: string, decision: string) {
    setBusy(id); setError("");
    try {
      const response = await fetch("/api/incidents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, decision }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save decision"); }
    finally { setBusy(""); }
  }
  async function aiReview(id: string) {
    setBusy(id);
    try {
      const response = await fetch("/api/incidents/review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setReviews(previous => ({ ...previous, [id]: body.summary }));
    } catch (e) { setReviews(previous => ({ ...previous, [id]: e instanceof Error ? e.message : "AI review unavailable. Pattern analysis remains available." })); }
    finally { setBusy(""); }
  }
  const confirmed = data?.records.filter(r => r.decision === "confirmed") ?? [];
  return <div className="space-y-7">
    <section className="rounded-3xl bg-navy p-6 text-paper md:p-9">
      <p className="text-xs uppercase tracking-[0.25em] text-paper/60">Campus Incident Detective</p>
      <h1 className="mt-3 max-w-2xl font-serif text-4xl md:text-5xl">See the problem behind the reports.</h1>
      <p className="mt-4 max-w-2xl text-paper/80">{review ? "Find possible shared causes across nearby reports. Read the evidence, confirm an investigation, and keep every repair accountable to students." : "Follow staff-confirmed investigations and the original reports behind them. Every repair still needs its own student check."}</p>
      <div className="mt-6 flex flex-wrap gap-3 text-sm"><span className="rounded-full border border-white/25 px-4 py-2">{confirmed.length} confirmed investigations</span>{review && <span className="rounded-full border border-white/25 px-4 py-2">{data?.candidates.length ?? "…"} suggestions to review</span>}</div>
    </section>
    {error && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4">{error} <button onClick={() => void refresh()} className="ml-2 underline">Retry</button>{review && <Link href="/admin" className="ml-3 underline">Admin login</Link>}</div>}
    {!data && !error && <p role="status">Loading evidence…</p>}
    {review && data && <section>
      <h2 className="font-serif text-2xl text-navy">Suggested investigations</h2>
      <p className="mt-1 text-sm text-ink/65">Pattern analysis · open reports from the last 6 hours · same place · within 30 minutes and 60 metres. Suggestions are hypotheses, not confirmed root causes.</p>
      {!data.candidates.length && <p className="mt-4 rounded-2xl border border-dashed border-rule p-6">No supported patterns yet. Reports stay separate until there is enough matching evidence.</p>}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">{data.candidates.map(c => <article key={c.id} className="rounded-3xl border border-amber-300 bg-amber-50/50 p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-800">Needs staff review · {c.evidence.length} reports</p>
        <h3 className="mt-2 font-serif text-2xl text-navy">{c.title}</h3><p className="mt-1 font-semibold">{c.place}</p>
        <p className="mt-3 text-sm text-ink/75">{c.explanation}</p><Reports items={c.evidence} />
        <p className="mt-4 text-sm"><strong>Suggested check:</strong> {c.next_step}</p>
        {reviews[c.id] && <p role="status" className="mt-3 rounded-xl bg-white p-3 text-sm">{reviews[c.id]}</p>}
        <div className="mt-5 flex flex-wrap gap-2"><button disabled={!!busy} onClick={() => void decide(c.id, "confirmed")} className="rounded-full bg-navy px-4 py-2 text-sm font-semibold text-paper disabled:opacity-50">Confirm investigation</button><button disabled={!!busy} onClick={() => void decide(c.id, "separate")} className="rounded-full border border-rule bg-white px-4 py-2 text-sm disabled:opacity-50">Keep separate</button><button disabled={!!busy} onClick={() => void aiReview(c.id)} className="rounded-full px-3 py-2 text-sm underline disabled:opacity-50">{busy === c.id ? "Working…" : "Ask AI to review"}</button></div>
      </article>)}</div>
    </section>}
    {data && <section><h2 className="font-serif text-2xl text-navy">Confirmed investigations</h2>
      {!confirmed.length && <p className="mt-3 text-ink/65">No investigations have been confirmed yet.</p>}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">{confirmed.map(c => <article key={c.id} className="rounded-3xl border border-rule bg-white/70 p-5"><p className="text-xs font-semibold uppercase tracking-widest text-teal-700">{c.progress}</p><h3 className="mt-2 font-serif text-2xl text-navy">{c.title}</h3><p className="mt-1 text-sm">{c.place} · Staff confirmed these reports belong in one investigation.</p><Reports items={c.evidence} /></article>)}</div>
    </section>}
    {review && data && <details className="rounded-2xl border border-rule p-5"><summary className="cursor-pointer font-semibold">{data.ungrouped.length} open reports kept separate</summary><p className="mt-3 text-sm text-ink/65">Insufficient matching evidence, outside the place/time window, or kept separate by staff. These tickets remain in the normal queue.</p><Reports items={data.ungrouped} />{data.records.filter(r => r.decision === "separate").map(r => <p key={r.id} className="mt-3 text-sm text-ink/60">Reviewed: {r.title} at {r.place} — kept separate.</p>)}</details>}
  </div>;
}
