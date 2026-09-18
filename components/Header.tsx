"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

const LINKS = [
  { href: "/", label: "Map" },
  { href: "/report", label: "Report" },
  { href: "/admin", label: "Admin" },
];

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [code, setCode] = useState("");

  function onTrack(e: FormEvent) {
    e.preventDefault();
    const ticket = code.trim().toUpperCase();
    if (!ticket) return;
    router.push(`/ticket/${encodeURIComponent(ticket)}`);
  }

  return (
    <header className="border-b border-rule/80 bg-paper/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 md:px-6">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="font-serif text-2xl font-semibold tracking-tight text-navy">CampusPulse</span>
          <span className="rounded-full bg-navy px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-paper">
            AI
          </span>
        </Link>
        <nav className="ml-2 flex gap-1 text-sm font-semibold">
          {LINKS.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-full px-3 py-1.5 ${active ? "bg-navy text-paper" : "text-ink/80 hover:bg-white/50"}`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <form onSubmit={onTrack} className="ml-auto flex min-w-[12rem] flex-1 items-center gap-2 sm:max-w-xs">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Ticket CP-1001"
            className="w-full rounded-full border border-rule bg-white/70 px-3 py-1.5 text-sm outline-none ring-navy/20 focus:ring-2"
            aria-label="Look up ticket"
          />
          <button type="submit" className="rounded-full bg-navy px-3 py-1.5 text-sm font-semibold text-paper">
            Track
          </button>
        </form>
      </div>
    </header>
  );
}
