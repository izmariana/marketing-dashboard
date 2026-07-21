"use client";

import { motion } from "framer-motion";
import { formatCompact } from "@/lib/utils";

interface FunnelStage {
  label: string;
  value: number;
}

export function ConversionFunnel({ stages }: { stages: FunnelStage[] }) {
  const max = stages[0]?.value || 1;

  return (
    <div className="space-y-3">
      {stages.map((stage, idx) => {
        const widthPct = Math.max((stage.value / max) * 100, 6);
        const prevValue = idx > 0 ? stages[idx - 1].value : null;
        const dropoff = prevValue ? (((prevValue - stage.value) / prevValue) * 100).toFixed(0) : null;

        return (
          <div key={stage.label}>
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-xs font-medium text-muted">{stage.label}</span>
              <span className="text-sm font-semibold tabular-nums">{formatCompact(stage.value)}</span>
            </div>
            <div className="h-8 rounded-md bg-surface-2 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${widthPct}%` }}
                transition={{ duration: 0.6, delay: idx * 0.08, ease: "easeOut" }}
                className="h-full rounded-md"
                style={{
                  background: `linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent) 60%, transparent))`,
                }}
              />
            </div>
            {dropoff && (
              <p className="text-[11px] text-muted mt-1">−{dropoff}% respecto a la etapa anterior</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
