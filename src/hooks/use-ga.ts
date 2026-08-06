import { useQuery } from "@tanstack/react-query";

export interface GaMetricPoint {
  date: string;
  users: number;
  newUsers: number;
  sessions: number;
  engagedSessions: number;
  engagementRate: number;
  avgEngagementSec: number;
  pageViews: number;
  eventCount: number;
  conversions: number;
  conversionRate: number;
}

export function useGaSummary(brand: string, days: number) {
  return useQuery<{ current: GaMetricPoint; previous: GaMetricPoint; series: GaMetricPoint[]; source: string }>({
    queryKey: ["ga-summary", brand, days],
    queryFn: async () => {
      const res = await fetch(`/api/ga/summary?brand=${brand}&days=${days}`);
      if (!res.ok) throw new Error("No se pudo cargar el resumen de Google Analytics");
      return res.json();
    },
  });
}

export interface GaTrafficRow {
  channel: string;
  source: string;
  users: number;
  sessions: number;
  engagementRate: number;
  conversions: number;
  avgEngagementSec: number;
}

export function useGaAcquisition(brand: string) {
  return useQuery<{ sources: GaTrafficRow[]; source: string }>({
    queryKey: ["ga-acquisition", brand],
    queryFn: async () => {
      const res = await fetch(`/api/ga/acquisition?brand=${brand}`);
      if (!res.ok) throw new Error("No se pudo cargar la adquisición de tráfico");
      return res.json();
    },
  });
}

export interface GaLandingPageRow {
  path: string;
  title: string;
  users: number;
  sessions: number;
  engagementRate: number;
  conversions: number;
  avgEngagementSec: number;
  exitRate: number;
}

export function useGaLandingPages(brand: string) {
  return useQuery<{ pages: GaLandingPageRow[]; source: string }>({
    queryKey: ["ga-landing-pages", brand],
    queryFn: async () => {
      const res = await fetch(`/api/ga/landing-pages?brand=${brand}`);
      if (!res.ok) throw new Error("No se pudieron cargar las landing pages");
      return res.json();
    },
  });
}

export interface GaEventRow {
  eventName: string;
  eventCount: number;
  totalUsers: number;
  isConversion: boolean;
}

export function useGaEvents(brand: string) {
  return useQuery<{ events: GaEventRow[]; source: string }>({
    queryKey: ["ga-events", brand],
    queryFn: async () => {
      const res = await fetch(`/api/ga/events?brand=${brand}`);
      if (!res.ok) throw new Error("No se pudieron cargar los eventos");
      return res.json();
    },
  });
}
