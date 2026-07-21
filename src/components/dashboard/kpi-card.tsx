"use client";

import { motion } from "framer-motion";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export type KpiDirection = "up-is-good" | "down-is-good";

interface KpiCardProps {
  label: string;
  value: string;
  previousValue?: string;
  changePercent?: number; // positivo o negativo
  direction?: KpiDirection; // determina si el cambio es bueno o malo
  delay?: number;
}

export function KpiCard({ label, value, previousValue, changePercent, direction = "up-is-good", delay = 0 }: KpiCardProps) {
  const isPositiveChange = (changePercent ?? 0) > 0;
  const isGood =
    changePercent === undefined
      ? null
      : direction === "up-is-good"
      ? isPositiveChange
      : !isPositiveChange;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className="rounded-xl border border-border bg-surface p-4 hover:border-accent/40 transition-colors"
    >
      <p className="text-xs font-medium text-muted mb-2">{label}</p>
      <p className="text-2xl font-semibold tracking-tight tabular-nums">{value}</p>

      <div className="flex items-center gap-1.5 mt-2 text-xs">
        {changePercent !== undefined && (
          <>
            <span
              className={cn(
                "flex items-center gap-0.5 font-medium",
                isGood === null ? "text-muted" : isGood ? "text-success" : "text-danger"
              )}
            >
              {changePercent === 0 ? (
                <Minus className="h-3 w-3" />
              ) : isPositiveChange ? (
                <ArrowUpRight className="h-3 w-3" />
              ) : (
                <ArrowDownRight className="h-3 w-3" />
              )}
              {Math.abs(changePercent).toFixed(1)}%
            </span>
            {previousValue && <span className="text-muted">vs. {previousValue} período anterior</span>}
          </>
        )}
      </div>
    </motion.div>
  );
}
