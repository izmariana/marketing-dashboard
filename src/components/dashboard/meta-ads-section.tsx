"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Panel } from "@/components/dashboard/panel";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { EvolutionChart } from "@/components/charts/evolution-chart";
import { useBrandMetrics } from "@/hooks/use-brand-metrics";
import { MetricHistoryPanel, type MetricHistoryTarget } from "@/components/dashboard/metric-history-panel";
import { formatCurrencyCLP, formatNumber, formatPercent, formatCompact, cn } from "@/lib/utils";
import { AlertTriangle, TrendingUp, TrendingDown, RotateCcw, Loader2 } from "lucide-react";

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

export function MetaAdsSection({ slug, days, range }: { slug: string; days: number; range?: { since: string; until: string } }) {
  const [historyTarget, setHistoryTarget] = useState<MetricHistoryTarget | null>(null);
  const { data, isLoading, error } = useBrandMetrics(slug, days, range);
  const queryClient = useQueryClient();
  const [resetting, setResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  function openHistory(metric: string, label: string, formatter: (v: number) => string) {
    setHistoryTarget({ source: "meta", metric, brand: slug, label, formatter });
  }

  async function handleResetHistory() {
    if (!confirm("Esto borra el histórico de Meta Ads guardado para esta marca y vuelve a traer los últimos 90 días desde cero. No afecta tus publicaciones ni tu configuración. ¿Continuar?")) {
      return;
    }
    setResetting(true);
    setResetMessage(null);
    try {
      const res = await fetch(`/api/settings/reset-meta-history?brandSlug=${slug}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setResetMessage(data.error ?? "No se pudo reiniciar el historial.");
      } else {
        setResetMessage(`Listo: se borraron ${data.deletedSnapshots} registros viejos y se sincronizaron ${data.resync?.snapshotsInserted ?? 0} nuevos.`);
        queryClient.invalidateQueries({ queryKey: ["brand-metrics", slug] });
      }
    } catch {
      setResetMessage("No se pudo conectar con el servidor.");
    } finally {
      setResetting(false);
      setTimeout(() => setResetMessage(null), 10000);
    }
  }

  if (error) {
    return <div className="text-sm text-danger">{error instanceof Error ? error.message : "No se pudo cargar la información de la marca."}</div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Meta Ads</h2>
          <p className="text-sm text-muted">Rendimiento de campañas pagadas de Facebook e Instagram</p>
        </div>
        <div className="text-right">
          <button
            onClick={handleResetHistory}
            disabled={resetting}
            className="flex items-center gap-1.5 text-xs font-medium rounded-md border border-border px-2.5 py-1.5 hover:bg-surface transition-colors disabled:opacity-60"
            title="Borra el histórico guardado y sincroniza de nuevo desde cero — útil si los números no coinciden con Business Manager"
          >
            {resetting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
            {resetting ? "Reiniciando..." : "Reiniciar historial y resincronizar"}
          </button>
          {resetMessage && <p className="text-[11px] text-muted mt-1 max-w-xs">{resetMessage}</p>}
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
            <KpiCard label="Inversión" value={formatCurrencyCLP(data.current.spend)} changePercent={pctChange(data.current.spend, data.previous.spend)} onClick={() => openHistory("spend", "Inversión", formatCurrencyCLP)} />
            <KpiCard label="Alcance" value={formatCompact(data.current.reach)} changePercent={pctChange(data.current.reach, data.previous.reach)} onClick={() => openHistory("reach", "Alcance", formatCompact)} />
            <KpiCard label="Impresiones" value={formatCompact(data.current.impressions)} changePercent={pctChange(data.current.impressions, data.previous.impressions)} onClick={() => openHistory("impressions", "Impresiones", formatCompact)} />
            <KpiCard label="Clics al enlace" value={formatCompact(data.current.clicks)} changePercent={pctChange(data.current.clicks, data.previous.clicks)} onClick={() => openHistory("clicks", "Clics al enlace", formatCompact)} />
            <KpiCard label="CTR" value={formatPercent(data.current.ctr)} changePercent={pctChange(data.current.ctr, data.previous.ctr)} onClick={() => openHistory("ctr", "CTR", formatPercent)} />
            <KpiCard label="CPC" value={formatCurrencyCLP(data.current.cpc)} changePercent={pctChange(data.current.cpc, data.previous.cpc)} direction="down-is-good" onClick={() => openHistory("cpc", "CPC", formatCurrencyCLP)} />
            <KpiCard label="CPM" value={formatCurrencyCLP(data.current.cpm)} changePercent={pctChange(data.current.cpm, data.previous.cpm)} direction="down-is-good" onClick={() => openHistory("cpm", "CPM", formatCurrencyCLP)} />
            <KpiCard label="Interacciones" value={formatNumber(data.current.engagement)} changePercent={pctChange(data.current.engagement, data.previous.engagement)} onClick={() => openHistory("engagement", "Interacciones", formatNumber)} />
            <KpiCard label="Tasa de interacción" value={formatPercent(data.current.engagementRate)} changePercent={pctChange(data.current.engagementRate, data.previous.engagementRate)} />
            <KpiCard label="Frecuencia" value={data.current.frequency.toFixed(2)} changePercent={pctChange(data.current.frequency, data.previous.frequency)} direction="down-is-good" onClick={() => openHistory("frequency", "Frecuencia", (v) => v.toFixed(2))} />
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
                      <div>
                        <p className="text-xs text-foreground/90">{alert.message}</p>
                        {alert.recommendation && <p className="text-xs text-accent mt-1">{alert.recommendation}</p>}
                      </div>
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
                    <th className="pb-2 font-medium text-right">Interacciones</th>
                    <th className="pb-2 font-medium text-right">Tasa interacción</th>
                  </tr>
                </thead>
                <tbody>
                  {data.campaigns.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-4 text-center text-muted text-xs">
                        No hay campañas registradas todavía para este período.
                      </td>
                    </tr>
                  ) : (
                    data.campaigns.map((c) => (
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
                        <td className="py-2.5 text-right tabular-nums">{formatNumber(c.metrics.engagement)}</td>
                        <td className="py-2.5 text-right tabular-nums">{formatPercent(c.metrics.engagementRate)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}

      <MetricHistoryPanel target={historyTarget} onClose={() => setHistoryTarget(null)} />
    </div>
  );
}
