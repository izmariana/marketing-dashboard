"use client";

import { useState, useMemo } from "react";
import { Topbar } from "@/components/layout/topbar";
import { Panel } from "@/components/dashboard/panel";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { EvolutionChart } from "@/components/charts/evolution-chart";
import { ConversionFunnel } from "@/components/charts/conversion-funnel";
import { MetricHistoryPanel, type MetricHistoryTarget } from "@/components/dashboard/metric-history-panel";
import { useGaSummary, useGaAcquisition, useGaLandingPages, useGaEvents, type GaMetricPoint } from "@/hooks/use-ga";
import { BRANDS } from "@/types/domain";
import { formatNumber, formatPercent, formatCompact, cn } from "@/lib/utils";
import { CheckCircle2, XCircle } from "lucide-react";

const PERIODS = [
  { label: "7 días", value: 7 },
  { label: "30 días", value: 30 },
  { label: "90 días", value: 90 },
];

const EVOLUTION_METRICS: { key: keyof GaMetricPoint; label: string; formatter: (v: number) => string }[] = [
  { key: "users", label: "Usuarios", formatter: formatCompact },
  { key: "newUsers", label: "Usuarios nuevos", formatter: formatCompact },
  { key: "sessions", label: "Sesiones", formatter: formatCompact },
  { key: "engagementRate", label: "Engagement Rate", formatter: formatPercent },
  { key: "pageViews", label: "Páginas vistas", formatter: formatCompact },
  { key: "conversions", label: "Conversiones", formatter: formatNumber },
];

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / previous) * 100;
}

