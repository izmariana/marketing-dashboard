"use client";

import { useState } from "react";
import { Topbar } from "@/components/layout/topbar";
import { Panel } from "@/components/dashboard/panel";
import { useReportHistory } from "@/hooks/use-report-history";
import { BRANDS } from "@/types/domain";
import { cn } from "@/lib/utils";
import { FileText, FileSpreadsheet, FileDown, Download, Loader2 } from "lucide-react";

const FORMATS = [
  { value: "pdf", label: "PDF", description: "Reporte Ejecutivo IA completo, listo para gerencia", icon: FileText },
  { value: "xlsx", label: "Excel", description: "KPIs, top campañas y top publicaciones en hojas separadas", icon: FileSpreadsheet },
  { value: "csv", label: "CSV", description: "Datos crudos para análisis en otras herramientas", icon: FileDown },
];

const PERIODS = [
  { value: "daily", label: "Diario", description: "El día de ayer" },
  { value: "weekly", label: "Semanal", description: "Últimos 7 días" },
  { value: "monthly", label: "Mensual", description: "Mes calendario actual" },
  { value: "quarterly", label: "Trimestral", description: "Trimestre calendario actual" },
  { value: "yearly", label: "Anual", description: "Año calendario actual" },
  { value: "custom", label: "Personalizado", description: "Elige tú el rango exacto de fechas" },
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
function monthAgoIso() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

export default function ReportesPage() {
  const [brand, setBrand] = useState<string>(BRANDS[0].slug);
  const [period, setPeriod] = useState("monthly");
  const [customSince, setCustomSince] = useState(monthAgoIso());
  const [customUntil, setCustomUntil] = useState(todayIso());
  const [dateError, setDateError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const { data: history, isLoading: historyLoading, refetch } = useReportHistory();

  async function handleExport(format: string) {
    if (period === "custom") {
      if (!customSince || !customUntil) {
        setDateError("Elige la fecha de inicio y la de término.");
        return;
      }
      if (customSince > customUntil) {
        setDateError("La fecha de inicio no puede ser posterior a la de término.");
        return;
      }
    }
    setDateError(null);
    setDownloading(format);
    try {
      const query =
        period === "custom"
          ? `brand=${brand}&format=${format}&since=${customSince}&until=${customUntil}`
          : `brand=${brand}&format=${format}&period=${period}`;
      const res = await fetch(`/api/reports/export?${query}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setDateError(body?.error ?? "No se pudo generar el reporte");
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="(.+)"/);
      a.href = url;
      a.download = match?.[1] ?? `reporte.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      refetch();
    } finally {
      setDownloading(null);
    }
  }

  const brandName = BRANDS.find((b) => b.slug === brand)?.name;
  const periodMeta = PERIODS.find((p) => p.value === period);

  return (
    <div>
      <Topbar title="Reportes" />

      <div className="p-6 space-y-5 max-w-[1000px]">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Reportes</h2>
          <p className="text-sm text-muted">Exporta el Reporte Ejecutivo IA en el formato y período que necesites</p>
        </div>

        <Panel title="Generar reporte">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Marca</label>
              <select value={brand} onChange={(e) => setBrand(e.target.value)} className="text-sm rounded-md border border-border bg-surface-2 px-3 py-2 outline-none focus:border-accent">
                {BRANDS.map((b) => <option key={b.slug} value={b.slug}>{b.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Período</label>
              <div className="flex items-center rounded-md border border-border p-0.5 bg-surface w-fit flex-wrap">
                {PERIODS.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => setPeriod(p.value)}
                    className={cn(
                      "px-3 py-1.5 text-xs font-medium rounded-[6px] transition-colors",
                      period === p.value ? "bg-accent text-accent-foreground" : "text-muted hover:text-foreground"
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              {periodMeta && <p className="text-[11px] text-muted mt-1.5">{periodMeta.description}</p>}
            </div>

            {period === "custom" && (
              <div className="flex items-end gap-3 flex-wrap">
                <div>
                  <label className="block text-xs font-medium text-muted mb-1.5">Desde</label>
                  <input
                    type="date"
                    value={customSince}
                    max={customUntil}
                    onChange={(e) => setCustomSince(e.target.value)}
                    className="text-sm rounded-md border border-border bg-surface-2 px-3 py-2 outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted mb-1.5">Hasta</label>
                  <input
                    type="date"
                    value={customUntil}
                    min={customSince}
                    max={todayIso()}
                    onChange={(e) => setCustomUntil(e.target.value)}
                    className="text-sm rounded-md border border-border bg-surface-2 px-3 py-2 outline-none focus:border-accent"
                  />
                </div>
              </div>
            )}

            {dateError && <p className="text-xs text-danger">{dateError}</p>}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {FORMATS.map((f) => {
                const Icon = f.icon;
                const isLoading = downloading === f.value;
                return (
                  <button
                    key={f.value}
                    onClick={() => handleExport(f.value)}
                    disabled={Boolean(downloading)}
                    className={cn(
                      "text-left rounded-lg border border-border bg-surface p-4 hover:border-accent/50 transition-colors disabled:opacity-50",
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Icon className="h-5 w-5 text-accent" />
                      {isLoading ? <Loader2 className="h-4 w-4 animate-spin text-accent" /> : <Download className="h-4 w-4 text-muted" />}
                    </div>
                    <p className="text-sm font-medium">{f.label}</p>
                    <p className="text-xs text-muted mt-0.5">{f.description}</p>
                  </button>
                );
              })}
            </div>

            <p className="text-xs text-muted">
              {period === "custom" ? (
                <>
                  Se exportará el rango del <span className="font-medium text-foreground">{customSince}</span> al{" "}
                  <span className="font-medium text-foreground">{customUntil}</span> de{" "}
                  <span className="font-medium text-foreground">{brandName}</span>.
                </>
              ) : (
                <>
                  Se exportará el {periodMeta?.label.toLowerCase()} de <span className="font-medium text-foreground">{brandName}</span> ({periodMeta?.description.toLowerCase()}).
                </>
              )}
            </p>
          </div>
        </Panel>

        <Panel title="Historial de reportes" description="Reportes generados anteriormente">
          {!historyLoading && history?.source === "mock" && (
            <p className="text-sm text-muted">
              El historial persistente requiere una base de datos conectada. Mientras tanto, cada reporte se genera y descarga al instante — pruébalo con los botones de arriba.
            </p>
          )}
          {historyLoading && <p className="text-sm text-muted">Cargando historial...</p>}
          {history && history.reports.length > 0 && (
            <div className="space-y-2">
              {history.reports.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-md border border-border bg-surface p-2.5 text-sm">
                  <div>
                    <p className="font-medium">{r.format} · {new Date(r.createdAt).toLocaleDateString("es-CL")}</p>
                    <p className="text-xs text-muted truncate max-w-md">{r.summary}</p>
                  </div>
                  <span className="text-xs text-muted shrink-0">{r.createdBy?.name}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
