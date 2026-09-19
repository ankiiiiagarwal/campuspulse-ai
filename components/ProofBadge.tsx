import type { ProofState } from "@/lib/types";

const TONE: Record<Exclude<ProofState, "none">, { color: string; label: string }> = {
  verified: { color: "#2f7d4a", label: "Verified fixed" },
  awaiting: { color: "#2b5ea8", label: "Awaiting check" },
  unconfirmed: { color: "#8a8172", label: "Unconfirmed" },
  reopened: { color: "#c43828", label: "Sent back" },
};

/** Where a fix claim stands, in the same visual language as the status pins. */
export function ProofBadge({ state, label }: { state: ProofState; label?: string }) {
  if (state === "none") return null;
  const tone = TONE[state];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide"
      style={{ background: `${tone.color}1f`, color: tone.color }}
    >
      <span className="h-2 w-2 rounded-full" style={{ background: tone.color }} />
      {label || tone.label}
    </span>
  );
}
