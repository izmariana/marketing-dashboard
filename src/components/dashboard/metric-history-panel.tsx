"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { EvolutionChart } from "@/components/charts/evolution-chart";
import { useMetricHistory, type MetricHistoryConfig } from "@/hooks/use-metric-history";
import type { MetricGrain, RangePreset } from "@/lib/utils/metric-aggregation";
import { cn } from "@/lib/utils";

const RANGE_OPTIONS: { value: RangePreset; label: string }[] = [
  { value: "today", label: "Hoy" },
  { value: "7d", label: "7 días" },
  { value: "30d", label: "30 días" },
  { value: "90d", label: "90 días" },
  { value: "12m", label: "12 meses" },
  { value: "all", label: "Desde el inicio" },
  { value: "custom", label: "Personalizado" },
];

const GRAIN_OPTIONS: { value: MetricGrain; label: string }[] = [
  { value: "daily", label: "Diaria" },
  { value: "weekly", label: "Semanal" },
  { value: "monthly", label: "Mensual" },
  { value: "yearly", label: "Anual" },
];

export interface MetricHistoryTarget extends MetricHistoryConfig {
  label: string;
  formatter: (v: number) => string;
}

export function MetricHistoryPanel({ target, onClose }: { target: MetricHistoryTarget | null; onClose: () => void }) {
  const [range, setRange] = useState<RangePreset>("30d");
  const [grain, setGrain] = useState<MetricGrain>("daily");
  const [customSince, setCustomSince] = useState("");
  const [customUntil, setCustomUntil] = useState("");

  const { bucketed, isLoading, data } = useMetricHistory(target, range, grain, customSince, customUntil);

  return (
    <AnimatePresence>
      {target && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 260 }}
            className="fixed right-0 top-0 h-full w-full max-w-lg bg-background border-l border-border z-50 overflow-y-auto scrollbar-thin"
          >
            <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-background z-10">
              <div>
                <p className="text-xs text-muted">Histórico ilimitado</p>
                <h3 className="text-sm font-medium">{target.label}</h3>
              </div>
              <button onClick={onClose} className="rounded-md p-1.5 hover:bg-surface">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <p className="text-xs font-medium text-muted mb-1.5">Rango</p>
                <div className="flex flex-wrap gap-1.5">
                  {RANGE_OPTIONS.map((o) => (
                    <button
                      key={o.value}
                      onClick={() => setRange(o.value)}
                      className={cn(
                        "text-xs font-medium rounded-md border px-2.5 py-1.5 transition-colors",
                        range === o.value ? "bg-accent text-accent-foreground border-accent" : "border-border hover:bg-surface"
                      )}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              {range === "custom" && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-muted mb-1">Desde</label>
                    <input
                      type="date"
                      value={customSince}
                      onChange={(e) => setCustomSince(e.target.value)}
                      className="w-full rounded-md border border-border bg-surface-2 px-2 py-1.5 text-xs outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-muted mb-1">Hasta</label>
                    <input
                      type="date"
                      value={customUntil}
                      onChange={(e) => setCustomUntil(e.target.value)}
                      className="w-full rounded-md border border-border bg-surface-2 px-2 py-1.5 text-xs outline-none focus:border-accent"
                    />
                  </div>
                </div>
              )}

              <div>
                <p className="text-xs font-medium text-muted mb-1.5">Vista</p>
                <div className="flex items-center rounded-md border border-border p-0.5 bg-surface w-fit">
                  {GRAIN_OPTIONS.map((o) => (
                    <button
                      key={o.value}
                      onClick={() => setGrain(o.value)}
                      className={cn(
                        "px-3 py-1.5 text-xs font-medium rounded-[6px] transition-colors",
                        grain === o.value ? "bg-accent text-accent-foreground" : "text-muted hover:text-foreground"
                      )}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-border bg-surface p-4">
                {isLoading ? (
                  <div className="h-64 flex items-center justify-center text-sm text-muted">Cargando histórico...</div>
                ) : bucketed.length === 0 ? (
                  <div className="h-64 flex items-center justify-center text-sm text-muted">Sin datos para este rango.</div>
                ) : (
                  <EvolutionChart data={bucketed} valueFormatter={target.formatter} height={280} />
                )}
              </div>

              {data?.source === "mock" && (
                <p className="text-[11px] text-muted italic">
                  Datos de ejemplo. Con tu cuenta conectada, este histórico se construye día a día desde tu primera sincronización, sin límite de tiempo.
                </p>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
