"use client";

import { AdminHeader } from "@/components/AdminHeader";
import { staffDeskHeaders } from "@/lib/client";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

interface DeskRow {
  key: string;
  label: string;
  email: string;
  openIssues: number;
  passwordUpdatedAt: string | null;
  passwordUpdatedBy: string | null;
  customPassword: boolean;
}

export default function AdminDepartmentsPage() {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<{ email: string } | null>(null);
  const [desks, setDesks] = useState<DeskRow[]>([]);
  const [places, setPlaces] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { password: string; confirm: string }>>({});

  async function load() {
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
    const res = await fetch("/api/admin/departments", { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not load departments");
    setDesks(data.desks || []);
    setPlaces(data.reportPlaces || []);
    setReady(true);
  }

  useEffect(() => {
    load().catch((e: Error) => {
      setError(e.message);
      setReady(true);
    });
  }, []);

  async function onChangePassword(e: FormEvent, key: string, label: string) {
    e.preventDefault();
    const draft = drafts[key] || { password: "", confirm: "" };
    setError("");
    setNote("");
    setBusyKey(key);
    try {
      const res = await fetch("/api/admin/departments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, password: draft.password, confirm: draft.confirm }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not change password");
      setDrafts((d) => ({ ...d, [key]: { password: "", confirm: "" } }));
      setNote(`Password updated for ${label}. They must sign in again.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change password");
    } finally {
      setBusyKey(null);
    }
  }

  if (!ready) return <p className="text-ink/60">Loading departments…</p>;

  if (!session) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-rule bg-white/80 p-6 shadow-card">
        <h1 className="font-serif text-3xl text-navy">Departments</h1>
        <Link href="/admin" className="mt-4 inline-flex rounded-full bg-navy px-4 py-2 text-sm font-semibold text-paper">
          Go to admin login
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminHeader title="Departments" />

      <p className="rounded-2xl border border-rule bg-white/80 px-4 py-3 text-sm text-ink/75">
        Only these desks exist{places.length ? ` (${places.join(", ")})` : ": IT, Hostel, Mess, Campus, Library"}.
        Students pick the same names when they report, and admin assign uses this list only. Change a desk password
        here. The new password is stored hashed. That desk’s current login is signed out.
      </p>

      {error ? <p className="rounded-xl bg-critical/10 px-3 py-2 text-sm text-critical">{error}</p> : null}
      {note ? <p className="rounded-xl bg-resolved/10 px-3 py-2 text-sm text-resolved">{note}</p> : null}

      <div className="grid gap-4 md:grid-cols-2">
        {desks.map((d) => {
          const draft = drafts[d.key] || { password: "", confirm: "" };
          return (
            <section key={d.key} className="rounded-2xl border border-rule bg-white/80 p-4 shadow-card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-serif text-2xl text-navy">{d.label}</h2>
                  <p className="text-sm text-ink/60">{d.email}</p>
                </div>
                <span className="rounded-full bg-paper px-3 py-1 text-xs font-semibold text-ink/70">
                  {d.openIssues} open
                </span>
              </div>
              <p className="mt-2 text-xs text-ink/50">
                {d.customPassword && d.passwordUpdatedAt
                  ? `Last changed ${new Date(d.passwordUpdatedAt).toLocaleString()}${
                      d.passwordUpdatedBy ? ` by ${d.passwordUpdatedBy}` : ""
                    }`
                  : "Using the default env password until you set one."}
              </p>
              <form onSubmit={(e) => void onChangePassword(e, d.key, d.label)} className="mt-3 space-y-2">
                <input
                  type="password"
                  autoComplete="new-password"
                  placeholder="New password"
                  value={draft.password}
                  onChange={(e) =>
                    setDrafts((prev) => ({ ...prev, [d.key]: { ...draft, password: e.target.value } }))
                  }
                  className="w-full rounded-xl border border-rule bg-paper/40 px-3 py-2 text-sm outline-none ring-navy/20 focus:ring-2"
                />
                <input
                  type="password"
                  autoComplete="new-password"
                  placeholder="Confirm password"
                  value={draft.confirm}
                  onChange={(e) =>
                    setDrafts((prev) => ({ ...prev, [d.key]: { ...draft, confirm: e.target.value } }))
                  }
                  className="w-full rounded-xl border border-rule bg-paper/40 px-3 py-2 text-sm outline-none ring-navy/20 focus:ring-2"
                />
                <button
                  type="submit"
                  disabled={busyKey === d.key || draft.password.length < 8}
                  className="rounded-full bg-navy px-4 py-2 text-sm font-semibold text-paper disabled:opacity-50"
                >
                  {busyKey === d.key ? "Saving…" : "Change password"}
                </button>
              </form>
            </section>
          );
        })}
      </div>
    </div>
  );
}
