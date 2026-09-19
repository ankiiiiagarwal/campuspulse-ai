import { formatDateTime } from "@/lib/client";
import { hoursSince } from "@/lib/scoring";
import type { IssueWithCluster } from "@/lib/types";

function elapsedLabel(from: string, to: string): string {
  const hours = Math.max(0, hoursSince(from, new Date(to).getTime()));
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min later`;
  if (hours < 48) return `${hours.toFixed(1)} h later`;
  return `${(hours / 24).toFixed(1)} d later`;
}

export function TicketTimeline({
  issue,
  locale,
  labels,
}: {
  issue: IssueWithCluster;
  locale?: string;
  labels: {
    reported: string;
    assigned: string;
    onIt: string;
    resolved: string;
    waiting: string;
  };
}) {
  const assignedAt = issue.assigned_at;
  // ETA is a promised completion time, never evidence of when work began.
  const workRecorded = issue.status === "on_it" || (issue.status === "resolved" && Boolean(issue.worker_name));
  const steps = [
    { key: "open", label: labels.reported, at: issue.created_at, extra: null as string | null },
    { key: "assigned", label: labels.assigned, at: assignedAt, extra: issue.department },
    {
      key: "on_it",
      label: issue.worker_name ? `${labels.onIt} · ${issue.worker_name}` : labels.onIt,
      at: null,
      extra: null,
    },
    { key: "resolved", label: labels.resolved, at: issue.resolved_at, extra: null },
  ];

  let lastAt: string | null = null;

  return (
    <ol className="space-y-0">
      {steps.map((step) => {
        const done = Boolean(step.at) || (step.key === "on_it" && workRecorded);
        const gap = done && lastAt && step.at && step.at !== lastAt ? elapsedLabel(lastAt, step.at) : null;
        if (done && step.at) lastAt = step.at;
        return (
          <li key={step.key} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={`mt-1 h-3 w-3 rounded-full ${done ? "bg-navy" : "border-2 border-rule bg-white"}`}
                aria-hidden
              />
              <span className={`w-px flex-1 bg-rule ${step.key === "resolved" ? "invisible" : ""}`} />
            </div>
            <div className="min-w-0 pb-5">
              <p className={`font-semibold ${done ? "text-navy" : "text-ink/40"}`}>{step.label}</p>
              {done && step.at ? (
                <p className="text-sm text-ink/65">
                  {formatDateTime(step.at, locale)}
                  {gap ? ` · ${gap}` : ""}
                  {step.extra ? ` · ${step.extra}` : ""}
                </p>
              ) : (
                <p className="text-sm text-ink/40">{step.key === "on_it" && workRecorded ? (locale?.startsWith("hi") ? "काम शुरू होने का समय दर्ज नहीं है" : "Start time was not recorded") : labels.waiting}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
