"use client";

import { HealthMeter } from "@/components/HealthMeter";
import { StatusBadge } from "@/components/StatusBadge";
import { ageLabel, formatHours, stripExif } from "@/lib/client";
import type { HealthBreakdown, IssueWithCluster, TrailStats } from "@/lib/types";
import Link from "next/link";
import { useEffect, useState } from "react";

interface HealthPayload {
  campus: HealthBreakdown;
  buildings: Array<HealthBreakdown & { id: string; name: string; open_count: number }>;
  trail: TrailStats;
  recentResolved: IssueWithCluster[];
}

export default function AdminPage() {
  const [email, setEmail] = useState("admin@campus.local");
  const [password, setPassword] = useState("campuspulse");
  const [session, setSession] = useState<{ email: string } | null>(null);
  const [ready, setReady] = useState(false);
  const [issues, setIssues] = useState<IssueWithCluster[]>([]);
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [error, setError] = useState("");
  const [etaHours, setEtaHours] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  async function refresh() {
    const [s, i, h] = await Promise.all([
      fetch("/api/admin/session", { cache: "no-store" }),
      fetch("/api/issues", { cache: "no-store" }),
      fetch("/api/health", { cache: "no-store" }),
    ]);
    const sData = await s.json();
    setSession(sData.admin);
    const iData = await i.json();
    setIssues(iData.issues || []);
    setHealth(await h.json());
    setReady(true);
  }

  useEffect(() => {
    refresh().catch(() => setReady(true));
  }, []);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Login failed");
      return;
    }
    await refresh();
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setSession(null);
  }

  async function patch(id: string, body: Record<string, unknown>) {
    setBusyId(id);
    setError("");
    try {
      const res = await fetch(`/api/issues/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusyId(null);
    }
  }

  async function resolveWithPhoto(issue: IssueWithCluster, file?: File) {
    let resolve_photo_url: string | null = issue.resolve_photo_url;
    if (file) {
      const image = await stripExif(file);
      const up = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image, kind: "resolve" }),
      });
      const upData = await up.json();
      if (!up.ok) {
        setError(upData.error || "Photo failed");
        return;
      }
      resolve_photo_url = upData.url;
    }
    await patch(issue.id, { status: "resolved", resolve_photo_url });
  }

  if (!ready) return <p className="text-ink/60">Loading admin…</p>;

  if (!session) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-rule bg-white/80 p-6 shadow-card">
        <h1 className="font-serif text-3xl text-navy">Facilities login</h1>
        <p className="mt-1 text-sm text-ink/65">One admin seat. Students never sign in.</p>
        <form onSubmit={(e) => void login(e)} className="mt-5 space-y-3">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            className="w-full rounded-xl border border-rule px-3 py-2"
            placeholder="admin@campus.local"
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            className="w-full rounded-xl border border-rule px-3 py-2"
            placeholder="Password"
          />
          {error ? <p className="text-sm text-critical">{error}</p> : null}
          <button className="w-full rounded-full bg-navy py-2.5 font-semibold text-paper">Enter queue</button>
        </form>
        <p className="mt-4 text-xs text-ink/50">Demo: admin@campus.local / campuspulse (or your Supabase Auth user).</p>
      </div>
    );
  }

  const queue = issues.filter((i) => i.status !== "resolved").sort((a, b) => b.priority - a.priority);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/50">{session.email}</p>
          <h1 className="font-serif text-4xl text-navy">Operations desk</h1>
        </div>
        <button onClick={() => void logout()} className="rounded-full border border-rule px-4 py-2 text-sm font-semibold">
          Sign out
        </button>
      </div>

      <section className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-rule bg-white/75 p-4 shadow-card md:col-span-1">
          <HealthMeter score={health?.campus.score ?? 0} label="Campus health" />
          <p className="mt-2 text-xs text-ink/55">
            {health?.campus.critical_open} critical · {health?.campus.high_open} high · {health?.campus.overdue} overdue ·{" "}
            {health?.campus.recurring_hotspots} hotspots
          </p>
        </div>
        <Stat label="Avg assign" value={formatHours(health?.trail.avg_assign_hrs)} hint="Created → assigned" />
        <Stat label="Avg resolve" value={formatHours(health?.trail.avg_resolve_hrs)} hint="Created → resolved" />
        <Stat label="Open jobs" value={String(queue.length)} hint="Not yet resolved" />
      </section>

      <section className="rounded-2xl border border-rule bg-white/70 p-4">
        <h2 className="font-serif text-2xl text-navy">Building health</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {(health?.buildings || []).map((b) => (
            <div key={b.id} className="rounded-xl border border-rule px-3 py-2 text-sm">
              <span className="font-semibold">{b.name}</span> {b.score}
              <span className="text-ink/45"> · {b.open_count} open</span>
            </div>
          ))}
        </div>
      </section>

      {error ? <p className="text-sm text-critical">{error}</p> : null}

      <section className="overflow-hidden rounded-2xl border border-rule bg-white/80">
        <div className="border-b border-rule px-4 py-3">
          <h2 className="font-serif text-2xl text-navy">Priority queue</h2>
          <p className="text-sm text-ink/55">Safety 40% · affected 25% · age 20% · location 15%</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-paper/80 text-xs uppercase tracking-wide text-ink/50">
              <tr>
                <th className="px-3 py-2">Pri</th>
                <th className="px-3 py-2">Issue</th>
                <th className="px-3 py-2">Route</th>
                <th className="px-3 py-2">People</th>
                <th className="px-3 py-2">Age</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Act</th>
              </tr>
            </thead>
            <tbody>
              {queue.map((i) => (
                <tr key={i.id} className="border-t border-rule/70">
                  <td className="px-3 py-3 font-serif text-lg font-semibold text-navy">{i.priority}</td>
                  <td className="px-3 py-3">
                    <Link href={`/ticket/${i.ticket_code}`} className="font-semibold hover:underline">
                      {i.title}
                    </Link>
                    <p className="text-xs text-ink/55">
                      {i.ticket_code} · {i.building}
                      {i.is_recurring ? " · hotspot" : ""}
                    </p>
                  </td>
                  <td className="px-3 py-3">
                    {i.department}
                    <p className="text-xs text-ink/50">
                      {i.category} · safety {i.safety}
                    </p>
                  </td>
                  <td className="px-3 py-3">{i.report_count + i.me_too_count}</td>
                  <td className="px-3 py-3">{ageLabel(i.created_at)}</td>
                  <td className="px-3 py-3">
                    <StatusBadge status={i.status} severity={i.severity} />
                    {i.eta_at ? <p className="mt-1 text-xs text-onit">ETA {new Date(i.eta_at).toLocaleString()}</p> : null}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-col gap-1">
                      {i.status === "open" ? (
                        <button
                          disabled={busyId === i.id}
                          onClick={() => void patch(i.id, { status: "assigned" })}
                          className="rounded-full bg-amberpin/20 px-3 py-1 text-xs font-semibold"
                        >
                          Assign
                        </button>
                      ) : null}
                      {i.status !== "resolved" && i.status !== "on_it" ? (
                        <div className="flex items-center gap-1">
                          <input
                            value={etaHours[i.id] ?? "2"}
                            onChange={(e) => setEtaHours((s) => ({ ...s, [i.id]: e.target.value }))}
                            className="w-12 rounded border border-rule px-1 py-0.5 text-xs"
                            aria-label="ETA hours"
                          />
                          <button
                            disabled={busyId === i.id}
                            onClick={() => {
                              const hrs = Number(etaHours[i.id] ?? 2);
                              const eta = new Date(Date.now() + (Number.isFinite(hrs) ? hrs : 2) * 3600_000).toISOString();
                              void patch(i.id, { status: "on_it", eta_at: eta });
                            }}
                            className="rounded-full bg-onit px-3 py-1 text-xs font-semibold text-white"
                          >
                            On it
                          </button>
                        </div>
                      ) : null}
                      {i.status !== "resolved" ? (
                        <label className="cursor-pointer rounded-full bg-resolved px-3 py-1 text-center text-xs font-semibold text-white">
                          {busyId === i.id ? "Saving…" : "Resolve + photo"}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => void resolveWithPhoto(i, e.target.files?.[0] || undefined)}
                          />
                        </label>
                      ) : null}
                      {i.status !== "resolved" ? (
                        <button
                          disabled={busyId === i.id}
                          onClick={() => void patch(i.id, { status: "resolved" })}
                          className="text-xs font-semibold text-resolved underline"
                        >
                          Resolve without photo
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-rule bg-white/70 p-4">
        <h2 className="font-serif text-2xl text-navy">Response trail</h2>
        <ul className="mt-3 space-y-2">
          {(health?.recentResolved || []).map((i) => (
            <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-paper/60 px-3 py-2 text-sm">
              <span>
                <span className="font-semibold">{i.ticket_code}</span> {i.title}
              </span>
              <span className="text-ink/55">
                {i.building} · resolved {i.resolved_at ? ageLabel(i.resolved_at) : ""}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-rule bg-white/75 p-4 shadow-card">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/50">{label}</p>
      <p className="font-serif text-3xl text-navy">{value}</p>
      <p className="text-xs text-ink/45">{hint}</p>
    </div>
  );
}
