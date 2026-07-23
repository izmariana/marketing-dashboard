import { useQuery } from "@tanstack/react-query";
import type { Post } from "@/types/domain";

export interface TikTokPostFilters {
  brand?: string;
  sort?: string;
  order?: "asc" | "desc";
}

export function useTikTokPosts(filters: TikTokPostFilters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v) params.set(k, v);
  });

  return useQuery<{ posts: Post[]; source: string }>({
    queryKey: ["tiktok-posts", filters],
    queryFn: async () => {
      const res = await fetch(`/api/tiktok/posts?${params.toString()}`);
      if (!res.ok) throw new Error("No se pudieron cargar las publicaciones de TikTok");
      return res.json();
    },
  });
}

export function useTikTokRanking(month: number, year: number) {
  return useQuery<{ posts: Post[]; month: number; year: number }>({
    queryKey: ["tiktok-ranking", month, year],
    queryFn: async () => {
      const res = await fetch(`/api/tiktok/ranking?month=${month}&year=${year}`);
      if (!res.ok) throw new Error("No se pudo cargar el ranking de TikTok");
      return res.json();
    },
  });
}
