import { useQuery } from "@tanstack/react-query";
import type { Brand, MetricPoint, Alert } from "@/types/domain";

export interface DashboardBrandData {
  brand: Brand;
  current: MetricPoint;
  previous: MetricPoint;
  series: MetricPoint[];
  alerts: Alert[];
}

export interface DashboardResponse {
  brandsData: DashboardBrandData[];
  totalAlerts: number;
  funnel: { impressions: number; reach: number; clicks: number; leads: number; customers: number };
  days: number;
}

export function useDashboardSummary(days: number) {
  return useQuery<DashboardResponse>({
    queryKey: ["dashboard-summary", days],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard?days=${days}`);
      if (!res.ok) throw new Error("No se pudo cargar el resumen del dashboard");
      return res.json();
    },
  });
}
