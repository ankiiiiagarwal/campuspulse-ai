"use client";

import { AdminNav } from "@/components/AdminNav";
import { ConfirmCard } from "@/components/ConfirmCard";
import { ResolutionDateTime } from "@/components/ResolutionDateTime";
import { PriorityChip } from "@/components/PriorityChip";
import { DEMO_DEPT_EMAIL, DEPARTMENTS } from "@/lib/departments";
import { formatDateTime, formatHours, requestBrowserLocation, staffDeskHeaders, stripExif } from "@/lib/client";
import { etaFromLocal, etaLocalFields, formatExpectedBy, isMissedEta } from "@/lib/eta";
import { downloadQueueCsv } from "@/lib/queue-csv";
import { downloadQueuePdf } from "@/lib/queue-pdf";
import { openDirections } from "@/lib/navigate";
import { isOverdue } from "@/lib/scoring";
import type { Department, Hotspot, IssueWithCluster, ProofStats, StaffSession, TrailStats } from "@/lib/types";
import { formatRate, proofState } from "@/lib/verification";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export function StaffDesk({ desk, demo = false }: { desk: "admin" | "department"; demo?: boolean }) {
  const [email, setEmail] = useState(desk === "admin" ? "admin@campus.local" : DEMO_DEPT_EMAIL.it);
  const [password, setPassword] = useState(demo ? "campuspulse-demo" : "");
  const [session, setSession] = useState<StaffSession | null>(null);
  const [ready, setReady] = useState(false);
  const [issues, setIssues] = useState<IssueWithCluster[]>([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function refresh() {
    const s = await fetch(`/api/admin/session?desk=${desk}`, {
      cache: "no-store",
      headers: staffDeskHeaders(desk),
    });
    const sData = (await s.json()) as { session?: StaffSession | null };
    const next = sData.session || null;
    setSession(next);

    if (!next || next.role !== desk) {
      setIssues([]);
      setReady(true);
      return;
    }

    const headers = staffDeskHeaders(desk);
    const i = await fetch("/api/issues", { cache: "no-store", headers });
    const iData = await i.json();
    setIssues(iData.issues || []);
    setReady(true);
  }

  useEffect(() => {
    refresh().catch(() => setReady(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desk]);

  useEffect(() => {
    if (!session) return;
    const tick = () => {
      void refresh();
    };
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);
    const id = window.setInterval(tick, 8000);
    return () => {
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", tick);
      window.clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desk, session?.email, session?.role]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: staffDeskHeaders(desk, { "Content-Type": "application/json" }),
      body: JSON.stringify({ email, password, desk }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Login failed");
      return;
    }
    const logged = data.session as StaffSession | undefined;
    if (desk === "admin" && logged?.role !== "admin") {
      setError("That account is a department desk. Use the Dept login.");
      return;
    }
    if (desk === "department" && logged?.role !== "department") {
      setError("That account is super-admin. Use the Admin login.");
      return;
    }
    await refresh();
  }

  async function logout() {
    await fetch("/api/admin/logout", {
      method: "POST",
      headers: staffDeskHeaders(desk, { "Content-Type": "application/json" }),
      body: JSON.stringify({ desk }),
    });
    setSession(null);
    setIssues([]);
  }

  async function patch(id: string, body: Record<string, unknown>) {
    setBusyId(id);
    setError("");
    try {
      const res = await fetch(`/api/issues/${id}`, {
        method: "PATCH",
        headers: staffDeskHeaders(desk, { "Content-Type": "application/json" }),
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
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
        headers: staffDeskHeaders(desk, { "Content-Type": "application/json" }),
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

  if (!ready) return <p className="text-ink/60">{desk === "admin" ? "Loading admin…" : "Loading department desk…"}</p>;

  if (!session) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-rule bg-white/80 p-6 shadow-card">
        <h1 className="font-serif text-3xl text-navy">{desk === "admin" ? "Admin" : "Department"}</h1>
        <p className="mt-2 text-sm text-ink/60">
          Only one staff desk can be signed in on this browser. Signing in here signs out the other.
        </p>
        <form onSubmit={(e) => void login(e)} className="mt-5 space-y-3">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="text"
            autoComplete="username"
            inputMode="email"
            className="w-full rounded-xl border border-rule px-3 py-2"
            placeholder={desk === "admin" ? "admin@campus.local" : "it@campus.local"}
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            className="w-full rounded-xl border border-rule px-3 py-2"
            placeholder="Password"
          />
          {error ? <p className="text-sm text-critical">{error}</p> : null}
          <button className="w-full rounded-full bg-navy py-2.5 font-semibold text-paper">Sign in</button>
        </form>
      </div>
    );
  }

  const isAdmin = desk === "admin" && session.role === "admin";

  if (isAdmin) {
    return (
      <AdminOperations
        issues={issues}
        error={error}
        busyId={busyId}
        onLogout={() => void logout()}
        onAssign={(id, department) => void patch(id, { status: "assigned", department })}
        onClose={(id) => void patch(id, { status: "resolved" })}
      />
    );
  }

  return (
    <DeptOperations
      departmentLabel={session.departmentLabel || "Department"}
      issues={issues}
      error={error}
      busyId={busyId}
      onLogout={() => void logout()}
      onStart={(id, workerName, etaAt) => void patch(id, { status: "on_it", worker_name: workerName, eta_at: etaAt })}
      onChangeEta={(id, etaAt) => void patch(id, { eta_at: etaAt })}
      onRevert={(id) => void patch(id, { status: "assigned", worker_name: null, eta_at: null })}
      onResolve={(issue, file) => void resolveWithPhoto(issue, file)}
    />
  );
}

function deptStatusLabel(issue: IssueWithCluster): string {
  if (issue.status === "assigned") {
    return issue.reopen_count > 0 ? "Sent back — not started" : "Not started";
  }
  if (issue.status === "on_it") return issue.worker_name ? `On it · ${issue.worker_name}` : "On it";
  return issue.status;
}

function isQueueAlert(issue: IssueWithCluster): boolean {
  return isOverdue(issue) || isMissedEta(issue) || proofState(issue) === "reopened";
}

function AlertBadges({ issue }: { issue: IssueWithCluster }) {
  const proof = proofState(issue);
  return (
    <>
      {issue.reopen_count > 0 && issue.status !== "resolved" ? (
        <span className="ml-2 font-semibold text-critical">
          Sent back{issue.reopen_count > 1 ? ` ${issue.reopen_count}×` : ""}
        </span>
      ) : null}
      {proof === "awaiting" ? <span className="ml-2 font-semibold text-onit">Awaiting check</span> : null}
      {proof === "unconfirmed" ? <span className="ml-2 font-semibold text-ink/50">Unconfirmed</span> : null}
      {proof === "verified" ? <span className="ml-2 font-semibold text-resolved">Verified</span> : null}
      {issue.escalated_at && issue.status !== "resolved" ? (
        <span className="ml-2 font-semibold text-critical">Escalated</span>
      ) : null}
      {isOverdue(issue) ? <span className="ml-2 font-semibold text-critical">Overdue</span> : null}
      {isMissedEta(issue) ? <span className="ml-2 font-semibold text-critical">Missed</span> : null}
    </>
  );
}

function ExpectedCell({ issue }: { issue: IssueWithCluster }) {
  if (!issue.eta_at || issue.status === "resolved") return <span>—</span>;
  return (
    <span className={`font-semibold ${isMissedEta(issue) ? "text-critical" : "text-onit"}`}>
      {formatExpectedBy(issue.eta_at)}
    </span>
  );
}

function matchesQuery(issue: IssueWithCluster, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [
    issue.ticket_code,
    issue.title,
    issue.description,
    issue.building,
    issue.department,
    issue.category,
    issue.worker_name,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(q);
}

async function goToPin(issue: IssueWithCluster) {
  const gps = await requestBrowserLocation({ enableHighAccuracy: true, maximumAge: 15000, timeout: 8000 });
  openDirections(gps.ok ? { lat: gps.lat, lng: gps.lng } : null, { lat: issue.lat, lng: issue.lng });
}

function DeptOperations({
  departmentLabel,
  issues,
  error,
  busyId,
  onLogout,
  onStart,
  onChangeEta,
  onRevert,
  onResolve,
}: {
  departmentLabel: string;
  issues: IssueWithCluster[];
  error: string;
  busyId: string | null;
  onLogout: () => void;
  onStart: (id: string, workerName: string, etaAt: string) => void;
  onChangeEta: (id: string, etaAt: string) => void;
  onRevert: (id: string) => void;
  onResolve: (issue: IssueWithCluster, file?: File) => void;
}) {
  const assigned = issues
    .filter((i) => i.status === "assigned" || i.status === "on_it")
    .sort((a, b) => {
      const aLate = isQueueAlert(a) ? 0 : 1;
      const bLate = isQueueAlert(b) ? 0 : 1;
      if (aLate !== bLate) return aLate - bLate;
      return b.created_at.localeCompare(a.created_at);
    });
  const overdueCount = assigned.filter((i) => isOverdue(i)).length;
  const missedCount = assigned.filter((i) => isMissedEta(i)).length;
  const [dialog, setDialog] = useState<
    | { kind: "onit"; issue: IssueWithCluster; workerName: string; date: string; time: string }
    | { kind: "eta"; issue: IssueWithCluster; date: string; time: string }
    | { kind: "revert"; issue: IssueWithCluster }
    | { kind: "resolve"; issue: IssueWithCluster }
    | null
  >(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  function pickPhoto(file?: File) {
    setPhoto(file || null);
    setPreview(file ? URL.createObjectURL(file) : null);
  }

  function closeDialog() {
    setDialog(null);
    pickPhoto();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-4xl text-navy">{departmentLabel}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!assigned.length}
            onClick={() =>
              downloadQueueCsv(assigned, {
                filenameStem: departmentLabel.toLowerCase().replace(/\s+/g, "-"),
              })
            }
            className="rounded-full border border-rule px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            Download CSV
          </button>
          <button
            type="button"
            disabled={!assigned.length}
            onClick={() =>
              void downloadQueuePdf(assigned, {
                title: `CampusPulse · ${departmentLabel}`,
                filenameStem: departmentLabel.toLowerCase().replace(/\s+/g, "-"),
                note: "Assigned issues",
              })
            }
            className="rounded-full border border-rule px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            Download PDF
          </button>
          <button onClick={onLogout} className="rounded-full border border-rule px-4 py-2 text-sm font-semibold">
            Sign out
          </button>
        </div>
      </div>

      {error ? <p className="text-sm text-critical">{error}</p> : null}

      <section className="overflow-hidden rounded-2xl border border-rule bg-white/80">
        <div className="border-b border-rule px-4 py-3">
          <h2 className="font-serif text-2xl text-navy">Assigned issues</h2>
          {overdueCount ? <p className="mt-1 text-sm font-semibold text-critical">{overdueCount} overdue (open over 72 hours)</p> : null}
          {missedCount ? <p className="mt-1 text-sm font-semibold text-critical">{missedCount} past the expected time</p> : null}
        </div>
        <ul className="divide-y divide-rule/70 md:hidden">
          {assigned.length === 0 ? (
            <li className="px-4 py-6 text-sm text-ink/55">No issues assigned to this department yet.</li>
          ) : null}
          {assigned.map((i) => (
            <li key={i.id} className={`space-y-3 px-4 py-4 ${isQueueAlert(i) ? "bg-critical/10" : ""}`}>
              <div>
                <Link href={`/ticket/${i.ticket_code}`} className="font-semibold hover:underline">
                  {i.title}
                </Link>
                <p className="text-xs text-ink/55">
                  {i.ticket_code} · {i.building}
                  <AlertBadges issue={i} />
                </p>
                <p className="mt-1 text-sm">{deptStatusLabel(i)}</p>
                <p className="text-sm text-ink/60">
                  {formatDateTime(i.created_at)} · <ExpectedCell issue={i} />
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {i.status === "assigned" ? (
                  <button
                    type="button"
                    disabled={busyId === i.id}
                    onClick={() => setDialog({ kind: "onit", issue: i, workerName: "", date: "", time: "" })}
                    className="rounded-full bg-onit px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    On it
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={busyId === i.id}
                      onClick={() => setDialog({ kind: "revert", issue: i })}
                      className="rounded-full border border-rule px-3 py-1.5 text-xs font-semibold"
                    >
                      Not started
                    </button>
                    <button
                      type="button"
                      disabled={busyId === i.id}
                      onClick={() => setDialog({ kind: "eta", issue: i, ...etaLocalFields(i.eta_at) })}
                      className="rounded-full border border-rule px-3 py-1.5 text-xs font-semibold"
                    >
                      Change time
                    </button>
                  </>
                )}
                {i.status === "on_it" ? (
                  <button
                    type="button"
                    disabled={busyId === i.id}
                    onClick={() => {
                      pickPhoto();
                      setDialog({ kind: "resolve", issue: i });
                    }}
                    className="rounded-full bg-resolved px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    Resolve
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => void goToPin(i)}
                  className="rounded-full bg-navy px-3 py-1.5 text-xs font-semibold text-paper"
                >
                  Go to pin
                </button>
              </div>
            </li>
          ))}
        </ul>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-paper/80 text-xs uppercase tracking-wide text-ink/50">
              <tr>
                <th className="px-3 py-2">Issue</th>
                <th className="px-3 py-2">Time</th>
                <th className="px-3 py-2">Expected by</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">On it</th>
                <th className="px-3 py-2">Resolve</th>
                <th className="px-3 py-2">Go to pin</th>
              </tr>
            </thead>
            <tbody>
              {assigned.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-ink/55">
                    No issues assigned to this department yet.
                  </td>
                </tr>
              ) : null}
              {assigned.map((i) => (
                <tr key={i.id} className={`border-t border-rule/70 ${isQueueAlert(i) ? "bg-critical/10" : ""}`}>
                  <td className="px-3 py-3">
                    <Link href={`/ticket/${i.ticket_code}`} className="font-semibold hover:underline">
                      {i.title}
                    </Link>
                    <p className="text-xs text-ink/55">
                      {i.ticket_code} · {i.building}
                      <AlertBadges issue={i} />
                    </p>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">{formatDateTime(i.created_at)}</td>
                  <td className="px-3 py-3">
                    <ExpectedCell issue={i} />
                  </td>
                  <td className="px-3 py-3 font-semibold">{deptStatusLabel(i)}</td>
                  <td className="px-3 py-3">
                    {i.status === "assigned" ? (
                      <button
                        type="button"
                        disabled={busyId === i.id}
                        onClick={() => setDialog({ kind: "onit", issue: i, workerName: "", date: "", time: "" })}
                        className="rounded-full bg-onit px-3 py-1 text-xs font-semibold text-white"
                      >
                        On it
                      </button>
                    ) : (
                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          disabled={busyId === i.id}
                          onClick={() => setDialog({ kind: "revert", issue: i })}
                          className="rounded-full border border-rule px-3 py-1 text-xs font-semibold"
                        >
                          Not started
                        </button>
                        <button
                          type="button"
                          disabled={busyId === i.id}
                          onClick={() => setDialog({ kind: "eta", issue: i, ...etaLocalFields(i.eta_at) })}
                          className="rounded-full border border-rule px-3 py-1 text-xs font-semibold"
                        >
                          Change time
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {i.status === "on_it" ? (
                      <button
                        type="button"
                        disabled={busyId === i.id}
                        onClick={() => {
                          pickPhoto();
                          setDialog({ kind: "resolve", issue: i });
                        }}
                        className="rounded-full bg-resolved px-3 py-1 text-xs font-semibold text-white"
                      >
                        Resolve
                      </button>
                    ) : (
                      <span className="text-xs text-ink/40">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      onClick={() => void goToPin(i)}
                      className="rounded-full bg-navy px-3 py-1 text-xs font-semibold text-paper"
                    >
                      Go to pin
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {dialog?.kind === "onit" ? (
        <ConfirmCard
          title="Who is on this work?"
          body={`Name the person on “${dialog.issue.title}” and choose the date and time it should be fixed. Students, admin, and the ticket page will all see that time.`}
          confirmLabel="Confirm"
          confirmDisabled={!dialog.workerName.trim() || !etaFromLocal(dialog.date, dialog.time)}
          busy={busyId === dialog.issue.id}
          onCancel={closeDialog}
          onConfirm={() => {
            const name = dialog.workerName.trim();
            const eta = etaFromLocal(dialog.date, dialog.time);
            if (!name || !eta) return;
            onStart(dialog.issue.id, name, eta);
            closeDialog();
          }}
        >
          <div className="space-y-3">
            <label className="block text-sm">
              <span className="font-semibold">Person name</span>
              <input
                autoFocus
                value={dialog.workerName}
                onChange={(e) => setDialog({ ...dialog, workerName: e.target.value })}
                className="mt-1 w-full rounded-xl border border-rule px-3 py-2"
                placeholder="e.g. Rahul Kumar"
              />
            </label>
            <ResolutionDateTime date={dialog.date} time={dialog.time}
              onChange={value => setDialog({ ...dialog, ...value })} />
          </div>
        </ConfirmCard>
      ) : null}

      {dialog?.kind === "eta" ? (
        <ConfirmCard
          title="Change the expected time?"
          body={`Students and admin will see a new “may be fixed by” time for “${dialog.issue.title}”. ${dialog.issue.worker_name || "The worker"} stays on the job.`}
          confirmLabel="Update time"
          confirmDisabled={!etaFromLocal(dialog.date, dialog.time)}
          busy={busyId === dialog.issue.id}
          onCancel={closeDialog}
          onConfirm={() => {
            const eta = etaFromLocal(dialog.date, dialog.time);
            if (!eta) return;
            onChangeEta(dialog.issue.id, eta);
            closeDialog();
          }}
        >
          <div className="space-y-3">
            <ResolutionDateTime date={dialog.date} time={dialog.time}
              onChange={value => setDialog({ ...dialog, ...value })} />
          </div>
        </ConfirmCard>
      ) : null}

      {dialog?.kind === "revert" ? (
        <ConfirmCard
          title="Mark as not started?"
          body={`This takes “${dialog.issue.title}” off ${dialog.issue.worker_name || "the worker"} and sets it back to not started.`}
          confirmLabel="Confirm"
          busy={busyId === dialog.issue.id}
          onCancel={closeDialog}
          onConfirm={() => {
            onRevert(dialog.issue.id);
            closeDialog();
          }}
        />
      ) : null}

      {dialog?.kind === "resolve" ? (
        <ConfirmCard
          title="Resolve this issue?"
          body={`Confirm that “${dialog.issue.title}” is fixed. Do you have a photo of the fixed work?`}
          confirmLabel={photo ? "Confirm resolve" : "Confirm without photo"}
          busy={busyId === dialog.issue.id}
          onCancel={closeDialog}
          onConfirm={() => {
            onResolve(dialog.issue, photo || undefined);
            closeDialog();
          }}
        >
          <p className="mb-2 text-sm font-semibold">Photo of the fixed issue</p>
          <label className="block cursor-pointer rounded-2xl border border-dashed border-rule bg-paper/50 px-4 py-6 text-center text-sm font-semibold text-ink/70">
            {photo ? "Replace photo" : "Add photo of the fix (optional)"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => pickPhoto(e.target.files?.[0])}
            />
          </label>
          {preview ? <img src={preview} alt="Fixed issue preview" className="mt-3 max-h-40 w-full rounded-xl object-cover" /> : null}
        </ConfirmCard>
      ) : null}
    </div>
  );
}

const ASSIGN_DEPTS: Department[] = DEPARTMENTS;

function progressLabel(issue: IssueWithCluster): string {
  if (issue.status === "open") return "Unassigned";
  if (issue.status === "assigned") {
    return issue.reopen_count > 0 ? "Sent back by students" : "Assigned — not started";
  }
  if (issue.status === "on_it") return issue.worker_name ? `Working · ${issue.worker_name}` : "Department working";
  const proof = proofState(issue);
  if (proof === "verified") return "Closed — verified";
  if (proof === "awaiting") return "Closed — awaiting check";
  return "Closed — unconfirmed";
}

type StatusFilter =
  | "all"
  | "open"
  | "assigned"
  | "on_it"
  | "resolved"
  | "overdue"
  | "missed"
  | "sent_back"
  | "awaiting_check"
  | "unconfirmed";
type SortKey = "priority" | "newest" | "oldest" | "people" | "people_asc";

const STATUS_FILTERS: Array<{ id: StatusFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "open", label: "Unassigned" },
  { id: "assigned", label: "Assigned" },
  { id: "on_it", label: "On it" },
  { id: "resolved", label: "Closed" },
  { id: "overdue", label: "Overdue" },
  { id: "missed", label: "Missed" },
  { id: "sent_back", label: "Sent back" },
  { id: "awaiting_check", label: "Awaiting check" },
  { id: "unconfirmed", label: "Unconfirmed" },
];

function peopleCount(issue: IssueWithCluster): number {
  return issue.report_count + issue.me_too_count;
}

function proofTone(rate: number | null): string {
  if (rate == null) return "#1e2a3a";
  if (rate >= 0.8) return "#2f7d4a";
  if (rate >= 0.5) return "#c98412";
  return "#c43828";
}

function AdminOperations({
  issues,
  error,
  busyId,
  onLogout,
  onAssign,
  onClose,
}: {
  issues: IssueWithCluster[];
  error: string;
  busyId: string | null;
  onLogout: () => void;
  onAssign: (id: string, department: Department) => void;
  onClose: (id: string) => void;
}) {
  const [department, setDepartment] = useState<"all" | Department>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("priority");
  const [query, setQuery] = useState("");
  const [trail, setTrail] = useState<TrailStats | null>(null);
  const [proof, setProof] = useState<ProofStats | null>(null);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [dialog, setDialog] = useState<
    | { kind: "assign"; issue: IssueWithCluster; department: Department }
    | { kind: "close"; issue: IssueWithCluster }
    | null
  >(null);

  useEffect(() => {
    fetch("/api/health", { cache: "no-store", headers: staffDeskHeaders("admin") })
      .then((r) => r.json())
      .then((data) => {
        setTrail(data.trail || null);
        setProof(data.proof || null);
        setHotspots(data.hotspots || []);
      })
      .catch(() => {
        setTrail(null);
        setProof(null);
        setHotspots([]);
      });
  }, []);

  const shown = useMemo(() => {
    const rows = issues.filter((i) => {
      if (!matchesQuery(i, query)) return false;
      if (department !== "all" && i.department !== department) return false;
      if (status === "overdue") return isOverdue(i);
      if (status === "missed") return isMissedEta(i);
      if (status === "sent_back") return proofState(i) === "reopened";
      if (status === "awaiting_check") return proofState(i) === "awaiting";
      if (status === "unconfirmed") return proofState(i) === "unconfirmed";
      if (status !== "all" && i.status !== status) return false;
      return true;
    });
    return [...rows].sort((a, b) => {
      if (sort === "oldest") return a.created_at.localeCompare(b.created_at);
      if (sort === "newest") return b.created_at.localeCompare(a.created_at);
      if (sort === "people") return peopleCount(b) - peopleCount(a);
      if (sort === "people_asc") return peopleCount(a) - peopleCount(b);
      return b.priority - a.priority || b.created_at.localeCompare(a.created_at);
    });
  }, [issues, department, status, sort, query]);

  const filtered = department !== "all" || status !== "all" || sort !== "priority" || Boolean(query.trim());
  const overdueCount = issues.filter((i) => isOverdue(i)).length;
  const missedCount = issues.filter((i) => isMissedEta(i)).length;
  const sentBackCount = issues.filter((i) => proofState(i) === "reopened").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/50">Admin</p>
          <h1 className="font-serif text-4xl text-navy">Queue</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AdminNav />
          <button onClick={onLogout} className="rounded-full border border-rule px-4 py-2 text-sm font-semibold">
            Sign out
          </button>
        </div>
      </div>

      {error ? <p className="text-sm text-critical">{error}</p> : null}

      {trail ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-rule bg-white/80 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">Avg time to assign</p>
            <p className="mt-1 font-serif text-2xl text-navy">{formatHours(trail.avg_assign_hrs)}</p>
            <p className="text-xs text-ink/50">{trail.assigned_or_resolved} tickets</p>
          </div>
          <div className="rounded-2xl border border-rule bg-white/80 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">Avg time to close</p>
            <p className="mt-1 font-serif text-2xl text-navy">{formatHours(trail.avg_resolve_hrs)}</p>
            <p className="text-xs text-ink/50">{trail.resolved_count} closed</p>
          </div>
          <div className="rounded-2xl border border-rule bg-white/80 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">Fix claims confirmed</p>
            <p
              className="mt-1 font-serif text-2xl"
              style={{ color: proofTone(proof?.verified_rate ?? null) }}
            >
              {formatRate(proof?.verified_rate ?? null)}
            </p>
            <p className="text-xs text-ink/50">
              {proof ? `${proof.verified} of ${proof.verified + proof.disputed} judged by students` : "No claims yet"}
            </p>
          </div>
          <div className="rounded-2xl border border-rule bg-white/80 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">Sent back</p>
            <p className={`mt-1 font-serif text-2xl ${sentBackCount ? "text-critical" : "text-navy"}`}>
              {sentBackCount}
            </p>
            <p className="text-xs text-ink/50">Students rejected the fix</p>
          </div>
          <div className="rounded-2xl border border-rule bg-white/80 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">Overdue</p>
            <p className="mt-1 font-serif text-2xl text-navy">{overdueCount}</p>
            <p className="text-xs text-ink/50">Open or assigned over 72 hours</p>
          </div>
          <div className="rounded-2xl border border-rule bg-white/80 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">Missed</p>
            <p className="mt-1 font-serif text-2xl text-navy">{missedCount}</p>
            <p className="text-xs text-ink/50">Past the promised fix time</p>
          </div>
        </div>
      ) : overdueCount || missedCount ? (
        <div className="grid grid-cols-2 gap-3">
          {overdueCount ? (
            <div className="rounded-2xl border border-rule bg-white/80 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">Overdue</p>
              <p className="mt-1 font-serif text-2xl text-navy">{overdueCount}</p>
            </div>
          ) : null}
          {missedCount ? (
            <div className="rounded-2xl border border-rule bg-white/80 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">Missed</p>
              <p className="mt-1 font-serif text-2xl text-navy">{missedCount}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      {hotspots.length ? (
        <section className="overflow-hidden rounded-2xl border border-rule bg-white/80">
          <div className="border-b border-rule px-4 py-3">
            <h2 className="font-serif text-2xl text-navy">Hotspots</h2>
            <p className="mt-1 text-sm text-ink/55">Same place and category, 3 or more times in 14 days</p>
          </div>
          <ul className="divide-y divide-rule/70">
            {hotspots.map((h) => (
              <li key={`${h.building}-${h.category}`} className="px-4 py-3">
                <p className="font-semibold">
                  {h.building} · {h.category}
                </p>
                <p className="text-sm text-ink/60">
                  {h.count} reports in 14 days · {h.open_count} still open
                  {h.ticket_code ? ` · ${h.ticket_code}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="space-y-3 rounded-2xl border border-rule bg-white/80 p-4">
        <label className="block text-sm">
          <span className="font-semibold">Search</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="mt-1 w-full rounded-xl border border-rule bg-paper/40 px-3 py-2 outline-none ring-navy/20 focus:ring-2"
            placeholder="CP-1006, wifi, hostel…"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStatus(s.id)}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
                status === s.id ? "bg-navy text-paper" : "border border-rule text-ink/70 hover:bg-paper"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[12rem] flex-1 text-sm">
            <span className="font-semibold">Department</span>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value as "all" | Department)}
              className="mt-1 w-full rounded-xl border border-rule bg-paper/40 px-3 py-2 outline-none ring-navy/20 focus:ring-2"
            >
              <option value="all">All departments</option>
              {ASSIGN_DEPTS.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-[12rem] flex-1 text-sm">
            <span className="font-semibold">Sort</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="mt-1 w-full rounded-xl border border-rule bg-paper/40 px-3 py-2 outline-none ring-navy/20 focus:ring-2"
            >
              <option value="priority">Priority — highest first</option>
              <option value="newest">Date — newest first</option>
              <option value="oldest">Date — oldest first</option>
              <option value="people">People reported — most first</option>
              <option value="people_asc">People reported — fewest first</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() =>
              downloadQueueCsv(shown, {
                filenameStem: "queue",
              })
            }
            disabled={!shown.length}
            className="rounded-full border border-rule px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            Download CSV
          </button>
          <button
            type="button"
            onClick={() =>
              void downloadQueuePdf(shown, {
                title: "CampusPulse admin queue",
                filenameStem: "queue",
                note: filtered
                  ? `${department === "all" ? "All departments" : department} · ${STATUS_FILTERS.find((s) => s.id === status)?.label || status}`
                  : undefined,
              })
            }
            disabled={!shown.length}
            className="rounded-full border border-rule px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            Download PDF
          </button>
          {filtered ? (
            <button
              type="button"
              onClick={() => {
                setDepartment("all");
                setStatus("all");
                setSort("priority");
                setQuery("");
              }}
              className="rounded-full border border-rule px-4 py-2 text-sm font-semibold"
            >
              Clear filters
            </button>
          ) : null}
        </div>
      </div>

      <AdminIssueTable
        title={`Queue · ${shown.length}`}
        empty="No issues match these filters."
        rows={shown}
        busyId={busyId}
        onAssign={(issue) =>
          setDialog({
            kind: "assign",
            issue,
            department: DEPARTMENTS.includes(issue.department) ? issue.department : "Campus",
          })
        }
        onClose={(issue) => setDialog({ kind: "close", issue })}
      />

      {dialog?.kind === "assign" ? (
        <ConfirmCard
          title="Assign this issue?"
          body={`Send “${dialog.issue.title}” to a department. They will see it on their desk.`}
          confirmLabel="Assign"
          busy={busyId === dialog.issue.id}
          onCancel={() => setDialog(null)}
          onConfirm={() => {
            onAssign(dialog.issue.id, dialog.department);
            setDialog(null);
          }}
        >
          <label className="block text-sm">
            <span className="font-semibold">Department</span>
            <select
              value={dialog.department}
              onChange={(e) => setDialog({ ...dialog, department: e.target.value as Department })}
              className="mt-1 w-full rounded-xl border border-rule px-3 py-2"
            >
              {ASSIGN_DEPTS.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </label>
        </ConfirmCard>
      ) : null}

      {dialog?.kind === "close" ? (
        <ConfirmCard
          title="Close this issue?"
          body={`This marks “${dialog.issue.title}” as closed and moves it to past issues.`}
          confirmLabel="Close"
          busy={busyId === dialog.issue.id}
          onCancel={() => setDialog(null)}
          onConfirm={() => {
            onClose(dialog.issue.id);
            setDialog(null);
          }}
        />
      ) : null}
    </div>
  );
}

function AdminIssueTable({
  title,
  empty,
  rows,
  busyId,
  onAssign,
  onClose,
}: {
  title: string;
  empty: string;
  rows: IssueWithCluster[];
  busyId: string | null;
  onAssign?: (issue: IssueWithCluster) => void;
  onClose?: (issue: IssueWithCluster) => void;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-rule bg-white/80">
      <div className="border-b border-rule px-4 py-3">
        <h2 className="font-serif text-2xl text-navy">{title}</h2>
      </div>
      <div className="divide-y divide-rule xl:hidden">
        {!rows.length && <p className="p-4 text-sm text-ink/60">{empty}</p>}
        {rows.map(i => <article key={i.id} className={`space-y-3 p-4 ${isQueueAlert(i) ? "bg-critical/5" : ""}`}>
          <div className="flex items-start justify-between gap-2"><Link href={`/ticket/${i.ticket_code}`} className="min-w-0 font-semibold text-navy">{i.title}</Link><PriorityChip issue={i} /></div>
          <p className="text-xs text-ink/60">{i.ticket_code} · {i.building}<AlertBadges issue={i} /></p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink/65"><span>{i.department}</span><span>{i.report_count + i.me_too_count} affected</span><span>{formatDateTime(i.created_at)}</span></div>
          <p className="text-sm font-semibold">{progressLabel(i)}</p><ExpectedCell issue={i} />
          {i.status !== "resolved" && <div className="flex flex-wrap gap-2">
            {onAssign && <button disabled={busyId === i.id} onClick={() => onAssign(i)} className="shrink-0 whitespace-nowrap rounded-full border border-rule px-4 py-2 text-sm font-semibold disabled:opacity-50">Assign</button>}
            {onClose && <button disabled={busyId === i.id} onClick={() => onClose(i)} className="shrink-0 whitespace-nowrap rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Close</button>}
          </div>}
        </article>)}
      </div>
      <div className="hidden overflow-x-auto xl:block">
        <table className="w-full min-w-[1040px] table-fixed text-left text-sm [overflow-wrap:normal]">
          <colgroup>
            <col />
            <col className="w-[84px]" />
            <col className="w-[72px]" />
            <col className="w-[76px]" />
            <col className="w-[132px]" />
            <col className="w-[164px]" />
            <col className="w-[160px]" />
            <col className="w-[112px]" />
          </colgroup>
          <thead className="whitespace-nowrap bg-paper/80 text-xs uppercase tracking-wide text-ink/50">
            <tr>
              <th scope="col" className="px-3 py-3">Issue</th>
              <th scope="col" className="px-3 py-3">Dept</th>
              <th scope="col" className="px-3 py-3">People</th>
              <th scope="col" className="px-3 py-3">Priority</th>
              <th scope="col" className="px-3 py-3">Time</th>
              <th scope="col" className="px-3 py-3">Expected by</th>
              <th scope="col" className="px-3 py-3">Status</th>
              <th scope="col" className="px-3 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-ink/55">
                  {empty}
                </td>
              </tr>
            ) : null}
            {rows.map((i) => (
              <tr key={i.id} className={`border-t border-rule/70 ${isQueueAlert(i) ? "bg-critical/10" : ""}`}>
                <td className="px-3 py-3">
                  <Link href={`/ticket/${i.ticket_code}`} className="font-semibold hover:underline">
                    {i.title}
                  </Link>
                  <p className="text-xs text-ink/55">
                    {i.ticket_code} · {i.building}
                    <AlertBadges issue={i} />
                  </p>
                </td>
                <td className="whitespace-nowrap px-3 py-3">{i.department}</td>
                <td className="px-3 py-3">{i.report_count + i.me_too_count}</td>
                <td className="px-3 py-3">
                  <PriorityChip issue={i} />
                </td>
                <td className="px-3 py-3">{formatDateTime(i.created_at)}</td>
                <td className="px-3 py-3">
                  <ExpectedCell issue={i} />
                </td>
                <td className="px-3 py-3">
                  <p className="font-semibold">{progressLabel(i)}</p>
                  {i.status === "assigned" ? <p className="text-xs text-ink/55">Waiting for {i.department}</p> : null}
                  {i.status === "on_it" ? (
                    <p className="text-xs text-onit">
                      {i.worker_name ? `${i.worker_name} · ${i.department}` : `${i.department} started work`}
                    </p>
                  ) : null}
                </td>
                <td className="px-3 py-3">
                  {i.status !== "resolved" && (onAssign || onClose) ? (
                    <div className="flex flex-col items-stretch gap-2">
                      {onAssign ? (
                        <button
                          type="button"
                          disabled={busyId === i.id}
                          onClick={() => onAssign(i)}
                          className="min-h-10 w-full min-w-20 shrink-0 whitespace-nowrap rounded-xl bg-amberpin/20 px-3 py-2 text-xs font-semibold disabled:opacity-50"
                        >
                          Assign
                        </button>
                      ) : null}
                      {onClose ? (
                        <button
                          type="button"
                          disabled={busyId === i.id}
                          onClick={() => onClose(i)}
                          className="min-h-10 w-full min-w-20 shrink-0 whitespace-nowrap rounded-xl bg-navy px-3 py-2 text-xs font-semibold text-paper disabled:opacity-50"
                        >
                          Close
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    <span className="text-xs text-ink/45">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
