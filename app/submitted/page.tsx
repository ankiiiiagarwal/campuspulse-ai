"use client";

import { CopyTicket } from "@/components/CopyTicket";
import { ExpectedFix } from "@/components/ExpectedFix";
import { useLang } from "@/lib/i18n";
import { rememberTicket } from "@/lib/saved-tickets";
import type { IssueWithCluster } from "@/lib/types";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

function SubmittedCard() {
  const params = useSearchParams();
  const { t } = useLang();
  const code = (params.get("code") || "").trim();
  const merged = params.get("merged") === "1" || params.get("joined") === "1";
  const [issue, setIssue] = useState<IssueWithCluster | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!code) {
      setError(t("noTicketId"));
      return;
    }
    rememberTicket(code);
    fetch(`/api/issues/code/${encodeURIComponent(code)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (!data.issue) setError(t("ticketLoadFail"));
        else {
          rememberTicket(data.issue.ticket_code);
          setIssue(data.issue);
        }
      })
      .catch(() => setError(t("ticketLoadFail")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  if (error) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-rule bg-white/80 p-6">
        <h1 className="font-serif text-3xl text-navy">{t("submitted")}</h1>
        <p className="mt-2 text-sm text-critical">{error}</p>
        <Link href="/" className="mt-6 inline-flex rounded-full bg-navy px-5 py-2.5 font-semibold text-paper">
          {t("returnHome")}
        </Link>
      </div>
    );
  }

  if (!issue) return <p className="text-ink/60">{t("loading")}</p>;

  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-rule bg-white/80 p-6 shadow-card">
      <h1 className="font-serif text-3xl text-navy">{t("submitted")}</h1>
      <p className="mt-1 text-ink/70">{merged || issue.report_count > 1 ? t("joinedTicket") : t("submittedLead")}</p>
      <dl className="mt-5 space-y-4">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-ink/45">{t("ticketId")}</dt>
          <dd className="mt-1 flex flex-wrap items-center gap-3">
            <span className="font-serif text-2xl font-semibold text-navy">{issue.ticket_code}</span>
            <CopyTicket code={issue.ticket_code} label={t("copyTicket")} copiedLabel={t("copied")} />
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-ink/45">{t("issue")}</dt>
          <dd className="mt-1 text-ink/80">{issue.description}</dd>
        </div>
        {issue.eta_at && issue.status !== "resolved" ? (
          <ExpectedFix etaAt={issue.eta_at} />
        ) : issue.status !== "resolved" ? (
          <p className="text-sm text-ink/65">{t("waitingForEta")}</p>
        ) : null}
      </dl>
      <Link
        href={`/ticket/${encodeURIComponent(issue.ticket_code)}`}
        className="mt-8 flex w-full items-center justify-center rounded-full bg-navy py-3 font-semibold text-paper"
      >
        {t("ticketLabel", { code: issue.ticket_code })}
      </Link>
      <Link href="/" className="mt-3 flex w-full items-center justify-center rounded-full border border-rule py-3 font-semibold">
        {t("returnHome")}
      </Link>
    </div>
  );
}

function SubmittedFallback() {
  const { t } = useLang();
  return <p className="text-ink/60">{t("loading")}</p>;
}

export default function SubmittedPage() {
  return (
    <Suspense fallback={<SubmittedFallback />}>
      <SubmittedCard />
    </Suspense>
  );
}
