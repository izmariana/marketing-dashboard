"use client";

import { useState } from "react";
import { Panel } from "@/components/dashboard/panel";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { EvolutionChart } from "@/components/charts/evolution-chart";
import { MetricHistoryPanel, type MetricHistoryTarget } from "@/components/dashboard/metric-history-panel";
import { useFollowers } from "@/hooks/use-followers";
import { formatCompact, formatNumber } from "@/lib/utils";

export function FollowersSection({
  brand,
  network,
  days,
  accentColor = "var(--accent)",
}: {
  brand: string;
  network: "INSTAGRAM" | "FACEBOOK" | "TIKTOK";
  days: number;
  accentColor?: string;
}) {
  const { data, isLoading } = useFollowers(brand, network, days);
  const [historyTarget, setHistoryTarget] = useState<MetricHistoryTarget | null>(null);

  function openHistory(metric: string, label: string, formatter: (v: number) => string) {
    setHistoryTarget({ source: "followers", metric, brand, network, label, formatter });
  }

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="h-24 rounded-xl bg-surface border border-border animate-pulse lg:col-span-1" />
        <div className="h-24 rounded-xl bg-surface border border-border animate-pulse lg:col-span-1" />
        <div className="h-24 rounded-xl bg-surface border border-border animate-pulse lg:col-span-1" />
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <KpiCard label="Seguidores" value={formatCompact(data.current)} delay={0} onClick={() => openHistory("followers", "Seguidores", formatCompact)} />
        <KpiCard label="Nuevos seguidores" value={formatNumber(data.newInPeriod)} changePercent={data.growthRate} direction="up-is-good" delay={0.05} onClick={() => openHistory("newFollowers", "Nuevos seguidores", formatNumber)} />
        <Panel className="lg:col-span-1" title="Crecimiento" description={`Últimos ${days} días`}>
          <EvolutionChart data={data.series.map((p) => ({ date: p.date, value: p.followers }))} color={accentColor} valueFormatter={formatCompact} height={90} />
        </Panel>
      </div>

      <MetricHistoryPanel target={historyTarget} onClose={() => setHistoryTarget(null)} />
    </>
  );
}
