import { useQuery } from "@tanstack/react-query";
import { bucketSeries, rangeToDays, AVERAGE_METRIC_KEYS, type MetricGrain, type RangePreset, type SeriesPoint } from "@/lib/utils/metric-aggregation";

export interface MetricHistoryConfig {
  source: "meta" | "ga" | "followers";
  metric: string;
  brand: string; // slug o "all"
  network?: "INSTAGRAM" | "FACEBOOK" | "TIKTOK" | "LINKEDIN";
}

export function useMetricHistory(
  config: MetricHistoryConfig | null,
  range: RangePreset,
  grain: MetricGrain,
  customSince?: string,
  customUntil?: string
) {
  const query = useQuery<{ series: SeriesPoint[]; source: string }>({
    queryKey: ["metric-history", config, range, customSince, customUntil],
    enabled: Boolean(config),
    queryFn: async () => {
      if (!config) return { series: [], source: "mock" };
      const params = new URLSearchParams({ source: config.source, metric: config.metric, brand: config.brand });
      if (config.network) params.set("network", config.network);

      if (range === "custom" && customSince && customUntil) {
        params.set("since", customSince);
        params.set("until", customUntil);
      } else {
        const days = rangeToDays(range);
        const until = new Date();
        const since = new Date();
        since.setDate(since.getDate() - (days - 1));
        params.set("since", since.toISOString().slice(0, 10));
        params.set("until", until.toISOString().slice(0, 10));
      }

      const res = await fetch(`/api/metrics/history?${params.toString()}`);
      if (!res.ok) throw new Error("No se pudo cargar el histórico de la métrica");
      return res.json();
    },
  });

  const isAverage = config ? AVERAGE_METRIC_KEYS.has(config.metric) : false;
  const bucketed = query.data ? bucketSeries(query.data.series, grain, isAverage) : [];

  return { ...query, bucketed };
}
