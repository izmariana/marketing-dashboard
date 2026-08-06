import { useQuery } from "@tanstack/react-query";

export interface FollowerPoint {
  date: string;
  followers: number;
  newFollowers: number;
}

export interface FollowersResponse {
  series: FollowerPoint[];
  current: number;
  newInPeriod: number;
  growthRate: number;
  source: string;
}

export function useFollowers(brand: string, network: "INSTAGRAM" | "FACEBOOK" | "TIKTOK" | "LINKEDIN", days: number) {
  return useQuery<FollowersResponse>({
    queryKey: ["followers", brand, network, days],
    queryFn: async () => {
      const res = await fetch(`/api/followers?brand=${brand}&network=${network}&days=${days}`);
      if (!res.ok) throw new Error("No se pudo cargar el histórico de seguidores");
      return res.json();
    },
  });
}
