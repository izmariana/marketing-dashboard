"use client";

import { useState } from "react";
import { Topbar } from "@/components/layout/topbar";
import { Panel } from "@/components/dashboard/panel";
import { CampaignCalendar } from "@/components/dashboard/campaign-calendar";
import { CampaignDrilldown } from "@/components/dashboard/campaign-drilldown";
import { useCampaigns } from "@/hooks/use-campaigns";
import { useCalendar } from "@/hooks/use-calendar";
import { BRANDS } from "@/types/domain";
import { formatCurrencyCLP, formatNumber, formatPercent, cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, LayoutGrid, CalendarDays } from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Activa",
  PAUSED: "Pausada",
  COMPLETED: "Finalizada",
  DELETED: "Eliminada",
};

const OBJECTIVE_LABEL: Record<string, string> = {
  LEADS: "Leads",
  TRAFFIC: "Tráfico",
  ENGAGEMENT: "Interacción",
  CONVERSIONS: "Conversiones",
  AWARENESS: "Reconocimiento",
  APP_PROMOTION: "Promoción de app",
  SALES: "Ventas",
};

export default function CampanasPage() {
  const [view, setView] = useState<"tabla" | "calendario">("tabla");
  const [brandFilter, setBrandFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [objectiveFilter, setObjectiveFilter] = useState<string>("");
  const [selectedCampaign, setSelectedCampaign] = useState<{ id: string; name: string } | null>(null);

  const { data, isLoading } = useCampaigns({
    brand: brandFilter || undefined,
    status: statusFilter || undefined,
    objective: objectiveFilter || undefined,
    days: 30,
  });
  const { data: calendarData } = useCalendar(brandFilter || undefined);

  return (
    <div>
      <Topbar title="Campañas" />

      <div className="p-6 space-y-5 max-w-[1400px]">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Campañas</h2>
            <p className="text-sm text-muted">Todas las campañas de Meta Ads de tus 3 marcas</p>
          </div>

          <div className="flex items-center gap-2">
            <select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)} className="text-xs rounded-md border border-border bg-surface px-2.5 py-1.5 outline-none focus:border-accent">
              <option value="">Todas las marcas</option>
              {BRANDS.map((b) => (
                <option key={b.slug} value={b.slug}>{b.name}</option>
              ))}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="text-xs rounded-md border border-border bg-surface px-2.5 py-1.5 outline-none focus:border-accent">
              <option value="">Todos los estados</option>
              <option value="ACTIVE">Activa</option>
              <option value="PAUSED">Pausada</option>
              <option value="COMPLETED">Finalizada</option>
            </select>
            <select value={objectiveFilter} onChange={(e) => setObjectiveFilter(e.target.value)} className="text-xs rounded-md border border-border bg-surface px-2.5 py-1.5 outline-none focus:border-accent">
              <option value="">Todos los objetivos</option>
              {Object.entries(OBJECTIVE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>

            <div className="flex items-center rounded-md border border-border p-0.5 bg-surface ml-1">
              <button onClick={() => setView("tabla")} className={cn("p-1.5 rounded-[6px]", view === "tabla" ? "bg-accent text-accent-foreground" : "text-muted")}>
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => setView("calendario")} className={cn("p-1.5 rounded-[6px]", view === "calendario" ? "bg-accent text-accent-foreground" : "text-muted")}>
                <CalendarDays className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {view === "tabla" ? (
          <Panel title="Listado de campañas" description={`${data?.campaigns.length ?? 0} campañas en los últimos 30 días`}>
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-10 rounded-md bg-surface-2 animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted border-b border-border">
                      <th className="pb-2 font-medium">Campaña</th>
                      <th className="pb-2 font-medium">Marca</th>
                      <th className="pb-2 font-medium">Objetivo</th>
                      <th className="pb-2 font-medium">Estado</th>
                      <th className="pb-2 font-medium text-right">Inversión</th>
                      <th className="pb-2 font-medium text-right">CTR</th>
                      <th className="pb-2 font-medium text-right">CPC</th>
                      <th className="pb-2 font-medium text-right">Leads</th>
                      <th className="pb-2 font-medium text-right">CPL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.campaigns.map((c) => {
                      const brand = BRANDS.find((b) => b.slug === c.brandSlug);
                      return (
                        <tr
                          key={c.id}
                          onClick={() => setSelectedCampaign({ id: c.id, name: c.name })}
                          className="border-b border-border last:border-0 cursor-pointer hover:bg-surface-2/60 transition-colors"
                        >
                          <td className="py-2.5 font-medium">{c.name}</td>
                          <td className="py-2.5">
                            <span className="flex items-center gap-1.5 text-xs">
                              <span className="h-2 w-2 rounded-full" style={{ background: brand?.themeColor }} />
                              {brand?.name}
                            </span>
                          </td>
                          <td className="py-2.5 text-xs text-muted">{OBJECTIVE_LABEL[c.objective]}</td>
                          <td className="py-2.5">
                            <span className={cn("text-xs px-2 py-0.5 rounded-full", c.status === "ACTIVE" ? "bg-success/15 text-success" : "bg-muted/15 text-muted")}>
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
                      );
                    })}
                  </tbody>
                </table>
                <p className="text-[11px] text-muted mt-3">Haz clic en una campaña para ver sus conjuntos de anuncios y anuncios individuales.</p>
              </div>
            )}
          </Panel>
        ) : (
          <Panel title="Calendario de campañas" description="Inicio, fin, presupuesto diario y estado">
            {calendarData ? <CampaignCalendar events={calendarData.events} /> : <p className="text-sm text-muted">Cargando calendario...</p>}
          </Panel>
        )}
      </div>

      <CampaignDrilldown campaignId={selectedCampaign?.id ?? null} campaignName={selectedCampaign?.name} onClose={() => setSelectedCampaign(null)} />
    </div>
  );
}
