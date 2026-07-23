"use client";

import { useState } from "react";
import { Topbar } from "@/components/layout/topbar";
import { Panel } from "@/components/dashboard/panel";
import { useComparePlatforms } from "@/hooks/use-platform-intelligence";
import { BRANDS } from "@/types/domain";
import { cn } from "@/lib/utils";
import { Info } from "lucide-react";

function formatMaybe(value: number | null): string {
  if (value === null) return "—";
  return new Intl.NumberFormat("es-CL", { maximumFractionDigits: 2 }).format(value);
}

export default function ComparacionPage() {
  const [brand, setBrand] = useState(BRANDS[0].slug);
  const [days, setDays] = useState(30);
  const { data, isLoading } = useComparePlatforms(brand, days);

  return (
    <div>
      <Topbar title="Comparación de Plataformas" />

      <div className="p-6 space-y-5 max-w-[1100px]">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Meta Ads vs Google Analytics</h2>
            <p className="text-sm text-muted">Compara ambas fuentes y entiende por qué sus números pueden diferir</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-md border border-border p-0.5 bg-surface">
              {BRANDS.map((b) => (
                <button
                  key={b.slug}
                  onClick={() => setBrand(b.slug)}
                  className={cn("px-3 py-1.5 text-xs font-medium rounded-[6px] transition-colors", brand === b.slug ? "bg-accent text-accent-foreground" : "text-muted hover:text-foreground")}
                >
                  {b.name}
                </button>
              ))}
            </div>
            <div className="flex items-center rounded-md border border-border p-0.5 bg-surface">
              {[7, 30, 90].map((d) => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={cn("px-3 py-1.5 text-xs font-medium rounded-[6px] transition-colors", days === d ? "bg-accent text-accent-foreground" : "text-muted hover:text-foreground")}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>
        </div>

        {isLoading || !data ? (
          <div className="h-64 rounded-xl bg-surface border border-border animate-pulse" />
        ) : (
          <>
            <Panel title="Hallazgos automáticos">
              <div className="space-y-2.5">
                {data.narrative.map((text, i) => (
                  <div key={i} className="flex items-start gap-2.5 rounded-lg border border-accent/30 bg-accent-soft p-3">
                    <Info className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                    <p className="text-sm text-foreground/90">{text}</p>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Comparación métrica por métrica">
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted border-b border-border">
                      <th className="pb-2 font-medium">Métrica</th>
                      <th className="pb-2 font-medium text-right">Meta Ads</th>
                      <th className="pb-2 font-medium text-right">Google Analytics</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((row, i) => (
                      <tr key={i} className="border-b border-border last:border-0 align-top">
                        <td className="py-3 pr-4 font-medium">{row.label}</td>
                        <td className="py-3 text-right">
                          <div className="tabular-nums font-medium">{formatMaybe(row.metaValue)}</div>
                          <div className="text-[11px] text-muted">{row.metaLabel}</div>
                        </td>
                        <td className="py-3 text-right">
                          <div className="tabular-nums font-medium">{formatMaybe(row.gaValue)}</div>
                          <div className="text-[11px] text-muted">{row.gaLabel}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>

            <Panel title="Por qué pueden diferir estas métricas" description="Explicación de cada fila de la tabla">
              <div className="space-y-3">
                {data.rows.map((row, i) => (
                  <div key={i}>
                    <p className="text-xs font-medium text-accent mb-0.5">{row.label}</p>
                    <p className="text-xs text-muted">{row.note}</p>
                  </div>
                ))}
              </div>
            </Panel>
          </>
        )}
      </div>
    </div>
  );
}
