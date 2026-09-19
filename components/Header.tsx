"use client";

import { useLang } from "@/lib/i18n";
import { listSavedTickets, rememberTicket } from "@/lib/saved-tickets";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { lang, setLang, t } = useLang();
  const [toolsOpen, setToolsOpen] = useState(false);
  const [code, setCode] = useState("");
  const [saved, setSaved] = useState<string[]>([]);
  useEffect(() => { document.documentElement.lang = lang === "hi" ? "hi" : "en"; }, [lang]);

  useEffect(() => {
    const refresh = () => setSaved(listSavedTickets());
    refresh();
    window.addEventListener("cp-tickets", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("cp-tickets", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  function onTrack(e: FormEvent) {
    e.preventDefault();
    const ticket = code.trim().toUpperCase();
    if (!ticket) return;
    rememberTicket(ticket);
    router.push(`/ticket/${encodeURIComponent(ticket)}`);
  }

  const staff = pathname.startsWith("/admin") || pathname.startsWith("/dept");
  const links = [
    { href: "/", label: t("home") },
    { href: "/report", label: t("report") },
    { href: "/incidents", label: lang === "hi" ? "घटनाएँ" : "Incidents" },
    { href: "/accountability", label: t("accountability") },
    { href: "/posters", label: t("posters") },
    { href: "/admin", label: t("admin") },
    { href: "/dept", label: t("dept") },
  ];

  return (
    <header className="relative z-[1100] border-b border-rule bg-white/90 print:hidden">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <div className="flex min-h-[72px] flex-wrap items-center justify-between gap-3 py-3">
          <Link href="/" className="flex shrink-0 items-center gap-2 text-navy" aria-label="CampusPulse home">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-navy text-white"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M3 12h5l2-6 4 12 2-6h5" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
            <span className="whitespace-nowrap font-serif text-xl font-semibold tracking-tight sm:text-2xl">CampusPulse<span className="ml-1 text-resolved">.</span></span>
          </Link>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            {!staff && <div className="flex rounded-full border border-rule p-0.5 text-xs font-semibold" aria-label="Language">
              <button type="button" aria-pressed={lang === "en"} onClick={() => setLang("en")} className={`whitespace-nowrap rounded-full px-2 py-1.5 sm:px-3 ${lang === "en" ? "bg-navy text-white" : "text-ink/70"}`}>EN</button>
              <button type="button" aria-pressed={lang === "hi"} onClick={() => setLang("hi")} className={`whitespace-nowrap rounded-full px-2 py-1.5 sm:px-3 ${lang === "hi" ? "bg-navy text-white" : "text-ink/70"}`}>हिं</button>
            </div>}
            <button type="button" aria-expanded={toolsOpen} aria-controls="ticket-tools" onClick={() => setToolsOpen(v => !v)} className="whitespace-nowrap rounded-full border border-rule px-2 py-2 text-sm font-semibold text-navy sm:px-3">{t("track")} <span aria-hidden="true">{toolsOpen ? "−" : "+"}</span></button>
          </div>
        </div>
        <nav aria-label="Main navigation" className="cp-nav-scroll -mx-1 flex gap-1 overflow-x-auto pb-3 text-sm font-semibold">
          {links.map(l => {
            const active = l.href === "/" ? pathname === "/" : pathname === l.href || pathname.startsWith(`${l.href}/`);
            return <Link key={l.href} href={l.href} aria-current={active ? "page" : undefined} className={`shrink-0 rounded-full px-4 py-2 ${active ? "bg-navy text-white" : "text-ink/65 hover:bg-paper hover:text-navy"}`}>{l.label}</Link>;
          })}
        </nav>
        {toolsOpen && <div id="ticket-tools" className="cp-page-enter flex flex-wrap items-center gap-3 border-t border-rule py-4">
          <form onSubmit={onTrack} className="flex min-w-0 flex-1 items-center gap-2 sm:max-w-sm">
            <input value={code} onChange={e => setCode(e.target.value)} placeholder={t("ticketId")} aria-label={t("ticketId")} required className="min-w-0 flex-1 rounded-xl border border-rule bg-paper/60 px-3 py-2 text-sm" />
            <button type="submit" className="rounded-xl bg-navy px-4 py-2 font-semibold text-white">{t("track")}</button>
          </form>
          {!staff && saved.length > 0 && <label className="text-sm"><span className="sr-only">{t("myTickets")}</span><select defaultValue="" onChange={e => { if(e.target.value) router.push(`/ticket/${encodeURIComponent(e.target.value)}`); e.target.value=""; }} className="max-w-full rounded-xl border border-rule bg-white px-3 py-2"><option value="">{t("myTickets")}</option>{saved.map(c => <option key={c} value={c}>{c}</option>)}</select></label>}
          <p className="text-xs text-ink/60">{lang === "hi" ? "अपना टिकट देखें। खाते की जरूरत नहीं।" : "Your report, from submission to student-confirmed repair."}</p>
        </div>}
      </div>
    </header>
  );
}
