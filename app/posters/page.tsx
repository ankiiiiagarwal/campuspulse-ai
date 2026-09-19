"use client";

import { PlaceQr } from "@/components/PlaceQr";
import { LocationManager } from "@/components/LocationManager";
import { PrintPosterButton } from "@/components/PrintPosterButton";
import { DEPARTMENTS } from "@/lib/departments";
import { useLang } from "@/lib/i18n";
import type { Department } from "@/lib/types";
import Link from "next/link";
import { useEffect, useState } from "react";

function reportHref(origin: string, place: Department) {
  return `${origin}/report?place=${encodeURIComponent(place)}`;
}

export default function PostersPage() {
  const { t } = useLang();
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState<Department | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  async function copyLink(place: Department) {
    const href = reportHref(origin || window.location.origin, place);
    try {
      await navigator.clipboard.writeText(href);
      setCopied(place);
      window.setTimeout(() => setCopied((c) => (c === place ? null : c)), 1600);
    } catch {
      setCopied(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/50">{t("posters")}</p>
          <h1 className="font-serif text-4xl font-semibold text-navy">{t("postersTitle")}</h1>
          <p className="mt-2 max-w-2xl text-ink/70">{t("postersLead")}</p>
        </div>
      </section>

      <LocationManager />
      <h2 className="font-serif text-2xl text-navy print:hidden">Department posters</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 print:grid-cols-2">
        {DEPARTMENTS.map((place) => {
          const href = origin ? reportHref(origin, place) : "";
          return (
            <article
              key={place}
              className="flex flex-col items-center gap-3 rounded-3xl border border-rule bg-white/90 p-5 text-center shadow-card"
            >
              <p className="font-serif text-3xl font-semibold text-navy">{place}</p>
              <p className="text-sm text-ink/60">{t("posterHint")}</p>
              {href ? <PlaceQr value={href} /> : <div className="h-[180px] w-[180px] bg-paper" />}
              <p className="break-all font-mono text-xs text-ink/45">{href || "…"}</p>
              <div className="flex flex-wrap justify-center gap-2 print:hidden">
                <PrintPosterButton title={place} href={href} />
                <Link href={`/report?place=${encodeURIComponent(place)}`} className="rounded-full bg-navy px-4 py-2 text-sm font-semibold text-paper">
                  {t("openReport")}
                </Link>
                <button
                  type="button"
                  onClick={() => void copyLink(place)}
                  className="rounded-full border border-rule px-4 py-2 text-sm font-semibold"
                >
                  {copied === place ? t("copied") : t("copyLink")}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
