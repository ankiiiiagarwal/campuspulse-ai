"use client";

import { CopyTicket } from "@/components/CopyTicket";
import { ExpectedFix } from "@/components/ExpectedFix";
import { StatusBadge } from "@/components/StatusBadge";
import { TicketTimeline } from "@/components/TicketTimeline";
import { VerifyFix } from "@/components/VerifyFix";
import { openHelpChat } from "@/lib/chat-open";
import { formatDateTime } from "@/lib/client";
import { useLang } from "@/lib/i18n";
import { rememberTicket } from "@/lib/saved-tickets";
import { proofState } from "@/lib/verification";
import type { IssueWithCluster } from "@/lib/types";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

interface Sibling {
  id: string;
  ticket_code: string;
  description: string;
  created_at: string;
  photo_url: string | null;
}

export default function TicketPage() {
  const params = useParams<{ code: string }>();
  const { lang, t } = useLang();
  const locale = lang === "hi" ? "hi-IN" : "en-IN";
  const [issue, setIssue] = useState<IssueWithCluster | null>(null);
  const [siblings, setSiblings] = useState<Sibling[]>([]);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  async function load() {
    const res = await fetch(`/api/issues/code/${encodeURIComponent(String(params.code))}`, { cache: "no-store" });
    const data = await res.json();
    if (!res.ok || !data.issue) {
      setError(t("ticketMissing"));
      return;
    }
    rememberTicket(data.issue.ticket_code);
    setIssue(data.issue);
    setSiblings(Array.isArray(data.siblings) ? data.siblings : []);
  }

  useEffect(() => {
    load().catch(() => setError(t("ticketLoadFail")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.code]);

  async function meToo() {
    if (!issue) return;
    const res = await fetch(`/api/issues/${issue.id}/me-too`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cluster_id: issue.cluster_id }),
    });
    const data = await res.json();
    if (!res.ok) {
      setNote(data.error || t("alreadyCounted"));
      return;
    }
    setNote(t("meTooCounted"));
    await load();
  }

  if (error) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-rule bg-white/70 p-6">
        <h1 className="font-serif text-3xl text-navy">{t("ticketNotFound")}</h1>
        <p className="mt-2 text-ink/70">{error}</p>
        <Link href="/report" className="mt-4 inline-block font-semibold text-onit">
          {t("fileNew")}
        </Link>
      </div>
    );
  }

  if (!issue) return <p className="text-ink/60">{t("loadingTicket")}</p>;

  const affected = issue.report_count + issue.me_too_count;
  const others = siblings.filter((s) => s.id !== issue.id);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/50">
          {t("ticketLabel", { code: issue.ticket_code })}
        </p>
        <CopyTicket code={issue.ticket_code} label={t("copyTicket")} copiedLabel={t("copied")} />
      </div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="font-serif text-4xl text-navy">{issue.title}</h1>
        <StatusBadge status={issue.status} severity={issue.severity} />
      </div>
      <p className="text-ink/75">{issue.description}</p>

      {issue.report_count > 1 ? (
        <p className="rounded-2xl border border-amberpin bg-amberpin/10 px-4 py-3 text-sm font-semibold text-navy">
          {t("mergeBanner", { count: String(affected) })}
        </p>
      ) : null}

      {issue.escalated_at && issue.status !== "resolved" ? (
        <p className="rounded-2xl border border-critical/30 bg-critical/10 px-4 py-3 text-sm font-semibold text-critical">
          {t("escalated")}
        </p>
      ) : null}

      <VerifyFix issue={issue} onDone={() => void load()} />

      <section className="rounded-2xl border border-rule bg-white/70 p-4">
        <TicketTimeline
          issue={issue}
          locale={locale}
          labels={{
            reported: t("timelineReported"),
            assigned: t("timelineAssigned"),
            onIt: t("timelineOnIt"),
            resolved: t("timelineResolved"),
            waiting: t("timelineWaiting"),
          }}
        />
      </section>

      {issue.eta_at && issue.status !== "resolved" ? (
        <ExpectedFix etaAt={issue.eta_at} />
      ) : issue.status !== "resolved" ? (
        <p className="rounded-2xl border border-rule bg-white/70 px-4 py-3 text-sm text-ink/65">{t("waitingForEta")}</p>
      ) : null}

      <dl className="grid grid-cols-2 gap-3 rounded-2xl border border-rule bg-white/70 p-4 text-sm md:grid-cols-3">
        <Fact label={t("building")} value={issue.building} />
        <Fact label={t("category")} value={issue.category} />
        <Fact label={t("department")} value={issue.department} />
        <Fact label={t("severity")} value={issue.severity} />
        <Fact label={t("affected")} value={String(affected)} />
        <Fact label={t("opened")} value={formatDateTime(issue.created_at, locale)} />
        {issue.worker_name ? <Fact label={t("working")} value={issue.worker_name} /> : null}
        {issue.eta_at ? <Fact label={t("eta")} value={formatDateTime(issue.eta_at, locale)} /> : null}
        {issue.is_recurring ? <Fact label={t("hotspot")} value={t("hotspotYes")} /> : null}
        {issue.reopen_count > 0 ? (
          <Fact label={t("sentBack")} value={t("sentBackTimes", { count: String(issue.reopen_count) })} />
        ) : null}
      </dl>

      {others.length ? (
        <section className="rounded-2xl border border-rule bg-white/70 p-4">
          <h2 className="font-serif text-xl text-navy">{t("otherReports")}</h2>
          <ul className="mt-3 space-y-3">
            {others.map((s) => (
              <li key={s.id} className="rounded-xl bg-paper/70 px-3 py-2">
                <p className="text-sm font-semibold">{s.ticket_code}</p>
                <p className="text-sm text-ink/70">{s.description}</p>
                <p className="mt-1 text-xs text-ink/45">{formatDateTime(s.created_at, locale)}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {issue.photo_url ? (
        <img src={issue.photo_url} alt="" className="max-h-64 rounded-2xl border border-rule object-cover" />
      ) : null}
      {issue.resolve_photo_url ? (
        <div>
          <p className="text-sm font-semibold">
            {proofState(issue) === "verified" ? t("proofFixed") : t("claimPhoto")}
          </p>
          <img src={issue.resolve_photo_url} alt="" className="mt-1 max-h-64 rounded-2xl border border-rule object-cover" />
        </div>
      ) : null}

      {note ? <p className="text-sm text-resolved">{note}</p> : null}

      <div className="flex flex-wrap gap-2">
        {issue.status !== "resolved" ? (
          <button onClick={() => void meToo()} className="rounded-full bg-navy px-5 py-2 font-semibold text-paper">
            {t("meToo")}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() =>
            openHelpChat(`How do I fix this? ${issue.title}. ${issue.description}`.slice(0, 400))
          }
          className="rounded-full border border-rule px-5 py-2 font-semibold"
        >
          {t("askFixThis")}
        </button>
        <Link href="/" className="rounded-full border border-rule px-5 py-2 font-semibold">
          {t("backToMap")}
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
