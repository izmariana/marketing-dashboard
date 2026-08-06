import { useQuery } from "@tanstack/react-query";
import type { Brand, MetricPoint, Post } from "@/types/domain";
import type { GaMetricPoint } from "@/lib/mock/generator";
import type { ComparisonRow } from "@/lib/services/compare-platforms";
import type { FormatStat, DayStat, HourStat, ThemeStat, CtaStat } from "@/lib/services/content-intelligence";

export interface ComparePlatformsResponse {
  brand: Brand;
  meta: MetricPoint;
  ga: GaMetricPoint;
  rows: ComparisonRow[];
  narrative: string[];
  source: string;
}

export function useComparePlatforms(brand: string, days: number) {
  return useQuery<ComparePlatformsResponse>({
    queryKey: ["compare-platforms", brand, days],
    queryFn: async () => {
      const res = await fetch(`/api/compare-platforms?brand=${brand}&days=${days}`);
      if (!res.ok) throw new Error("No se pudo cargar la comparación de plataformas");
      return res.json();
    },
  });
}

export interface ContentIntelligenceResponse {
  postsAnalyzed: number;
  formatStats: FormatStat[];
  bestFormat: FormatStat | null;
  worstFormat: FormatStat | null;
  dayStats: DayStat[];
  bestDay: DayStat | null;
  hourStats: HourStat[];
  bestHour: HourStat | null;
  topThemes: ThemeStat[];
  ctaStats: CtaStat[];
  bestCta: CtaStat | null;
  topPerformers: Post[];
  underPerformers: Post[];
  recommendations: string[];
  limitations: string[];
  source: string;
}

export function useContentIntelligence(brand: string, days: number) {
  return useQuery<ContentIntelligenceResponse>({
    queryKey: ["content-intelligence", brand, days],
    queryFn: async () => {
      const res = await fetch(`/api/content-intelligence?brand=${brand}&days=${days}`);
      if (!res.ok) throw new Error("No se pudo cargar la inteligencia de contenidos");
      return res.json();
    },
  });
}

export interface OrganicPlatformStat {
  network: "META" | "TIKTOK" | "LINKEDIN";
  label: string;
  connected: boolean;
  followers: number | null;
  followerGrowth: number | null;
  posts: number | null;
  totalEngagement: number | null;
  avgEngagementPerPost: number | null;
  avgReach: number | null;
}

export interface OrganicComparisonResponse {
  brand: Brand;
  rows: OrganicPlatformStat[];
  source: string;
}

export function useOrganicComparison(brand: string, days: number) {
  return useQuery<OrganicComparisonResponse>({
    queryKey: ["organic-comparison", brand, days],
    queryFn: async () => {
      const res = await fetch(`/api/organic-comparison?brand=${brand}&days=${days}`);
      if (!res.ok) throw new Error("No se pudo cargar la comparación orgánica");
      return res.json();
    },
  });
}
