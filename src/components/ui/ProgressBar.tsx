interface Props {
  value: number;
  max: number;
  tone?: "green" | "purple" | "red" | "auto";
}

export function ProgressBar({ value, max, tone = "auto" }: Props) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));

  let color = "var(--color-green)";
  if (tone === "purple") color = "var(--color-purple)";
  else if (tone === "red") color = "var(--color-red)";
  else if (tone === "auto") {
    if (value === max) color = "var(--color-green)";
    else if (value >= max * 0.5) color = "var(--color-purple)";
    else color = "var(--color-red)";
  }

  return (
    <div className="progress">
      <div
        className="progress-bar"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}
