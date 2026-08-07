import { useQuery } from "@tanstack/react-query";
import type { Brand, MetricPoint, Campaign, Alert } from "@/types/domain";

export interface BrandMetricsResponse {
  brand: Brand;
  current: MetricPoint;
  previous: MetricPoint;
  series: MetricPoint[];
  campaigns: Campaign[];
  alerts: Alert[];
}

export function useBrandMetrics(slug: string, days: number, range?: { since: string; until: string }) {
  return useQuery<BrandMetricsResponse>({
    queryKey: ["brand-metrics", slug, days, range?.since, range?.until],
    queryFn: async () => {
      const query = range ? `since=${range.since}&until=${range.until}` : `days=${days}`;
      const res = await fetch(`/api/metrics/${slug}?${query}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `No se pudo cargar la marca (código ${res.status})`);
      }
      return res.json();
    },
  });
}
