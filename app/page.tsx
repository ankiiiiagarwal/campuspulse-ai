"use client";

import { CampusMap, type MapCluster } from "@/components/CampusMap";
import { HealthMeter } from "@/components/HealthMeter";
import { StatusBadge } from "@/components/StatusBadge";
import { PIN_COLORS } from "@/lib/campus";
import { ageLabel, getClientHash } from "@/lib/client";
import type { Cluster, HealthBreakdown, IssueWithCluster } from "@/lib/types";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

interface HealthPayload {
  campus: HealthBreakdown;
  buildings: Array<HealthBreakdown & { id: string; name: string; open_count: number }>;
}

export default function HomePage() {
  const [issues, setIssues] = useState<IssueWithCluster[]>([]);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  async function load() {
    const [iRes, hRes] = await Promise.all([fetch("/api/issues", { cache: "no-store" }), fetch("/api/health", { cache: "no-store" })]);
    const iData = await iRes.json();
    const hData = await hRes.json();
    if (!iRes.ok) throw new Error(iData.error || "Could not load map");
    setIssues(iData.issues);
    setClusters(iData.clusters);
    setHealth(hData);
  }

  useEffect(() => {
    load().catch((e: Error) => setError(e.message));
  }, []);

  const mapClusters: MapCluster[] = useMemo(() => {
    return clusters.map((c) => {
      const lead = issues.find((i) => i.cluster_id === c.id && i.status !== "resolved") || issues.find((i) => i.cluster_id === c.id);
      return {
        id: c.id,
        title: c.title,
        building: c.building,
        category: c.category,
        status: c.status,
        severity: c.severity,
        lat: c.lat,
        lng: c.lng,
        report_count: c.report_count,
        me_too_count: c.me_too_count,
        is_recurring: c.is_recurring,
        ticket_code: lead?.ticket_code,
        issue_id: lead?.id,
      };
    });
  }, [clusters, issues]);

  async function onMeToo(cluster: MapCluster) {
    setNote("");
    const res = await fetch(`/api/issues/${cluster.issue_id || cluster.id}/me-too`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_hash: getClientHash(), cluster_id: cluster.id }),
    });
    const data = await res.json();
    if (!res.ok) {
      setNote(data.error || "Could not add Me too");
      return;
    }
    setNote(`Me too counted. ${data.cluster.report_count + data.cluster.me_too_count} people now on “${data.cluster.title}”.`);
    await load();
  }

  const openIssues = clusters
    .filter((c) => c.status !== "resolved")
    .sort((a, b) => b.priority - a.priority)
    .map((c) => {
      const lead =
        issues.find((i) => i.cluster_id === c.id && i.status !== "resolved") ||
        issues.find((i) => i.cluster_id === c.id);
      return lead;
    })
    .filter((i): i is IssueWithCluster => Boolean(i));
  const library = health?.buildings.find((b) => b.name === "Library");

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/50">North Ridge Campus</p>
          <h1 className="font-serif text-4xl font-semibold text-navy md:text-5xl">What is broken, and who is on it.</h1>
          <p className="mt-2 max-w-xl text-ink/70">
            Students report anonymously. Duplicates merge. Safety ranks the queue. No account. No name. Just the issue.
          </p>
        </div>
        <div className="rounded-2xl border border-rule bg-white/70 px-5 py-4 shadow-card">
          <HealthMeter score={health?.campus.score ?? 0} label="Campus" />
          {library ? <p className="mt-2 text-sm text-ink/65">Library health {library.score} — lowest building</p> : null}
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        {(health?.buildings || [])
          .filter((b) => b.open_count > 0 || b.score < 100)
          .slice(0, 8)
          .map((b) => (
            <div key={b.id} className="rounded-full border border-rule bg-white/60 px-3 py-1 text-sm">
              <span className="font-semibold">{b.name}</span>{" "}
              <span className="text-ink/55">{b.score}</span>
            </div>
          ))}
      </div>

      <div className="flex flex-wrap gap-3 text-xs font-semibold uppercase tracking-wide">
        <Legend color={PIN_COLORS.critical} label="Critical" />
        <Legend color={PIN_COLORS.open} label="Open" />
        <Legend color={PIN_COLORS.on_it} label="On it" />
        <Legend color={PIN_COLORS.resolved} label="Resolved" />
      </div>

      {error ? <p className="rounded-xl bg-critical/10 px-3 py-2 text-sm text-critical">{error}</p> : null}
      {note ? <p className="rounded-xl bg-resolved/10 px-3 py-2 text-sm text-resolved">{note}</p> : null}

      <CampusMap clusters={mapClusters} onMeToo={onMeToo} />

      <section className="grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-rule bg-white/60 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-serif text-2xl text-navy">Open queue</h2>
            <Link href="/report" className="text-sm font-semibold text-onit">
              Report something →
            </Link>
          </div>
          <ul className="space-y-2">
            {openIssues.slice(0, 8).map((i) => (
              <li key={i.id} className="flex items-start justify-between gap-3 rounded-xl border border-rule/70 bg-paper/40 px-3 py-2">
                <div>
                  <Link href={`/ticket/${i.ticket_code}`} className="font-semibold hover:underline">
                    {i.title}
                  </Link>
                  <p className="text-sm text-ink/60">
                    {i.building} · {i.category} · {ageLabel(i.created_at)}
                    {i.is_recurring ? " · hotspot" : ""}
                  </p>
                </div>
                <StatusBadge status={i.status} severity={i.severity} />
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-rule bg-navy p-5 text-paper">
          <h2 className="font-serif text-2xl">90-second demo</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-paper/85">
            <li>Open the Library Wi-Fi pin and tap Me too.</li>
            <li>Report Hostel B Wi-Fi — accept the nearby prompt or submit anyway.</li>
            <li>Admin marks On it, then resolves. Health ticks up.</li>
          </ol>
          <Link href="/report" className="mt-5 inline-flex rounded-full bg-amberpin px-4 py-2 text-sm font-bold text-ink">
            Drop a pin
          </Link>
        </div>
      </section>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-ink/70">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}
