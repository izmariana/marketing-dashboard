import { useQuery } from "@tanstack/react-query";
import type { Campaign } from "@/types/domain";

export interface CampaignFilters {
  brand?: string;
  status?: string;
  objective?: string;
  days?: number;
}

export function useCampaigns(filters: CampaignFilters) {
  const params = new URLSearchParams();
  if (filters.brand) params.set("brand", filters.brand);
  if (filters.status) params.set("status", filters.status);
  if (filters.objective) params.set("objective", filters.objective);
  params.set("days", String(filters.days ?? 30));

  return useQuery<{ campaigns: Campaign[]; source: string }>({
    queryKey: ["campaigns", filters],
    queryFn: async () => {
      const res = await fetch(`/api/campaigns?${params.toString()}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `No se pudieron cargar las campañas (código ${res.status})`);
      }
      return res.json();
    },
  });
}

interface AdSetWithAds {
  id: string;
  name: string;
  status: string;
  ads: { id: string; name: string; status: string; spend: number; ctr: number }[];
}

export function useCampaignAdSets(campaignId: string | null) {
  return useQuery<{ adSets: AdSetWithAds[]; source: string }>({
    queryKey: ["campaign-adsets", campaignId],
    enabled: Boolean(campaignId),
    queryFn: async () => {
      const res = await fetch(`/api/campaigns/${campaignId}/adsets`);
      if (!res.ok) throw new Error("No se pudo cargar el detalle de la campaña");
      return res.json();
    },
  });
}
