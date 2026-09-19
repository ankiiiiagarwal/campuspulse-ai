"use client";

import { formatHours } from "@/lib/client";
import { useLang } from "@/lib/i18n";
import type { Department, ProofStats, TrailStats } from "@/lib/types";
import { formatRate } from "@/lib/verification";
import { useEffect, useState } from "react";

interface DeskTrail extends TrailStats {
  name: Department;
}

interface DeskProof extends ProofStats {
  name: Department;
}

export default function AccountabilityPage() {
  const { t } = useLang();
  const [trail, setTrail] = useState<TrailStats | null>(null);
  const [desks, setDesks] = useState<DeskTrail[]>([]);
  const [proof, setProof] = useState<ProofStats | null>(null);
  const [deskProof, setDeskProof] = useState<DeskProof[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/health", { cache: "no-store" })
      .then((r) => { if (!r.ok) throw new Error("Could not load scoreboard"); return r.json(); })
      .then((data) => {
        setTrail(data.trail || null);
        setDesks(data.departments || []);
        setProof(data.proof || null);
        setDeskProof(data.proofByDepartment || []);
      })
      .catch(() => setError(t("ticketLoadFail")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const proofFor = (name: Department) => deskProof.find((d) => d.name === name) || null;

  return (
    <div className="space-y-6">
      <section>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/50">{t("accountability")}</p>
        <h1 className="font-serif text-4xl font-semibold text-navy">{t("accountabilityTitle")}</h1>
        <p className="mt-2 max-w-2xl text-ink/70">{t("accountabilityLead")}</p>
      </section>

      {error ? <p className="text-sm text-critical">{error}</p> : null}

      {trail ? (
        <div className="grid grid-cols-2 gap-3">
          <Stat label={t("avgAssign")} value={formatHours(trail.avg_assign_hrs)} hint={`${trail.assigned_or_resolved} ${t("ticketsMeasured")}`} />
          <Stat label={t("avgResolve")} value={formatHours(trail.avg_resolve_hrs)} hint={`${trail.resolved_count} ${t("closedCount")}`} />
        </div>
      ) : null}

      {proof ? (
        <section className="space-y-3">
          <p className="max-w-2xl text-sm text-ink/70">{t("scoreboardProofLead")}</p>
          <div className="grid grid-cols-2 gap-3">
            <Stat
              label={t("verifiedFixRate")}
              value={formatRate(proof.verified_rate)}
              hint={`${proof.verified} of ${proof.verified + proof.disputed} judged`}
              tone={rateTone(proof.verified_rate)}
            />
            <Stat
              label={t("reopenRate")}
              value={formatRate(proof.reopen_rate)}
              hint={`${proof.disputed} of ${proof.claims} ${t("claimsMade")}`}
              tone={rateTone(proof.reopen_rate == null ? null : 1 - proof.reopen_rate)}
            />
          </div>
          <p className="text-xs text-ink/50">
            {proof.awaiting} {t("awaitingCount")} · {proof.unconfirmed} {t("unconfirmedCount")}
          </p>
        </section>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {desks.map((d) => {
          const p = proofFor(d.name);
          return (
            <article key={d.name} className="rounded-2xl border border-rule bg-white/80 p-4">
              <h2 className="font-serif text-2xl text-navy">{d.name}</h2>
              {d.assigned_or_resolved || d.resolved_count ? (
                <dl className="mt-3 space-y-2 text-sm">
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-ink/45">{t("avgAssign")}</dt>
                    <dd className="font-semibold">{formatHours(d.avg_assign_hrs)}</dd>
                    <p className="text-xs text-ink/50">
                      {d.assigned_or_resolved} {t("ticketsMeasured")}
                    </p>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-ink/45">{t("avgResolve")}</dt>
                    <dd className="font-semibold">{formatHours(d.avg_resolve_hrs)}</dd>
                    <p className="text-xs text-ink/50">
                      {d.resolved_count} {t("closedCount")}
                    </p>
                  </div>
                </dl>
              ) : (
                <p className="mt-3 text-sm text-ink/55">{t("noTrailYet")}</p>
              )}

              {p && p.claims ? (
                <dl className="mt-3 border-t border-rule/70 pt-3 text-sm">
                  <dt className="text-xs uppercase tracking-wide text-ink/45">{t("verifiedFixRate")}</dt>
                  <dd className="font-semibold" style={{ color: rateTone(p.verified_rate) }}>
                    {formatRate(p.verified_rate)}
                  </dd>
                  <p className="text-xs text-ink/50">
                    {p.claims} {t("claimsMade")} · {p.disputed} {t("reopenRate").toLowerCase()}
                  </p>
                </dl>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}

function rateTone(rate: number | null): string | undefined {
  if (rate == null) return undefined;
  if (rate >= 0.8) return "#2f7d4a";
  if (rate >= 0.5) return "#c98412";
  return "#c43828";
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-rule bg-white/80 px-4 py-4">
      <p className="text-sm font-semibold text-ink/55">{label}</p>
      <p
        className="mt-2 font-serif text-4xl font-semibold leading-none text-navy"
        style={tone ? { color: tone } : undefined}
      >
        {value}
      </p>
      <p className="mt-2 text-xs text-ink/50">{hint}</p>
    </div>
  );
}
