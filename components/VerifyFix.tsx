"use client";

import { stripExif } from "@/lib/client";
import { formatRemaining } from "@/lib/eta";
import { useLang } from "@/lib/i18n";
import { CONFIRMATIONS_TO_VERIFY, proofState } from "@/lib/verification";
import type { IssueWithCluster, Verdict } from "@/lib/types";
import { useState } from "react";

/**
 * The student side of a fix claim. A department closing a ticket is a claim;
 * this card is the only thing that turns it into a verified fix or sends it back.
 */
export function VerifyFix({ issue, onDone }: { issue: IssueWithCluster; onDone: () => void }) {
  const { lang, t } = useLang();
  const locale = lang === "hi" ? "hi-IN" : "en-IN";
  const state = proofState(issue);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState<Verdict | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ verdict: Verdict; reopened: boolean } | null>(null);

  if (state === "reopened") {
    return (
      <Panel tone="critical">
        <p className="font-semibold">
          {t("reopenedBanner", { count: String(issue.reopen_count) })}
        </p>
      </Panel>
    );
  }

  if (state === "verified") {
    return (
      <Panel tone="resolved">
        <p className="font-semibold">{t("proofVerified")}</p>
        <p className="mt-1 text-sm">
          {t("checkFixConfirmed", { count: String(Math.max(1, issue.verified_count)) })}
        </p>
      </Panel>
    );
  }

  if (state === "unconfirmed") {
    return (
      <Panel tone="muted">
        <p className="font-semibold">{t("proofUnconfirmed")}</p>
        <p className="mt-1 text-sm">{t("checkFixUnconfirmed")}</p>
      </Panel>
    );
  }

  if (state !== "awaiting") return null;

  function settledMessage(result: { verdict: Verdict; reopened: boolean }): string {
    if (result.reopened) return t("checkFixReopened", { dept: issue.department });
    if (result.verdict === "broken") return t("checkFixDisputeLogged", { dept: issue.department });
    if (issue.verified_count >= CONFIRMATIONS_TO_VERIFY) {
      return t("checkFixConfirmed", { count: String(issue.verified_count) });
    }
    return t("checkFixWaiting", {
      count: String(issue.verified_count),
      needed: String(CONFIRMATIONS_TO_VERIFY),
    });
  }

  if (done) {
    return (
      <Panel tone={done.reopened ? "critical" : done.verdict === "broken" ? "muted" : "resolved"}>
        <p className="font-semibold">{t("checkFixThanks")}</p>
        <p className="mt-1 text-sm">{settledMessage(done)}</p>
      </Panel>
    );
  }

  async function pickPhoto(file?: File) {
    setPhoto(file || null);
    setPreview(file ? URL.createObjectURL(file) : null);
  }

  async function send(verdict: Verdict) {
    setBusy(verdict);
    setError("");
    try {
      let photo_url: string | null = null;
      if (verdict === "broken" && photo) {
        const image = await stripExif(photo);
        const up = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image }),
        });
        const upData = await up.json();
        if (!up.ok) throw new Error(upData.error || t("photoUploadFail"));
        photo_url = upData.url;
      }
      const res = await fetch(`/api/issues/${issue.id}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verdict, photo_url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("checkFixFail"));
      setDone({ verdict, reopened: Boolean(data.reopened) });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("checkFixFail"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="rounded-2xl border-2 border-onit bg-onit/5 p-4">
      <h2 className="font-serif text-2xl text-navy">{t("checkFixTitle")}</h2>
      <p className="mt-1 text-sm text-ink/70">{t("checkFixLead", { dept: issue.department })}</p>
      {issue.verify_deadline_at ? (
        <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-ink/50">
          {t("checkFixClosesIn", { when: formatRemaining(issue.verify_deadline_at, locale) })}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={Boolean(busy)}
          onClick={() => void send("fixed")}
          className="rounded-full bg-resolved px-5 py-2.5 font-semibold text-white disabled:opacity-60"
        >
          {busy === "fixed" ? t("checkFixSending") : t("checkFixYes")}
        </button>
        <button
          type="button"
          disabled={Boolean(busy)}
          onClick={() => void send("broken")}
          className="rounded-full bg-critical px-5 py-2.5 font-semibold text-white disabled:opacity-60"
        >
          {busy === "broken" ? t("checkFixSending") : t("checkFixNo")}
        </button>
      </div>

      <label className="mt-3 block cursor-pointer text-sm font-semibold text-navy underline">
        {photo ? t("checkFixPhotoReplace") : t("checkFixPhoto")}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => void pickPhoto(e.target.files?.[0])}
        />
      </label>
      <p className="mt-1 text-xs text-ink/55">{t("checkFixPhotoHelp")}</p>
      {preview ? (
        <img src={preview} alt="" className="mt-2 max-h-40 w-full rounded-xl object-cover" />
      ) : null}

      {error ? <p className="mt-3 text-sm font-semibold text-critical">{error}</p> : null}
    </section>
  );
}

function Panel({ tone, children }: { tone: "critical" | "resolved" | "muted"; children: React.ReactNode }) {
  const style =
    tone === "critical"
      ? "border-critical/30 bg-critical/10 text-critical"
      : tone === "resolved"
        ? "border-resolved/30 bg-resolved/10 text-resolved"
        : "border-rule bg-white/70 text-ink/70";
  return <section className={`rounded-2xl border px-4 py-3 ${style}`}>{children}</section>;
}
