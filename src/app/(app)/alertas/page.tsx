"use client";

import { useState, useMemo } from "react";
import { Topbar } from "@/components/layout/topbar";
import { Panel } from "@/components/dashboard/panel";
import { useAlerts, useMarkAlertRead } from "@/hooks/use-alerts";
import { BRANDS } from "@/types/domain";
import { cn } from "@/lib/utils";
import { AlertOctagon, AlertTriangle, Info, Check, Lightbulb } from "lucide-react";

const SEVERITY_CONFIG = {
  CRITICAL: { icon: AlertOctagon, className: "border-danger/30 bg-danger/5", badge: "bg-danger/15 text-danger", label: "Crítica" },
  WARNING: { icon: AlertTriangle, className: "border-warning/30 bg-warning/5", badge: "bg-warning/15 text-warning", label: "Advertencia" },
  INFO: { icon: Info, className: "border-border bg-surface", badge: "bg-muted/15 text-muted", label: "Info" },
};

const TYPE_LABEL: Record<string, string> = {
  CTR_DROP: "CTR bajo",
  CPL_INCREASE: "CPL alto",
  CAMPAIGN_STOPPED_DELIVERY: "Campaña sin entrega",
  HIGH_FREQUENCY: "Frecuencia alta",
  BUDGET_DEPLETING: "Presupuesto por agotarse",
  ENGAGEMENT_DROP: "Engagement en baja",
  FOLLOWER_DROP: "Caída de seguidores",
  POST_UNDERPERFORMING: "Publicación bajo rendimiento",
  LANDING_PAGE_ABANDONMENT: "Abandono en landing page",
  CAMPAIGN_NO_RESULTS: "Campaña sin resultados",
};

export default function AlertasPage() {
  const [brand, setBrand] = useState<string>("");
  const [severityFilter, setSeverityFilter] = useState<string>("");
  const [showRead, setShowRead] = useState(false);
  const { data, isLoading } = useAlerts(brand || undefined);
  const markRead = useMarkAlertRead();

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.alerts.filter((a) => {
      if (!showRead && a.isRead) return false;
      if (severityFilter && a.severity !== severityFilter) return false;
      return true;
    });
  }, [data, showRead, severityFilter]);

  const unreadCount = data?.alerts.filter((a) => !a.isRead).length ?? 0;

  return (
    <div>
      <Topbar title="Centro de Alertas" alertCount={unreadCount} />

      <div className="p-6 space-y-5 max-w-[1000px]">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Centro de Alertas</h2>
            <p className="text-sm text-muted">Detección automática de problemas, con explicación y recomendación de acción</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select value={brand} onChange={(e) => setBrand(e.target.value)} className="text-xs rounded-md border border-border bg-surface px-2.5 py-1.5 outline-none focus:border-accent">
              <option value="">Todas las marcas</option>
              {BRANDS.map((b) => <option key={b.slug} value={b.slug}>{b.name}</option>)}
            </select>
            <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} className="text-xs rounded-md border border-border bg-surface px-2.5 py-1.5 outline-none focus:border-accent">
              <option value="">Toda severidad</option>
              <option value="CRITICAL">Crítica</option>
              <option value="WARNING">Advertencia</option>
              <option value="INFO">Info</option>
            </select>
            <button
              onClick={() => setShowRead((v) => !v)}
              className={cn("text-xs font-medium rounded-md border px-2.5 py-1.5 transition-colors", showRead ? "bg-accent text-accent-foreground border-accent" : "border-border hover:bg-surface")}
            >
              {showRead ? "Ocultar leídas" : "Mostrar leídas"}
            </button>
          </div>
        </div>

        <Panel title={`${filtered.length} alertas`} description={data?.source === "mock" ? "Datos de ejemplo — conecta tus cuentas para ver alertas reales" : undefined}>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-20 rounded-lg bg-surface-2 animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted">Sin alertas activas para este filtro. 🎉</p>
          ) : (
            <div className="space-y-2.5">
              {filtered.map((alert) => {
                const brandMeta = BRANDS.find((b) => b.slug === alert.brandSlug);
                const config = SEVERITY_CONFIG[alert.severity];
                const Icon = config.icon;
                return (
                  <div key={alert.id} className={cn("rounded-lg border p-3.5", config.className, alert.isRead && "opacity-60")}>
                    <div className="flex items-start gap-3">
                      <Icon className="h-4 w-4 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium", config.badge)}>{config.label}</span>
                          <span className="text-[11px] text-muted">{TYPE_LABEL[alert.type] ?? alert.type}</span>
                          {brandMeta && (
                            <span className="text-[11px] text-muted flex items-center gap-1">
                              <span className="h-1.5 w-1.5 rounded-full" style={{ background: brandMeta.themeColor }} /> {brandMeta.name}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-foreground/90 mb-1.5">{alert.message}</p>
                        {alert.recommendation && (
                          <p className="text-xs text-accent flex items-start gap-1.5">
                            <Lightbulb className="h-3 w-3 shrink-0 mt-0.5" /> {alert.recommendation}
                          </p>
                        )}
                      </div>
                      {!alert.isRead && (
                        <button
                          onClick={() => markRead.mutate(alert.id)}
                          className="text-[11px] text-muted hover:text-accent flex items-center gap-1 shrink-0"
                        >
                          <Check className="h-3 w-3" /> Marcar leída
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
