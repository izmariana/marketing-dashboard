"use client";

import { useState, useMemo } from "react";
import { Topbar } from "@/components/layout/topbar";
import { Panel } from "@/components/dashboard/panel";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { EvolutionChart } from "@/components/charts/evolution-chart";
import { BrandComparisonChart } from "@/components/charts/brand-comparison-chart";
import { ConversionFunnel } from "@/components/charts/conversion-funnel";
import { MetricHistoryPanel, type MetricHistoryTarget } from "@/components/dashboard/metric-history-panel";
import { useDashboardSummary } from "@/hooks/use-dashboard-summary";
import { useBrandComparison } from "@/hooks/use-brand-comparison";
import { formatCurrencyCLP, formatNumber, formatPercent, formatCompact, cn } from "@/lib/utils";
import type { MetricPoint } from "@/types/domain";

const PERIODS = [
  { label: "7 días", value: 7 },
  { label: "30 días", value: 30 },
  { label: "90 días", value: 90 },
];

const EVOLUTION_METRICS: { key: keyof MetricPoint; label: string; formatter: (v: number) => string }[] = [
  { key: "spend", label: "Inversión", formatter: formatCurrencyCLP },
  { key: "ctr", label: "CTR", formatter: formatPercent },
  { key: "cpc", label: "CPC", formatter: formatCurrencyCLP },
  { key: "cpm", label: "CPM", formatter: formatCurrencyCLP },
  { key: "leads", label: "Leads", formatter: formatNumber },
  { key: "conversions", label: "Conversiones", formatter: formatNumber },
  { key: "reach", label: "Alcance", formatter: formatCompact },
];

type CompareGroup = "ads" | "organic" | "analytics";
type CompareMetricKey = keyof MetricPoint | "metaFollowers" | "tiktokFollowers" | "linkedinFollowers" | "organicEngagement" | "organicPosts" | "gaSessions" | "gaUsers" | "gaConversions";

interface CompareMetricDef {
  key: CompareMetricKey;
  label: string;
  group: CompareGroup;
  formatter: (v: number) => string;
}

// El comparador entre marcas no se limita a Meta Ads — incluye seguidores
// y engagement orgánico (Meta + TikTok + LinkedIn) y tráfico/conversiones
// de Google Analytics 4, todo en el mismo selector.
const COMPARE_METRICS: CompareMetricDef[] = [
  ...EVOLUTION_METRICS.map((m) => ({ ...m, group: "ads" as const })),
  { key: "metaFollowers", label: "Seguidores Meta (FB+IG)", group: "organic", formatter: formatCompact },
  { key: "tiktokFollowers", label: "Seguidores TikTok", group: "organic", formatter: formatCompact },
  { key: "linkedinFollowers", label: "Seguidores LinkedIn", group: "organic", formatter: formatCompact },
  { key: "organicEngagement", label: "Engagement orgánico total", group: "organic", formatter: formatCompact },
  { key: "organicPosts", label: "Publicaciones orgánicas", group: "organic", formatter: formatNumber },
  { key: "gaSessions", label: "Sesiones (GA4)", group: "analytics", formatter: formatCompact },
  { key: "gaUsers", label: "Usuarios (GA4)", group: "analytics", formatter: formatCompact },
  { key: "gaConversions", label: "Conversiones (GA4)", group: "analytics", formatter: formatNumber },
];

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / previous) * 100;
}

