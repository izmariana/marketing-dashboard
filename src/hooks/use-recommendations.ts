import { useQuery } from "@tanstack/react-query";
import type { Brand, MetricPoint } from "@/types/domain";
import type { Recommendation, BenchmarkStatus } from "@/lib/services/recommendation-engine";
import type { ExecutiveSummaryOutput } from "@/lib/services/openai-client";

interface BenchmarkEntry {
  value: number;
  status: BenchmarkStatus;
  reference: Record<string, number>;
}

export interface RecommendationsResponse {
  brand: Brand;
  current: MetricPoint;
  previous: MetricPoint;
  recommendations: Recommendation[];
  benchmarks: Record<"ctr" | "cpc" | "cpm" | "cpl" | "engagementRate", BenchmarkEntry>;
  executiveSummary: ExecutiveSummaryOutput;
  generatedWithAI: boolean;
  topCampaigns: { name: string; spend: number; leads: number; cpl: number }[];
  topPosts: { copy: string; engagement: number; performanceScore: number }[];
}

export function useRecommendations(brand: string, days = 30) {
  return useQuery<RecommendationsResponse>({
    queryKey: ["recommendations", brand, days],
    queryFn: async () => {
      const res = await fetch(`/api/recommendations?brand=${brand}&days=${days}`);
      if (!res.ok) throw new Error("No se pudieron cargar las recomendaciones");
      return res.json();
    },
  });
}
