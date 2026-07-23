export interface SeriesPoint {
  date: string; // YYYY-MM-DD
  value: number;
}

export type MetricGrain = "daily" | "weekly" | "monthly" | "yearly";

// Métricas que son tasas/promedios (CTR, CPC, engagement rate, etc.) — al
// agrupar por semana/mes/año se promedian. El resto (conteos: spend, clicks,
// leads, sesiones...) se suman.
export const AVERAGE_METRIC_KEYS = new Set([
  "ctr",
  "cpc",
  "cpm",
  "cpl",
  "conversionRate",
  "frequency",
  "engagementRate",
  "avgEngagementSec",
]);

function bucketKey(date: Date, grain: MetricGrain): string {
  if (grain === "weekly") {
    // Semana ISO simplificada: lunes como inicio de semana
    const d = new Date(date);
    const day = (d.getDay() + 6) % 7; // 0 = lunes
    d.setDate(d.getDate() - day);
    return d.toISOString().slice(0, 10);
  }
  if (grain === "monthly") {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
  }
  if (grain === "yearly") {
    return `${date.getFullYear()}-01-01`;
  }
  return date.toISOString().slice(0, 10);
}

export function bucketSeries(points: SeriesPoint[], grain: MetricGrain, isAverage: boolean): SeriesPoint[] {
  if (grain === "daily" || points.length === 0) return points;

  const groups = new Map<string, number[]>();
  for (const p of points) {
    const key = bucketKey(new Date(p.date), grain);
    const arr = groups.get(key) ?? [];
    arr.push(p.value);
    groups.set(key, arr);
  }

  return Array.from(groups.entries())
    .map(([date, values]) => ({
      date,
      value: isAverage ? values.reduce((a, v) => a + v, 0) / values.length : values.reduce((a, v) => a + v, 0),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export type RangePreset = "today" | "7d" | "30d" | "90d" | "12m" | "all" | "custom";

export function rangeToDays(range: RangePreset): number {
  switch (range) {
    case "today":
      return 1;
    case "7d":
      return 7;
    case "30d":
      return 30;
    case "90d":
      return 90;
    case "12m":
      return 365;
    case "all":
      return 400; // tope razonable para datos simulados; con datos reales se usa la fecha del primer snapshot
    default:
      return 30;
  }
}
