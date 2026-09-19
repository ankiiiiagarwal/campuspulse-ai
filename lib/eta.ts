/** Staff choose a local date/time; the API stores the instant as UTC eta_at. */

export function etaLocalFields(iso?: string | null): { date: string; time: string } {
  const value = new Date(iso || "");
  if (!Number.isFinite(value.getTime())) return { date: "", time: "" };
  const pad = (n: number) => String(n).padStart(2, "0");
  return { date: `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`, time: `${pad(value.getHours())}:${pad(value.getMinutes())}` };
}

export function etaFromLocal(date: string, time: string, now = Date.now()): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const value = new Date(year, month - 1, day, hour, minute);
  // Reject invalid dates and local times skipped by a daylight-saving change.
  if (value.getFullYear() !== year || value.getMonth() !== month - 1 || value.getDate() !== day || value.getHours() !== hour || value.getMinutes() !== minute || value.getTime() <= now) return null;
  return value.toISOString();
}

export function etaIsoFromHours(hours: number, from = Date.now()): string {
  return new Date(from + hours * 3_600_000).toISOString();
}

export function hoursUntil(iso: string, now = Date.now()): number | null {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return (t - now) / 3_600_000;
}

export function isEtaPast(iso: string, now = Date.now()): boolean {
  const hours = hoursUntil(iso, now);
  return hours != null && hours < 0;
}

/** Promised fix time has passed and the ticket is still open. */
export function isMissedEta(
  issue: { status: string; eta_at?: string | null },
  now = Date.now(),
): boolean {
  if (issue.status === "resolved" || !issue.eta_at) return false;
  return isEtaPast(issue.eta_at, now);
}

export function formatClock(iso: string, locale?: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(locale || undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatRemaining(iso: string, locale?: string, now = Date.now()): string {
  const hours = hoursUntil(iso, now);
  if (hours == null) return "—";
  const hi = Boolean(locale?.startsWith("hi"));
  const abs = Math.abs(hours);
  let rel: string;
  if (abs < 1) {
    const min = Math.max(1, Math.round(abs * 60));
    rel = hi ? `${min} मिनट` : min === 1 ? "1 minute" : `${min} minutes`;
  } else if (abs < 48) {
    const h = Math.max(1, Math.round(abs));
    rel = hi ? `${h} घंटे` : h === 1 ? "1 hour" : `${h} hours`;
  } else {
    const d = Math.max(1, Math.round(abs / 24));
    rel = hi ? `${d} दिन` : d === 1 ? "1 day" : `${d} days`;
  }
  if (hours >= 0) return hi ? `लगभग ${rel} में` : `in ${rel}`;
  return hi ? `${rel} देर` : `${rel} late`;
}

/** Public line: “May be fixed by 19 Sept, 5:33 pm (in 4 hours)”. */
export function formatExpectedBy(iso: string, locale?: string, now = Date.now()): string {
  const when = formatClock(iso, locale);
  const rem = formatRemaining(iso, locale, now);
  const hours = hoursUntil(iso, now);
  if (hours == null) return "—";
  const hi = Boolean(locale?.startsWith("hi"));
  if (hours >= 0) {
    return hi ? `${when} तक ठीक हो सकता है (${rem})` : `May be fixed by ${when} (${rem})`;
  }
  return hi ? `अनुमानित समय था ${when} (${rem})` : `Was expected by ${when} (${rem})`;
}

export function ticketEtaNote(etaAt: string | null | undefined): string {
  if (!etaAt) return "";
  return ` Staff expect it may be fixed by ${formatClock(etaAt, "en-IN")} (${formatRemaining(etaAt, "en-IN")}).`;
}
