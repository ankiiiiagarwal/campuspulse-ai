"use client";

import { etaFromLocal, etaLocalFields, formatExpectedBy } from "@/lib/eta";

export function ResolutionDateTime({ date, time, onChange }: {
  date: string;
  time: string;
  onChange: (value: { date: string; time: string }) => void;
}) {
  const eta = etaFromLocal(date, time);
  const today = etaLocalFields(new Date().toISOString()).date;
  return <div className="space-y-3">
    <label className="block text-sm">
      <span className="font-semibold">Expected resolution date</span>
      <input type="date" required min={today} value={date}
        onChange={event => onChange({date:event.target.value,time})}
        className="mt-1 block w-full min-w-0 rounded-xl border border-rule px-3 py-2" />
    </label>
    <label className="block text-sm">
      <span className="font-semibold">Expected resolution time</span>
      <input type="time" required disabled={!date} value={time}
        onChange={event => onChange({date,time:event.target.value})}
        className="mt-1 block w-full min-w-0 rounded-xl border border-rule px-3 py-2 disabled:bg-paper disabled:opacity-60" />
    </label>
    <p className="text-xs text-ink/60">Choose the date, then the time in your local time zone. Dates beyond tomorrow are allowed.</p>
    {eta ? <p className="rounded-xl bg-onit/10 px-3 py-2 text-sm font-semibold text-navy">{formatExpectedBy(eta)}</p>
      : date && time ? <p role="alert" className="text-sm text-critical">Choose a valid date and time in the future.</p> : null}
  </div>;
}
