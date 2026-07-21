"use client";

import { useState } from "react";
import { Topbar } from "@/components/layout/topbar";
import { Panel } from "@/components/dashboard/panel";
import { ExecutiveSummaryPanel } from "@/components/dashboard/executive-summary-panel";
import { RecommendationsList } from "@/components/dashboard/recommendations-list";
import { BenchmarkTable } from "@/components/dashboard/benchmark-table";
import { useRecommendations } from "@/hooks/use-recommendations";
import { BRANDS } from "@/types/domain";
import { formatCurrencyCLP, formatNumber, formatCompact, cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";

export default function RecomendacionesPage() {
  const [brand, setBrand] = useState(BRANDS[0].slug);
  const { data, isLoading } = useRecommendations(brand, 30);

  return (
    <div>
      <Topbar title="Recomendaciones IA" />

      <div className="p-6 space-y-5 max-w-[1200px]">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-accent" /> Marketing Advisor IA
            </h2>
            <p className="text-sm text-muted">Análisis estratégico automático, listo para presentar en reuniones</p>
          </div>

          <div className="flex items-center rounded-md border border-border p-0.5 bg-surface">
            {BRANDS.map((b) => (
              <button
                key={b.slug}
                onClick={() => setBrand(b.slug)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-[6px] transition-colors",
                  brand === b.slug ? "bg-accent text-accent-foreground" : "text-muted hover:text-foreground"
                )}
              >
                {b.name}
              </button>
            ))}
          </div>
        </div>

        {isLoading || !data ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-32 rounded-xl bg-surface border border-border animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            <Panel title="Resumen ejecutivo" description={`Últimos 30 días — ${data.brand.name}`}>
              <ExecutiveSummaryPanel summary={data.executiveSummary} generatedWithAI={data.generatedWithAI} />
            </Panel>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Panel title="Recomendaciones automáticas" description="Generadas por reglas de negocio en tiempo real">
                <RecommendationsList recommendations={data.recommendations} />
              </Panel>

              <Panel title="Benchmark Chile" description="Tus métricas comparadas con la industria">
                <BenchmarkTable benchmarks={data.benchmarks} />
              </Panel>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Panel title="Top campañas" description="Por cantidad de leads generados">
                <div className="space-y-2">
                  {data.topCampaigns.map((c, i) => (
                    <div key={i} className="flex items-center justify-between rounded-md border border-border bg-surface p-2.5 text-sm">
                      <span className="font-medium">{c.name}</span>
                      <span className="text-xs text-muted">
                        {formatNumber(c.leads)} leads · {formatCurrencyCLP(c.cpl)} CPL
                      </span>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel title="Top publicaciones" description="Por Performance Score">
                <div className="space-y-2">
                  {data.topPosts.map((p, i) => (
                    <div key={i} className="flex items-center justify-between rounded-md border border-border bg-surface p-2.5 text-sm gap-3">
                      <span className="truncate flex-1">{p.copy}</span>
                      <span className="text-xs text-muted shrink-0">
                        {formatCompact(p.engagement)} eng. · {p.performanceScore} pts
                      </span>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
