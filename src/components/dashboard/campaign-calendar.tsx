"use client";

import { useMemo } from "react";
import { BRANDS } from "@/types/domain";
import { formatCurrencyCLP, cn } from "@/lib/utils";
import type { CalendarEvent } from "@/hooks/use-calendar";

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: "var(--success)",
  PAUSED: "var(--muted)",
  COMPLETED: "var(--accent)",
  DELETED: "var(--danger)",
};

export function CampaignCalendar({ events }: { events: CalendarEvent[] }) {
  const { minDate, maxDate, totalDays } = useMemo(() => {
    if (events.length === 0) {
      const today = new Date();
      return { minDate: today, maxDate: today, totalDays: 1 };
    }
    const starts = events.map((e) => new Date(e.startDate).getTime());
    const ends = events.map((e) => new Date(e.endDate).getTime());
    const min = new Date(Math.min(...starts));
    const max = new Date(Math.max(...ends));
    const days = Math.max(1, Math.ceil((max.getTime() - min.getTime()) / 86400000));
    return { minDate: min, maxDate: max, totalDays: days };
  }, [events]);

  const today = new Date();
  const todayOffset = ((today.getTime() - minDate.getTime()) / 86400000 / totalDays) * 100;

  const monthLabels = useMemo(() => {
    const labels: { label: string; leftPct: number }[] = [];
    const cursor = new Date(minDate);
    cursor.setDate(1);
    while (cursor <= maxDate) {
      const offset = ((cursor.getTime() - minDate.getTime()) / 86400000 / totalDays) * 100;
      labels.push({ label: cursor.toLocaleDateString("es-CL", { month: "short", year: "2-digit" }), leftPct: Math.max(0, offset) });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return labels;
  }, [minDate, maxDate, totalDays]);

  return (
    <div className="space-y-4">
      <div className="relative h-5 border-b border-border">
        {monthLabels.map((m) => (
          <span key={m.label} className="absolute text-[11px] text-muted -translate-x-1/2" style={{ left: `${m.leftPct}%` }}>
            {m.label}
          </span>
        ))}
      </div>

      <div className="relative space-y-2.5">
        {todayOffset >= 0 && todayOffset <= 100 && (
          <div className="absolute top-0 bottom-0 w-px bg-accent z-10" style={{ left: `${todayOffset}%` }}>
            <span className="absolute -top-5 -translate-x-1/2 text-[10px] text-accent font-medium">Hoy</span>
          </div>
        )}

        {events.map((event) => {
          const brand = BRANDS.find((b) => b.slug === event.brandSlug);
          const start = new Date(event.startDate);
          const end = new Date(event.endDate);
          const leftPct = ((start.getTime() - minDate.getTime()) / 86400000 / totalDays) * 100;
          const widthPct = Math.max((((end.getTime() - start.getTime()) / 86400000) / totalDays) * 100, 1.5);

          return (
            <div key={event.id} className="flex items-center gap-3">
              <div className="w-40 shrink-0 truncate text-xs">
                <span className="text-foreground/90">{event.name}</span>
                <p className="text-[11px] text-muted">{brand?.name}</p>
              </div>
              <div className="relative flex-1 h-6 rounded bg-surface-2">
                <div
                  className={cn("absolute h-6 rounded flex items-center px-2 text-[10px] font-medium text-white overflow-hidden whitespace-nowrap")}
                  style={{
                    left: `${leftPct}%`,
                    width: `${widthPct}%`,
                    background: STATUS_COLOR[event.status] ?? "var(--muted)",
                  }}
                  title={`${event.name} · ${event.startDate} → ${event.endDate}${event.budget ? ` · ${formatCurrencyCLP(event.budget)}/día` : ""}`}
                >
                  {widthPct > 8 && (event.budget ? `${formatCurrencyCLP(event.budget)}/día` : event.status)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-4 pt-2 border-t border-border">
        {Object.entries(STATUS_COLOR).map(([status, color]) => (
          <span key={status} className="flex items-center gap-1.5 text-[11px] text-muted">
            <span className="h-2 w-2 rounded-full" style={{ background: color }} />
            {status === "ACTIVE" ? "Activa" : status === "PAUSED" ? "Pausada" : status === "COMPLETED" ? "Finalizada" : "Eliminada"}
          </span>
        ))}
      </div>
    </div>
  );
}
