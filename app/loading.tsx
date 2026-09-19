export default function Loading() {
  return <div role="status" aria-label="Loading page" className="space-y-4"><div className="h-8 w-40 animate-pulse rounded-xl bg-navy/10" /><div className="cp-card h-56 animate-pulse bg-white/70" /><p className="text-sm text-ink/60">Loading your campus…</p></div>;
}
