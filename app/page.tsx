"use client";

import { CampusMap, type MapCluster } from "@/components/CampusMap";
import { ExpectedFix } from "@/components/ExpectedFix";
import { ProofBadge } from "@/components/ProofBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { fetchDashboard } from "@/lib/dashboard";
import { PIN_COLORS } from "@/lib/campus";
import { formatDateTime, gpsFailureMessage, requestBrowserLocation } from "@/lib/client";
import { formatExpectedBy, formatRemaining } from "@/lib/eta";
import { pointInBoundary } from "@/lib/geo";
import { awaitingCheck, proofState } from "@/lib/verification";
import { useLang } from "@/lib/i18n";
import type { CampusBoundary, Cluster, FixedIssue, HealthBreakdown, IssueWithCluster, PlaceHealth, TrailStats } from "@/lib/types";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

interface HealthPayload {
  campus: HealthBreakdown;
  places?: PlaceHealth[];
  trail?: TrailStats;
  fixedThisWeek?: FixedIssue[];
}

export default function HomePage() {
  const { lang, t } = useLang();
  const locale = lang === "hi" ? "hi-IN" : "en-IN";
  const [issues, setIssues] = useState<IssueWithCluster[]>([]);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [boundary, setBoundary] = useState<CampusBoundary | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [geoNote, setGeoNote] = useState("");
  const [locBusy, setLocBusy] = useState(false);
  const [recenter, setRecenter] = useState<{ token: number; lat: number; lng: number } | null>(null);
  const [list, setList] = useState<"open" | "closed">("open");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await fetchDashboard();
      setIssues(data.inventory.issues || []);
      setClusters(data.inventory.clusters || []);
      setHealth(data.health);
      setBoundary(data.boundary);
      setLoaded(true);
    } catch (error) {
      setHealth(null);
      setError(error instanceof Error ? error.message : "Could not load dashboard");
    } finally { setLoading(false); }
  }

  useEffect(() => {
    load().catch((e: Error) => {
      setError(e.message);
    });
  }, []);

  const reported = issues.length;
  const solved = issues.filter((i) => i.status === "resolved").length;
  const healthScore = health?.campus?.score ?? null;

  const openIssues = useMemo(
    () => issues.filter((i) => i.status !== "resolved").sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [issues],
  );
  const closedIssues = useMemo(
    () =>
      issues
        .filter((i) => i.status === "resolved")
        .sort((a, b) => String(b.resolved_at || b.created_at).localeCompare(String(a.resolved_at || a.created_at))),
    [issues],
  );
  const shown = list === "open" ? openIssues : closedIssues;
  const needsCheck = useMemo(() => awaitingCheck(issues).slice(0, 5), [issues]);

  const mapClusters: MapCluster[] = useMemo(() => {
    const visible = new Set(shown.map((i) => i.cluster_id));
    return clusters
      .filter((c) => visible.has(c.id))
      .filter((c) => !boundary || pointInBoundary({ lat: c.lat, lng: c.lng }, boundary))
      .map((c) => {
        const lead =
          shown.find((i) => i.cluster_id === c.id) ||
          issues.find((i) => i.cluster_id === c.id);
        return {
          id: c.id,
          title: c.title,
          building: c.building,
          category: c.category,
          status: lead?.status || c.status,
          severity: c.severity,
          lat: c.lat,
          lng: c.lng,
          report_count: c.report_count,
          me_too_count: c.me_too_count,
          is_recurring: c.is_recurring,
          ticket_code: lead?.ticket_code,
          issue_id: lead?.id,
          proof: lead ? proofState(lead) : undefined,
          expected_by:
            lead?.eta_at && lead.status !== "resolved" ? formatExpectedBy(lead.eta_at, locale) : undefined,
        };
      });
  }, [clusters, issues, shown, boundary, locale]);

  async function recalibrate() {
    setLocBusy(true);
    const res = await requestBrowserLocation({ enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
    setLocBusy(false);
    if (!res.ok) {
      setGeoNote(gpsFailureMessage(res.reason));
      return;
    }
    setUserLocation({ lat: res.lat, lng: res.lng });
    setRecenter({ token: Date.now(), lat: res.lat, lng: res.lng });
    setGeoNote("");
  }

  async function onMeToo(cluster: MapCluster) {
    setNote("");
    const res = await fetch(`/api/issues/${cluster.issue_id || cluster.id}/me-too`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cluster_id: cluster.id }),
    });
    const data = await res.json();
    if (!res.ok) {
      setNote(data.error || t("meTooNoteFail"));
      return;
    }
    await load();
  }

  return (
    <div className="space-y-6" aria-busy={loading}>
      <section className="flex flex-wrap items-end justify-between gap-6 py-4 md:py-6">
        <div className="max-w-xl"><p className="cp-kicker">{lang === "hi" ? "आपका कैंपस। आपकी आवाज़।" : "Your campus. Your voice."}</p><h1 className="mt-3 font-serif text-4xl leading-[1.12] tracking-tight text-navy md:text-5xl">{lang === "hi" ? "छोटी शिकायतें। बेहतर कैंपस।" : <>Small reports.<br />A better campus.</>}</h1><p className="mt-4 max-w-md text-base text-ink/65">{lang === "hi" ? "समस्या बताएँ, सही जगह चुनें और सुधार की पुष्टि करें। खाते की जरूरत नहीं।" : "Report what needs attention. Follow the repair. Help your community confirm it’s fixed."}</p></div>
        <div className="flex flex-wrap gap-2"><Link href="/report" className="cp-lift rounded-full bg-navy px-6 py-3 text-sm font-semibold text-white shadow-card">{lang === "hi" ? "समस्या बताएँ" : "Report an issue"} <span aria-hidden="true">↗</span></Link><Link href="/incidents" className="rounded-full border border-rule bg-white px-5 py-3 text-sm font-semibold text-navy">{lang === "hi" ? "घटनाएँ देखें" : "Explore incidents"}</Link></div>
      </section>

      {loading ? <p role="status">{lang === "hi" ? "डैशबोर्ड लोड हो रहा है…" : "Loading dashboard…"}</p> : null}
      {error ? <div role="alert" className="rounded-xl bg-critical/10 px-3 py-2 text-sm text-critical">
        {error} <button type="button" disabled={loading} onClick={() => void load()} className="ml-3 underline">{lang === "hi" ? "फिर कोशिश करें" : "Retry"}</button>
      </div> : null}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t("issuesReported")} value={loaded ? reported : "—"} />
        <Stat label={t("issuesOpened")} value={loaded ? openIssues.length : "—"} />
        <Stat label={t("issuesSolved")} value={loaded ? solved : "—"} />
        <Stat
          label={t("healthScore")}
          value={healthScore ?? "—"}
          tone={healthScore === null ? undefined : healthScore >= 80 ? "#2f7d4a" : healthScore >= 65 ? "#c98412" : "#c43828"}
        />
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.55fr_1fr]">
      <section className="min-w-0 space-y-3" aria-label="Campus issue map">
        <div className="flex items-center justify-between"><h2 className="font-serif text-2xl text-navy">{lang === "hi" ? "आपके कैंपस का नक्शा" : "Around your campus"}</h2><span className="text-xs text-ink/55">{lang === "hi" ? "जानकारी के लिए पिन दबाएँ" : "Tap a pin to explore"}</span></div>
        {geoNote ? <p className="text-sm text-critical">{geoNote}</p> : null}
        <div className="relative">
          <CampusMap
            clusters={mapClusters}
            onMeToo={list === "open" ? onMeToo : undefined}
            boundary={boundary}
            userLocation={userLocation}
            recenter={recenter}
            youLabel={t("you")}
            banner={null}
            heat
            lockToCampus={Boolean(boundary)}
            heightClass="h-[360px] w-full md:h-[480px]"
          />
          <div className="pointer-events-none absolute bottom-3 left-3 z-[1000] flex flex-wrap gap-2">
            <Legend color={PIN_COLORS.critical} label={t("critical")} />
            <Legend color={PIN_COLORS.open} label={t("open")} />
            <Legend color={PIN_COLORS.on_it} label={t("onIt")} />
            <Legend color={PIN_COLORS.resolved} label={t("resolved")} />
          </div>
          <button
            type="button"
            disabled={locBusy}
            onClick={() => void recalibrate()}
            aria-label={t("recalibrate")}
            title={t("recalibrate")}
            className="absolute bottom-14 right-3 z-[1000] flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-white text-navy shadow-card disabled:opacity-60"
          >
            <LocateIcon spinning={locBusy} />
          </button>
        </div>
      </section>      <section id="issues" className="min-w-0 overflow-hidden rounded-2xl border border-rule bg-white/90 lg:mt-11">
        <div className="flex items-center gap-1 border-b border-rule p-2">
          <TabButton active={list === "open"} onClick={() => setList("open")} count={openIssues.length}>
            {t("opened")}
          </TabButton>
          <TabButton active={list === "closed"} onClick={() => setList("closed")} count={closedIssues.length}>
            {t("closed")}
          </TabButton>
        </div>
        {shown.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-ink/55">
            {list === "open" ? t("noOpen") : t("noClosed")}
          </p>
        ) : (
          <ul className="max-h-[27rem] divide-y divide-rule/70 overflow-y-auto">
            {shown.map((i) => (
              <li key={i.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                <div>
                  <Link href={`/ticket/${i.ticket_code}`} className="font-semibold hover:underline">
                    {i.title}
                  </Link>
                  <p className="text-sm text-ink/60">
                    {i.building} · {formatDateTime(list === "closed" && i.resolved_at ? i.resolved_at : i.created_at, locale)}
                  </p>
                  {list === "open" && i.eta_at ? (
                    <p className="mt-1 text-sm font-semibold">
                      <ExpectedFix etaAt={i.eta_at} compact />
                    </p>
                  ) : null}
                </div>
                <StatusBadge status={i.status} severity={i.severity} />
              </li>
            ))}
          </ul>
        )}
      </section>

      </div>

      {health?.places?.length ? (
        <section className="space-y-2">
          <h2 className="font-serif text-2xl text-navy">{t("buildingHealth")}</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {health.places.map((p) => (
              <HealthCard key={p.name} name={p.name} score={p.score} openCount={p.open_count} openLabel={t("openCount")} />
            ))}
          </div>
        </section>
      ) : null}

      {needsCheck.length ? (
        <section className="overflow-hidden rounded-2xl border-2 border-onit bg-onit/5">
          <div className="border-b border-onit/30 px-4 py-3">
            <h2 className="font-serif text-2xl text-navy">
              {t("needsCheck")} <span className="text-ink/40">{needsCheck.length}</span>
            </h2>
            <p className="mt-1 text-sm text-ink/65">{t("needsCheckLead")}</p>
          </div>
          <ul className="divide-y divide-onit/20">
            {needsCheck.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-semibold">{i.title}</p>
                  <p className="text-sm text-ink/60">
                    {i.building} · {i.department} ·{" "}
                    {i.verify_deadline_at ? t("checkFixClosesIn", { when: formatRemaining(i.verify_deadline_at, locale) }) : ""}
                  </p>
                </div>
                <Link
                  href={`/ticket/${i.ticket_code}`}
                  className="shrink-0 rounded-full bg-onit px-4 py-2 text-sm font-semibold text-white"
                >
                  {t("checkThisFix")}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-rule bg-white/80">
        <div className="border-b border-rule px-4 py-3">
          <h2 className="font-serif text-2xl text-navy">{t("fixedThisWeek")}</h2>
        </div>
        {(health?.fixedThisWeek || []).length === 0 ? (
          <p className="px-4 py-6 text-sm text-ink/55">{t("nothingFixed")}</p>
        ) : (
          <ul className="divide-y divide-rule/70">
            {(health?.fixedThisWeek || []).map((i) => (
              <li key={i.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                <div>
                  <Link href={`/ticket/${i.ticket_code}`} className="font-semibold hover:underline">
                    {i.ticket_code} · {i.title}
                  </Link>
                  <p className="text-sm text-ink/60">
                    {i.building} · {formatDateTime(i.resolved_at, locale)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <ProofBadge
                    state={i.proof}
                    label={
                      i.proof === "verified"
                        ? `${t("proofVerified")} · ${Math.max(1, i.verified_count)}`
                        : i.proof === "awaiting"
                          ? t("proofAwaiting")
                          : undefined
                    }
                  />
                  <span className="text-xs font-semibold text-ink/50">{i.department}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {note ? <p className="rounded-xl bg-resolved/10 px-3 py-2 text-sm text-resolved">{note}</p> : null}


    </div>
  );
}

function HealthCard({
  name,
  score,
  openCount,
  openLabel,
}: {
  name: string;
  score: number;
  openCount: number;
  openLabel: string;
}) {
  return (
    <div className="rounded-2xl border border-rule bg-white/80 px-3 py-3">
      <p className="text-sm font-semibold text-ink/60">{name}</p>
      <p
        className="mt-1 font-serif text-3xl font-semibold"
        style={{ color: score >= 80 ? "#2f7d4a" : score >= 65 ? "#c98412" : "#c43828" }}
      >
        {score}
      </p>
      <p className="mt-1 text-xs text-ink/50">
        {openCount} {openLabel}
      </p>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone?: string }) {
  return (
    <div className="cp-card cp-lift min-w-0 px-4 py-4">
      <p className="text-sm font-semibold text-ink/55">{label}</p>
      <p className="mt-2 font-serif text-4xl font-semibold leading-none md:text-5xl" style={tone ? { color: tone } : undefined}>
        {value}
      </p>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-1.5 text-sm font-semibold ${active ? "bg-navy text-paper" : "text-ink/70 hover:bg-paper"}`}
    >
      {children} <span className={active ? "text-paper/70" : "text-ink/40"}>{count}</span>
    </button>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="pointer-events-none inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-ink/75 shadow-card">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function LocateIcon({ spinning }: { spinning?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-5 w-5 ${spinning ? "animate-spin" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3" strokeLinecap="round" />
    </svg>
  );
}