export default function DashboardPage() {
  const [days, setDays] = useState(30);
  const [evolutionMetric, setEvolutionMetric] = useState<keyof MetricPoint>("spend");
  const [compareMetric, setCompareMetric] = useState<CompareMetricKey>("spend");
  const [historyTarget, setHistoryTarget] = useState<MetricHistoryTarget | null>(null);
  const { data, isLoading, error } = useDashboardSummary(days);
  const { data: brandComparison } = useBrandComparison(days);

  function openHistory(metric: string, label: string, formatter: (v: number) => string) {
    setHistoryTarget({ source: "meta", metric, brand: "all", label, formatter });
  }

  const totals = useMemo(() => {
    if (!data) return null;
    const sum = (key: keyof MetricPoint, source: "current" | "previous") =>
      data.brandsData.reduce((acc, b) => acc + (Number(b[source][key]) || 0), 0);

    const currentSpend = sum("spend", "current");
    const currentClicks = sum("clicks", "current");
    const currentImpressions = sum("impressions", "current");
    const currentLeads = sum("leads", "current");
    const currentConversions = sum("conversions", "current");

    const previousSpend = sum("spend", "previous");
    const previousClicks = sum("clicks", "previous");
    const previousImpressions = sum("impressions", "previous");
    const previousLeads = sum("leads", "previous");
    const previousConversions = sum("conversions", "previous");

    return {
      spend: { current: currentSpend, previous: previousSpend },
      reach: { current: sum("reach", "current"), previous: sum("reach", "previous") },
      impressions: { current: currentImpressions, previous: previousImpressions },
      clicks: { current: currentClicks, previous: previousClicks },
      ctr: {
        current: currentImpressions ? (currentClicks / currentImpressions) * 100 : 0,
        previous: previousImpressions ? (previousClicks / previousImpressions) * 100 : 0,
      },
      cpc: {
        current: currentClicks ? currentSpend / currentClicks : 0,
        previous: previousClicks ? previousSpend / previousClicks : 0,
      },
      cpm: {
        current: currentImpressions ? (currentSpend / currentImpressions) * 1000 : 0,
        previous: previousImpressions ? (previousSpend / previousImpressions) * 1000 : 0,
      },
      leads: { current: currentLeads, previous: previousLeads },
      cpl: {
        current: currentLeads ? currentSpend / currentLeads : 0,
        previous: previousLeads ? previousSpend / previousLeads : 0,
      },
      conversions: { current: currentConversions, previous: previousConversions },
      conversionRate: {
        current: currentClicks ? (currentConversions / currentClicks) * 100 : 0,
        previous: previousClicks ? (previousConversions / previousClicks) * 100 : 0,
      },
      frequency: { current: sum("frequency", "current") / data.brandsData.length, previous: sum("frequency", "previous") / data.brandsData.length },
    };
  }, [data]);

  const evolutionSeries = useMemo(() => {
    if (!data) return [];
    // Suma diaria de las 3 marcas para la métrica seleccionada
    const dayCount = data.brandsData[0]?.series.length ?? 0;
    return Array.from({ length: dayCount }).map((_, idx) => {
      const date = data.brandsData[0].series[idx].date;
      const isAverageMetric = evolutionMetric === "ctr" || evolutionMetric === "cpc" || evolutionMetric === "cpm" || evolutionMetric === "conversionRate" || evolutionMetric === "frequency";
      const values = data.brandsData.map((b) => Number(b.series[idx][evolutionMetric]) || 0);
      const value = isAverageMetric ? values.reduce((a, v) => a + v, 0) / values.length : values.reduce((a, v) => a + v, 0);
      return { date, value };
    });
  }, [data, evolutionMetric]);

  const compareMetricDef = COMPARE_METRICS.find((m) => m.key === compareMetric)!;

  const comparisonData = useMemo(() => {
    if (compareMetricDef.group === "ads") {
      if (!data) return [];
      return data.brandsData.map((b) => ({
        name: b.brand.name,
        value: Number(b.current[compareMetric as keyof MetricPoint]) || 0,
        color: b.brand.themeColor,
      }));
    }
    // Orgánico y GA4 vienen de /api/brand-comparison, no de useDashboardSummary
    if (!brandComparison) return [];
    return brandComparison.rows.map((r) => ({
      name: r.brandName,
      value: Number(r[compareMetric as keyof typeof r]) || 0,
      color: r.themeColor,
    }));
  }, [data, brandComparison, compareMetric]);

  if (error) {
    return (
      <div className="p-6">
        <p className="text-sm text-danger">No se pudo cargar el dashboard. Intenta nuevamente.</p>
      </div>
    );
  }

  return (
    <div>
      <Topbar title="Dashboard — Vista general" alertCount={data?.totalAlerts ?? 0} />

      <div className="p-6 space-y-6 max-w-[1400px]">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Vista general</h2>
            <p className="text-sm text-muted">Rendimiento consolidado de tus 3 marcas en Meta Ads</p>
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

        {isLoading || !totals ? (
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-24 rounded-xl bg-surface border border-border animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Inversión" value={formatCurrencyCLP(totals.spend.current)} changePercent={pctChange(totals.spend.current, totals.spend.previous)} direction="up-is-good" delay={0} onClick={() => openHistory("spend", "Inversión", formatCurrencyCLP)} />
            <KpiCard label="Alcance" value={formatCompact(totals.reach.current)} changePercent={pctChange(totals.reach.current, totals.reach.previous)} direction="up-is-good" delay={0.02} onClick={() => openHistory("reach", "Alcance", formatCompact)} />
            <KpiCard label="Impresiones" value={formatCompact(totals.impressions.current)} changePercent={pctChange(totals.impressions.current, totals.impressions.previous)} direction="up-is-good" delay={0.04} onClick={() => openHistory("impressions", "Impresiones", formatCompact)} />
            <KpiCard label="Clicks" value={formatCompact(totals.clicks.current)} changePercent={pctChange(totals.clicks.current, totals.clicks.previous)} direction="up-is-good" delay={0.06} onClick={() => openHistory("clicks", "Clicks", formatCompact)} />
            <KpiCard label="CTR" value={formatPercent(totals.ctr.current)} changePercent={pctChange(totals.ctr.current, totals.ctr.previous)} direction="up-is-good" delay={0.08} onClick={() => openHistory("ctr", "CTR", formatPercent)} />
            <KpiCard label="CPC" value={formatCurrencyCLP(totals.cpc.current)} changePercent={pctChange(totals.cpc.current, totals.cpc.previous)} direction="down-is-good" delay={0.1} onClick={() => openHistory("cpc", "CPC", formatCurrencyCLP)} />
            <KpiCard label="CPM" value={formatCurrencyCLP(totals.cpm.current)} changePercent={pctChange(totals.cpm.current, totals.cpm.previous)} direction="down-is-good" delay={0.12} onClick={() => openHistory("cpm", "CPM", formatCurrencyCLP)} />
            <KpiCard label="Leads" value={formatNumber(totals.leads.current)} changePercent={pctChange(totals.leads.current, totals.leads.previous)} direction="up-is-good" delay={0.14} onClick={() => openHistory("leads", "Leads", formatNumber)} />
            <KpiCard label="CPL" value={formatCurrencyCLP(totals.cpl.current)} changePercent={pctChange(totals.cpl.current, totals.cpl.previous)} direction="down-is-good" delay={0.16} onClick={() => openHistory("cpl", "CPL", formatCurrencyCLP)} />
            <KpiCard label="Conversiones" value={formatNumber(totals.conversions.current)} changePercent={pctChange(totals.conversions.current, totals.conversions.previous)} direction="up-is-good" delay={0.18} onClick={() => openHistory("conversions", "Conversiones", formatNumber)} />
            <KpiCard label="Tasa de conversión" value={formatPercent(totals.conversionRate.current)} changePercent={pctChange(totals.conversionRate.current, totals.conversionRate.previous)} direction="up-is-good" delay={0.2} onClick={() => openHistory("conversionRate", "Tasa de conversión", formatPercent)} />
            <KpiCard label="Frecuencia" value={totals.frequency.current.toFixed(2)} changePercent={pctChange(totals.frequency.current, totals.frequency.previous)} direction="down-is-good" delay={0.22} onClick={() => openHistory("frequency", "Frecuencia", (v) => v.toFixed(2))} />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Panel
            className="lg:col-span-2"
            title="Evolución"
            description="Evolución diaria consolidada de las 3 marcas"
            action={
              <select
                value={evolutionMetric}
                onChange={(e) => setEvolutionMetric(e.target.value as keyof MetricPoint)}
                className="text-xs rounded-md border border-border bg-surface-2 px-2 py-1.5 outline-none focus:border-accent"
              >
                {EVOLUTION_METRICS.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </select>
            }
          >
            {data && (
              <EvolutionChart
                data={evolutionSeries}
                valueFormatter={EVOLUTION_METRICS.find((m) => m.key === evolutionMetric)?.formatter}
              />
            )}
          </Panel>

          <Panel title="Embudo de conversión" description="Impresiones → Alcance → Clicks → Leads → Clientes">
            {data && (
              <ConversionFunnel
                stages={[
                  { label: "Impresiones", value: data.funnel.impressions },
                  { label: "Alcance", value: data.funnel.reach },
                  { label: "Clicks", value: data.funnel.clicks },
                  { label: "Leads", value: data.funnel.leads },
                  { label: "Clientes", value: data.funnel.customers },
                ]}
              />
            )}
          </Panel>
        </div>

        <Panel
          title="Comparación entre marcas"
          description="Meta Ads, contenido orgánico (Meta + TikTok + LinkedIn) y Google Analytics 4, lado a lado"
          action={
            <select
              value={compareMetric}
              onChange={(e) => setCompareMetric(e.target.value as CompareMetricKey)}
              className="text-xs rounded-md border border-border bg-surface-2 px-2 py-1.5 outline-none focus:border-accent"
            >
              <optgroup label="Meta Ads">
                {COMPARE_METRICS.filter((m) => m.group === "ads").map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Orgánico">
                {COMPARE_METRICS.filter((m) => m.group === "organic").map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Google Analytics 4">
                {COMPARE_METRICS.filter((m) => m.group === "analytics").map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </optgroup>
            </select>
          }
        >
          {comparisonData.length > 0 && <BrandComparisonChart data={comparisonData} valueFormatter={compareMetricDef.formatter} />}
        </Panel>
      </div>

      <MetricHistoryPanel target={historyTarget} onClose={() => setHistoryTarget(null)} />
    </div>
  );
}
