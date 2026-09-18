import { pinKind, PIN_COLORS } from "@/lib/campus";
import { statusLabel } from "@/lib/client";

export function StatusBadge({ status, severity }: { status: string; severity?: string }) {
  const kind = pinKind(status, severity || "medium");
  const color = PIN_COLORS[kind];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide"
      style={{ background: `${color}1f`, color }}
    >
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {status === "open" && severity === "critical" ? "Critical" : statusLabel(status)}
    </span>
  );
}
