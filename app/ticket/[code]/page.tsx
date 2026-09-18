"use client";

import { StatusBadge } from "@/components/StatusBadge";
import { ageLabel, getClientHash, statusLabel } from "@/lib/client";
import type { IssueWithCluster } from "@/lib/types";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

const STEPS = ["open", "assigned", "on_it", "resolved"] as const;

export default function TicketPage() {
  const params = useParams<{ code: string }>();
  const [issue, setIssue] = useState<IssueWithCluster | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  async function load() {
    const res = await fetch("/api/issues", { cache: "no-store" });
    const data = await res.json();
    const found = (data.issues as IssueWithCluster[]).find(
      (i) => i.ticket_code.toLowerCase() === String(params.code).toLowerCase(),
    );
    if (!found) setError("No ticket with that ID.");
    else setIssue(found);
  }

  useEffect(() => {
    load().catch(() => setError("Could not load ticket"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.code]);

  async function meToo() {
    if (!issue) return;
    const res = await fetch(`/api/issues/${issue.id}/me-too`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_hash: getClientHash(), cluster_id: issue.cluster_id }),
    });
    const data = await res.json();
    if (!res.ok) {
      setNote(data.error || "Already counted");
      return;
    }
    setNote("Me too counted.");
    await load();
  }

  if (error) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-rule bg-white/70 p-6">
        <h1 className="font-serif text-3xl text-navy">Ticket not found</h1>
        <p className="mt-2 text-ink/70">{error}</p>
        <Link href="/report" className="mt-4 inline-block font-semibold text-onit">
          File a new report →
        </Link>
      </div>
    );
  }

  if (!issue) return <p className="text-ink/60">Loading ticket…</p>;

  const stepIndex = STEPS.indexOf(issue.status);
  const affected = issue.report_count + issue.me_too_count;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/50">Ticket {issue.ticket_code}</p>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="font-serif text-4xl text-navy">{issue.title}</h1>
        <StatusBadge status={issue.status} severity={issue.severity} />
      </div>
      <p className="text-ink/75">{issue.description}</p>

      <ol className="grid grid-cols-4 gap-2 text-center text-xs font-semibold uppercase tracking-wide">
        {STEPS.map((s, i) => (
          <li
            key={s}
            className={`rounded-full px-2 py-2 ${i <= stepIndex ? "bg-navy text-paper" : "bg-white/70 text-ink/45"}`}
          >
            {statusLabel(s)}
          </li>
        ))}
      </ol>

      <dl className="grid grid-cols-2 gap-3 rounded-2xl border border-rule bg-white/70 p-4 text-sm md:grid-cols-3">
        <Fact label="Building" value={issue.building} />
        <Fact label="Category" value={issue.category} />
        <Fact label="Department" value={issue.department} />
        <Fact label="Severity" value={issue.severity} />
        <Fact label="Priority" value={String(issue.priority)} />
        <Fact label="Affected" value={String(affected)} />
        <Fact label="Opened" value={ageLabel(issue.created_at)} />
        {issue.eta_at ? <Fact label="ETA" value={new Date(issue.eta_at).toLocaleString()} /> : null}
        {issue.is_recurring ? <Fact label="Hotspot" value="Repeats in 14 days" /> : null}
      </dl>

      {issue.photo_url ? (
        <img src={issue.photo_url} alt="Report photo" className="max-h-64 rounded-2xl border border-rule object-cover" />
      ) : null}
      {issue.resolve_photo_url ? (
        <div>
          <p className="text-sm font-semibold">Proof it was fixed</p>
          <img src={issue.resolve_photo_url} alt="Resolve photo" className="mt-1 max-h-64 rounded-2xl border border-rule object-cover" />
        </div>
      ) : null}

      {note ? <p className="text-sm text-resolved">{note}</p> : null}

      <div className="flex flex-wrap gap-2">
        {issue.status !== "resolved" ? (
          <button onClick={() => void meToo()} className="rounded-full bg-navy px-5 py-2 font-semibold text-paper">
            Me too
          </button>
        ) : null}
        <Link href="/" className="rounded-full border border-rule px-5 py-2 font-semibold">
          Back to map
        </Link>
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-ink/45">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}