function formatSeconds(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}m ${s}s`;
}

export default function GoogleAnalyticsPage() {
  const [brand, setBrand] = useState(BRANDS[0].slug);
  const [days, setDays] = useState(30);
  const [evolutionMetric, setEvolutionMetric] = useState<keyof GaMetricPoint>("sessions");
  const [historyTarget, setHistoryTarget] = useState<MetricHistoryTarget | null>(null);

  function openHistory(metric: string, label: string, formatter: (v: number) => string) {
    setHistoryTarget({ source: "ga", metric, brand, label, formatter });
  }

  const { data: summary, isLoading } = useGaSummary(brand, days);
  const { data: acquisition } = useGaAcquisition(brand);
  const { data: landingPages } = useGaLandingPages(brand);
  const { data: events } = useGaEvents(brand);

  const evolutionSeries = useMemo(() => {
    if (!summary) return [];
    return summary.series.map((p) => ({ date: p.date, value: Number(p[evolutionMetric]) }));
  }, [summary, evolutionMetric]);

  const funnelStages = useMemo(() => {
    if (!summary || !events) return null;
    const formSubmit = events.events.find((e) => e.eventName === "form_submit")?.eventCount ?? 0;
    const generateLead = events.events.find((e) => e.eventName === "generate_lead")?.eventCount ?? 0;
    return [
      { label: "Usuarios", value: summary.current.users },
      { label: "Sesiones (Landing Page)", value: summary.current.sessions },
      { label: "Interacción (Engaged Sessions)", value: summary.current.engagedSessions },
      { label: "Formulario enviado", value: formSubmit },
      { label: "Lead generado", value: generateLead },
      { label: "Conversión", value: summary.current.conversions },
    ];
  }, [summary, events]);

  return (
    <div>
      <Topbar title="Google Analytics" />

      <div className="p-6 space-y-5 max-w-[1400px]">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Google Analytics</h2>
            <p className="text-sm text-muted">Comportamiento del sitio web, de clic a conversión</p>
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
              {PERIODS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setDays(p.value)}
                  className={cn("px-3 py-1.5 text-xs font-medium rounded-[6px] transition-colors", days === p.value ? "bg-accent text-accent-foreground" : "text-muted hover:text-foreground")}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {summary?.source === "mock" && (
          <div className="rounded-lg border border-accent/30 bg-accent-soft p-3 text-xs text-accent">
            Mostrando datos de ejemplo. Conecta tu Property de GA4 en Configuración para ver tráfico real.
          </div>
        )}

        {isLoading || !summary ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-24 rounded-xl bg-surface border border-border animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Usuarios" value={formatCompact(summary.current.users)} changePercent={pctChange(summary.current.users, summary.previous.users)} onClick={() => openHistory("users", "Usuarios", formatCompact)} />
            <KpiCard label="Usuarios nuevos" value={formatCompact(summary.current.newUsers)} changePercent={pctChange(summary.current.newUsers, summary.previous.newUsers)} onClick={() => openHistory("newUsers", "Usuarios nuevos", formatCompact)} />
            <KpiCard label="Sesiones" value={formatCompact(summary.current.sessions)} changePercent={pctChange(summary.current.sessions, summary.previous.sessions)} onClick={() => openHistory("sessions", "Sesiones", formatCompact)} />
            <KpiCard label="Engagement Rate" value={formatPercent(summary.current.engagementRate)} changePercent={pctChange(summary.current.engagementRate, summary.previous.engagementRate)} onClick={() => openHistory("engagementRate", "Engagement Rate", formatPercent)} />
            <KpiCard label="Tiempo promedio" value={formatSeconds(summary.current.avgEngagementSec)} changePercent={pctChange(summary.current.avgEngagementSec, summary.previous.avgEngagementSec)} onClick={() => openHistory("avgEngagementSec", "Tiempo promedio", formatSeconds)} />
            <KpiCard label="Páginas vistas" value={formatCompact(summary.current.pageViews)} changePercent={pctChange(summary.current.pageViews, summary.previous.pageViews)} onClick={() => openHistory("pageViews", "Páginas vistas", formatCompact)} />
            <KpiCard label="Conversiones" value={formatNumber(summary.current.conversions)} changePercent={pctChange(summary.current.conversions, summary.previous.conversions)} onClick={() => openHistory("conversions", "Conversiones", formatNumber)} />
            <KpiCard label="Tasa de conversión" value={formatPercent(summary.current.conversionRate)} changePercent={pctChange(summary.current.conversionRate, summary.previous.conversionRate)} onClick={() => openHistory("conversionRate", "Tasa de conversión", formatPercent)} />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Panel
            className="lg:col-span-2"
            title="Evolución"
            description="Evolución diaria en el período seleccionado"
            action={
              <select
                value={evolutionMetric}
                onChange={(e) => setEvolutionMetric(e.target.value as keyof GaMetricPoint)}
                className="text-xs rounded-md border border-border bg-surface-2 px-2 py-1.5 outline-none focus:border-accent"
              >
                {EVOLUTION_METRICS.map((m) => (
                  <option key={m.key} value={m.key}>{m.label}</option>
                ))}
              </select>
            }
          >
            <EvolutionChart data={evolutionSeries} valueFormatter={EVOLUTION_METRICS.find((m) => m.key === evolutionMetric)?.formatter} color="var(--brand-inversiones)" />
          </Panel>

          <Panel title="Embudo de conversión" description="Usuarios → Landing Page → Interacción → Formulario → Lead → Conversión">
            {funnelStages && <ConversionFunnel stages={funnelStages} />}
          </Panel>
        </div>

        <Panel title="Adquisición de tráfico" description="De dónde vienen tus usuarios">
          {acquisition && (
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted border-b border-border">
                    <th className="pb-2 font-medium">Canal</th>
                    <th className="pb-2 font-medium">Fuente</th>
                    <th className="pb-2 font-medium text-right">Usuarios</th>
                    <th className="pb-2 font-medium text-right">Sesiones</th>
                    <th className="pb-2 font-medium text-right">Engagement</th>
                    <th className="pb-2 font-medium text-right">Conversiones</th>
                  </tr>
                </thead>
                <tbody>
                  {[...acquisition.sources]
                    .sort((a, b) => b.sessions - a.sessions)
                    .map((s, i) => (
                      <tr key={i} className="border-b border-border last:border-0">
                        <td className="py-2.5 font-medium">{s.channel}</td>
                        <td className="py-2.5 text-muted">{s.source}</td>
                        <td className="py-2.5 text-right tabular-nums">{formatCompact(s.users)}</td>
                        <td className="py-2.5 text-right tabular-nums">{formatCompact(s.sessions)}</td>
                        <td className="py-2.5 text-right tabular-nums">{formatPercent(s.engagementRate)}</td>
                        <td className="py-2.5 text-right tabular-nums">{formatNumber(s.conversions)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Panel title="Landing pages" description="Páginas de entrada con mejor y peor desempeño">
            {landingPages && (
              <div className="space-y-2 max-h-96 overflow-y-auto scrollbar-thin">
                {landingPages.pages.map((p, i) => (
                  <div key={i} className="rounded-md border border-border bg-surface p-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium truncate">{p.path}</span>
                      <span className="text-[11px] text-muted shrink-0">{formatCompact(p.sessions)} sesiones</span>
                    </div>
                    <p className="text-[11px] text-muted truncate mb-1">{p.title}</p>
                    <div className="flex items-center gap-3 text-[11px] text-muted">
                      <span>{formatPercent(p.engagementRate)} engagement</span>
                      <span>{formatNumber(p.conversions)} conversiones</span>
                      <span>{formatPercent(p.exitRate)} salida</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Eventos" description="Todos los eventos configurados en GA4">
            {events && (
              <div className="space-y-1.5 max-h-96 overflow-y-auto scrollbar-thin">
                {events.events.map((e, i) => (
                  <div key={i} className="flex items-center justify-between rounded-md border border-border bg-surface p-2.5 text-sm">
                    <span className="flex items-center gap-2">
                      {e.isConversion ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : <XCircle className="h-3.5 w-3.5 text-muted" />}
                      <code className="text-xs">{e.eventName}</code>
                    </span>
                    <span className="text-xs text-muted">{formatCompact(e.eventCount)} · {formatCompact(e.totalUsers)} usuarios</span>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>

      <MetricHistoryPanel target={historyTarget} onClose={() => setHistoryTarget(null)} />
    </div>
  );
}
