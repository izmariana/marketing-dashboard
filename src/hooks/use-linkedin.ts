import { useQuery } from "@tanstack/react-query";
import type { Post } from "@/types/domain";

export interface LinkedInPostFilters {
  brand?: string;
  sort?: string;
  order?: "asc" | "desc";
}

export function useLinkedInPosts(filters: LinkedInPostFilters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v) params.set(k, v);
  });

  return useQuery<{ posts: Post[]; source: string }>({
    queryKey: ["linkedin-posts", filters],
    queryFn: async () => {
      const res = await fetch(`/api/linkedin/posts?${params.toString()}`);
      if (!res.ok) throw new Error("No se pudieron cargar las publicaciones de LinkedIn");
      return res.json();
    },
  });
}

export function useLinkedInRanking(month: number, year: number) {
  return useQuery<{ posts: Post[]; month: number; year: number }>({
    queryKey: ["linkedin-ranking", month, year],
    queryFn: async () => {
      const res = await fetch(`/api/linkedin/ranking?month=${month}&year=${year}`);
      if (!res.ok) throw new Error("No se pudo cargar el ranking de LinkedIn");
      return res.json();
    },
  });
}
