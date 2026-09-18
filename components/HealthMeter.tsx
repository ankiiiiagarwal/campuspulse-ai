export function HealthMeter({
  score,
  label,
  size = "lg",
}: {
  score: number;
  label?: string;
  size?: "lg" | "sm";
}) {
  const tone = score >= 80 ? "#2f7d4a" : score >= 65 ? "#c98412" : "#c43828";
  return (
    <div className={size === "lg" ? "min-w-[9rem]" : ""}>
      {label ? <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/55">{label}</p> : null}
      <p className={`font-serif font-semibold leading-none ${size === "lg" ? "text-6xl" : "text-3xl"}`} style={{ color: tone }}>
        {score}
      </p>
      {size === "lg" ? <p className="mt-1 text-sm text-ink/60">Campus health · 0–100</p> : null}
    </div>
  );
}
