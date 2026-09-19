import { explainPriority } from "@/lib/scoring";
import type { IssueWithCluster } from "@/lib/types";

export function PriorityChip({ issue }: { issue: IssueWithCluster }) {
  const tip = explainPriority(issue);
  return (
    <span title={tip.label} className="group relative inline-flex cursor-help font-semibold">
      <span className="underline decoration-dotted decoration-ink/30 underline-offset-4">{Number(issue.priority).toFixed(0)}</span>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-max max-w-[16rem] -translate-x-1/2 rounded-xl bg-navy px-3 py-2 text-left text-xs font-medium text-paper shadow-card group-hover:block group-focus-visible:block"
      >
        {tip.label}
      </span>
    </span>
  );
}
