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

export function useBrandMetrics(slug: string, days: number) {
  return useQuery<BrandMetricsResponse>({
    queryKey: ["brand-metrics", slug, days],
    queryFn: async () => {
      const res = await fetch(`/api/metrics/${slug}?days=${days}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `No se pudo cargar la marca (código ${res.status})`);
      }
      return res.json();
    },
  });
}
