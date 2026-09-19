"use client";

import { formatClock, formatExpectedBy, formatRemaining, isEtaPast } from "@/lib/eta";
import { useLang } from "@/lib/i18n";

export function ExpectedFix({
  etaAt,
  compact,
}: {
  etaAt?: string | null;
  compact?: boolean;
}) {
  const { lang, t } = useLang();
  const locale = lang === "hi" ? "hi-IN" : "en-IN";
  if (!etaAt) return null;
  const late = isEtaPast(etaAt);
  if (compact) {
    return <span className={late ? "text-critical" : "text-onit"}>{formatExpectedBy(etaAt, locale)}</span>;
  }
  return (
    <div
      className={`rounded-2xl border px-4 py-3 ${
        late ? "border-critical/40 bg-critical/10" : "border-onit/30 bg-onit/10"
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">{late ? t("etaLate") : t("expectedBy")}</p>
      <p className="mt-1 font-serif text-2xl text-navy">{formatClock(etaAt, locale)}</p>
      <p className="mt-1 text-sm font-semibold text-ink/70">{formatRemaining(etaAt, locale)}</p>
    </div>
  );
}
