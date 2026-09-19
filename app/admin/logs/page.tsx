"use client";

import { AdminHeader } from "@/components/AdminHeader";
import { staffDeskHeaders } from "@/lib/client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

interface LogRow {
  id: string;
  at: string;
  actor_email: string;
  actor_role: string;
  action: string;
  target?: string;
  detail: string;
  ip?: string;
  hash: string;
}

const ACTION_LABEL: Record<string, string> = {
  "admin.login": "Admin signed in",
  "admin.login_failed": "Admin sign-in failed",
  "admin.logout": "Admin signed out",
  "dept.login": "Department signed in",
  "dept.login_failed": "Department sign-in failed",
  "dept.logout": "Department signed out",
  "admin.dept_password_change": "Department password changed",
  "admin.campus_save": "Campus area saved",
  "admin.campus_clear": "Campus area removed",
  "staff.issue_update": "Issue updated",
};

export default function AdminLogsPage() {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<{ email: string } | null>(null);
  const [entries, setEntries] = useState<LogRow[]>([]);
  const [intact, setIntact] = useState(true);
  const [brokenAt, setBrokenAt] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    (async () => {
      const s = await fetch("/api/admin/session?desk=admin", {
        cache: "no-store",
        headers: staffDeskHeaders("admin"),
      });
      const sData = await s.json();
      const staff = sData.admin || (sData.session?.role === "admin" ? sData.session : null);
      setSession(staff);
      if (!staff) {
        setReady(true);
        return;
      }
      const res = await fetch("/api/admin/audit", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load log");
      setEntries(data.entries || []);
      setIntact(data.intact !== false);
      setBrokenAt(data.brokenAt || null);
      setReady(true);
    })().catch((e: Error) => {
      setError(e.message);
      setReady(true);
    });
  }, []);

  const actions = useMemo(() => ["all", ...Array.from(new Set(entries.map((e) => e.action)))], [entries]);
  const shown = filter === "all" ? entries : entries.filter((e) => e.action === filter);

  if (!ready) return <p className="text-ink/60">Loading activity log…</p>;

  if (!session) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-rule bg-white/80 p-6 shadow-card">
        <h1 className="font-serif text-3xl text-navy">Activity log</h1>
        <Link href="/admin" className="mt-4 inline-flex rounded-full bg-navy px-4 py-2 text-sm font-semibold text-paper">
          Go to admin login
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminHeader title="Activity log" />

      <p className="rounded-2xl border border-rule bg-white/80 px-4 py-3 text-sm text-ink/75">
        Every admin and department sign-in, password change, campus change, and ticket update is appended here. Entries
        are hash-chained. There is no edit or delete. Passwords are never stored in the log.
      </p>

      {intact ? (
        <p className="rounded-xl bg-resolved/10 px-3 py-2 text-sm text-resolved">Chain intact. {entries.length} events.</p>
      ) : (
        <p className="rounded-xl bg-critical/10 px-3 py-2 text-sm text-critical">
          Chain broken{brokenAt ? ` at ${brokenAt}` : ""}. Someone changed or removed a log line.
        </p>
      )}

      {error ? <p className="text-sm text-critical">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        {actions.map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setFilter(a)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              filter === a ? "bg-navy text-paper" : "border border-rule text-ink/70"
            }`}
          >
            {a === "all" ? "All" : ACTION_LABEL[a] || a}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-rule bg-white/80">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-paper/80 text-xs uppercase tracking-wide text-ink/50">
              <tr>
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Who</th>
                <th className="px-3 py-2">Action</th>
                <th className="px-3 py-2">Detail</th>
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-ink/55">
                    No events yet.
                  </td>
                </tr>
              ) : (
                shown.map((e) => (
                  <tr key={e.id} className="border-t border-rule/70 align-top">
                    <td className="whitespace-nowrap px-3 py-3 text-ink/60">{new Date(e.at).toLocaleString()}</td>
                    <td className="px-3 py-3">
                      <p className="font-semibold">{e.actor_email}</p>
                      <p className="text-xs text-ink/45">{e.actor_role}</p>
                    </td>
                    <td className="px-3 py-3 font-semibold">{ACTION_LABEL[e.action] || e.action}</td>
                    <td className="px-3 py-3 text-ink/70">
                      {e.target ? <span className="font-semibold">{e.target} · </span> : null}
                      {e.detail}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
