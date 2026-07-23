export type ReportPeriod = "daily" | "weekly" | "monthly" | "quarterly" | "yearly";

export interface PeriodRange {
  since: Date;
  until: Date;
  label: string;
}

const PERIOD_LABELS: Record<ReportPeriod, string> = {
  daily: "Reporte Diario",
  weekly: "Reporte Semanal",
  monthly: "Reporte Mensual",
  quarterly: "Reporte Trimestral",
  yearly: "Reporte Anual",
};

/**
 * Calcula el rango de fechas para cada tipo de reporte, alineado a
 * calendario (no solo "últimos N días"):
 *  - Diario: el día de ayer completo
 *  - Semanal: los últimos 7 días hasta hoy
 *  - Mensual: desde el 1° del mes calendario actual hasta hoy
 *  - Trimestral: desde el inicio del trimestre calendario actual hasta hoy
 *  - Anual: desde el 1 de enero del año actual hasta hoy
 */
export function getPeriodRange(period: ReportPeriod, referenceDate: Date = new Date()): PeriodRange {
  const label = PERIOD_LABELS[period];
  const until = new Date(referenceDate);

  if (period === "daily") {
    const yesterday = new Date(referenceDate);
    yesterday.setDate(yesterday.getDate() - 1);
    return { since: yesterday, until: yesterday, label };
  }

  if (period === "weekly") {
    const since = new Date(referenceDate);
    since.setDate(since.getDate() - 6);
    return { since, until, label };
  }

  if (period === "monthly") {
    const since = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
    return { since, until, label };
  }

  if (period === "quarterly") {
    const quarterStartMonth = Math.floor(referenceDate.getMonth() / 3) * 3;
    const since = new Date(referenceDate.getFullYear(), quarterStartMonth, 1);
    return { since, until, label };
  }

  // yearly
  const since = new Date(referenceDate.getFullYear(), 0, 1);
  return { since, until, label };
}
