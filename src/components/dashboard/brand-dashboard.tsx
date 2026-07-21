"use client";

import { useState } from "react";
import { Topbar } from "@/components/layout/topbar";
import { Panel } from "@/components/dashboard/panel";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { EvolutionChart } from "@/components/charts/evolution-chart";
import { useBrandMetrics } from "@/hooks/use-brand-metrics";
import { formatCurrencyCLP, formatNumber, formatPercent, formatCompact, cn } from "@/lib/utils";
import { AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";

const PERIODS = [
  { label: "7 días", value: 7 },
  { label: "30 días", value: 30 },
  { label: "90 días", value: 90 },
];

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / previous) * 100;
}

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Activa",
  PAUSED: "Pausada",
  COMPLETED: "Finalizada",
  DELETED: "Eliminada",
};

export function BrandDashboard({ slug }: { slug: string }) {
  const [days, setDays] = useState(30);
  const { data, isLoading, error } = useBrandMetrics(slug, days);

  if (error) {
    return <div className="p-6 text-sm text-danger">No se pudo cargar la información de la marca.</div>;
  }

  return (
    <div>
      <Topbar title={data?.brand.name ?? "Marca"} alertCount={data?.alerts.filter((a) => !a.isRead).length ?? 0} />

      <div className="p-6 space-y-6 max-w-[1400px]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {data && <span className="h-3 w-3 rounded-full" style={{ background: data.brand.themeColor }} />}
            <div>
              <h2 className="text-lg font-semibold tracking-tight">{data?.brand.name ?? "Cargando..."}</h2>
              <p className="text-sm text-muted">Rendimiento de campañas de Meta Ads</p>
            </div>
          </div>
          <div className="flex items-center rounded-md border border-border p-0.5 bg-surface">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setDays(p.value)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-[6px] transition-colors",
                  days === p.value ? "bg-accent text-accent-foreground" : "text-muted hover:text-foreground"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {isLoading || !data ? (
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-24 rounded-xl bg-surface border border-border animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard label="Inversión" value={formatCurrencyCLP(data.current.spend)} changePercent={pctChange(data.current.spend, data.previous.spend)} />
              <KpiCard label="Alcance" value={formatCompact(data.current.reach)} changePercent={pctChange(data.current.reach, data.previous.reach)} />
              <KpiCard label="Impresiones" value={formatCompact(data.current.impressions)} changePercent={pctChange(data.current.impressions, data.previous.impressions)} />
              <KpiCard label="Clicks" value={formatCompact(data.current.clicks)} changePercent={pctChange(data.current.clicks, data.previous.clicks)} />
              <KpiCard label="CTR" value={formatPercent(data.current.ctr)} changePercent={pctChange(data.current.ctr, data.previous.ctr)} />
              <KpiCard label="CPC" value={formatCurrencyCLP(data.current.cpc)} changePercent={pctChange(data.current.cpc, data.previous.cpc)} direction="down-is-good" />
              <KpiCard label="CPM" value={formatCurrencyCLP(data.current.cpm)} changePercent={pctChange(data.current.cpm, data.previous.cpm)} direction="down-is-good" />
              <KpiCard label="Leads" value={formatNumber(data.current.leads)} changePercent={pctChange(data.current.leads, data.previous.leads)} />
              <KpiCard label="CPL" value={formatCurrencyCLP(data.current.cpl)} changePercent={pctChange(data.current.cpl, data.previous.cpl)} direction="down-is-good" />
              <KpiCard label="Conversiones" value={formatNumber(data.current.conversions)} changePercent={pctChange(data.current.conversions, data.previous.conversions)} />
              <KpiCard label="Tasa de conversión" value={formatPercent(data.current.conversionRate)} changePercent={pctChange(data.current.conversionRate, data.previous.conversionRate)} />
              <KpiCard label="Frecuencia" value={data.current.frequency.toFixed(2)} changePercent={pctChange(data.current.frequency, data.previous.frequency)} direction="down-is-good" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Panel className="lg:col-span-2" title="Evolución de inversión" description="Evolución diaria en el período seleccionado">
                <EvolutionChart data={data.series.map((p) => ({ date: p.date, value: p.spend }))} color={data.brand.themeColor} valueFormatter={formatCurrencyCLP} />
              </Panel>

              <Panel title="Alertas activas" description="Detectadas automáticamente sobre esta marca">
                {data.alerts.length === 0 ? (
                  <p className="text-sm text-muted">Sin alertas activas en este período. 🎉</p>
                ) : (
                  <div className="space-y-2.5 max-h-64 overflow-y-auto scrollbar-thin">
                    {data.alerts.map((alert) => (
                      <div key={alert.id} className="flex items-start gap-2 rounded-md border border-border p-2.5">
                        <AlertTriangle
                          className={cn(
                            "h-3.5 w-3.5 mt-0.5 shrink-0",
                            alert.severity === "CRITICAL" ? "text-danger" : alert.severity === "WARNING" ? "text-warning" : "text-muted"
                          )}
                        />
                        <p className="text-xs text-foreground/90">{alert.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>
            </div>

            <Panel title="Campañas" description="Rendimiento por campaña en el período seleccionado">
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted border-b border-border">
                      <th className="pb-2 font-medium">Campaña</th>
                      <th className="pb-2 font-medium">Estado</th>
                      <th className="pb-2 font-medium text-right">Inversión</th>
                      <th className="pb-2 font-medium text-right">CTR</th>
                      <th className="pb-2 font-medium text-right">CPC</th>
                      <th className="pb-2 font-medium text-right">Leads</th>
                      <th className="pb-2 font-medium text-right">CPL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.campaigns.map((c) => (
                      <tr key={c.id} className="border-b border-border last:border-0">
                        <td className="py-2.5 font-medium">{c.name}</td>
                        <td className="py-2.5">
                          <span
                            className={cn(
                              "text-xs px-2 py-0.5 rounded-full",
                              c.status === "ACTIVE" ? "bg-success/15 text-success" : "bg-muted/15 text-muted"
                            )}
                          >
                            {STATUS_LABEL[c.status]}
                          </span>
                        </td>
                        <td className="py-2.5 text-right tabular-nums">{formatCurrencyCLP(c.metrics.spend)}</td>
                        <td className="py-2.5 text-right tabular-nums">
                          <span className="inline-flex items-center gap-1">
                            {c.metrics.ctr >= 2 ? <TrendingUp className="h-3 w-3 text-success" /> : <TrendingDown className="h-3 w-3 text-warning" />}
                            {formatPercent(c.metrics.ctr)}
                          </span>
                        </td>
                        <td className="py-2.5 text-right tabular-nums">{formatCurrencyCLP(c.metrics.cpc)}</td>
                        <td className="py-2.5 text-right tabular-nums">{formatNumber(c.metrics.leads)}</td>
                        <td className="py-2.5 text-right tabular-nums">{formatCurrencyCLP(c.metrics.cpl)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </>
        )}
      </div>
    </div>
  );
}
