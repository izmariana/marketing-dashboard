import { performanceBadge } from "@/lib/services/recommendation-engine";

export function ScoreBadge({ score, size = "sm" }: { score: number; size?: "sm" | "md" }) {
  const badge = performanceBadge(score);
  return (
    <span
      className={
        size === "sm"
          ? "inline-flex items-center gap-1 text-[11px] font-medium rounded-full bg-surface-2 border border-border px-2 py-0.5"
          : "inline-flex items-center gap-1.5 text-sm font-medium rounded-full bg-surface-2 border border-border px-3 py-1"
      }
    >
      <span>{badge.emoji}</span>
      <span>{score}</span>
      <span className="text-muted">· {badge.label}</span>
    </span>
  );
}
