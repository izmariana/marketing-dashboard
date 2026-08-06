import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Post, AiPostInsight } from "@/types/domain";

export interface PostFilters {
  brand?: string;
  network?: string;
  campaign?: string;
  month?: string;
  year?: string;
  type?: string;
  funding?: string;
  sort?: string;
  order?: "asc" | "desc";
}

export function usePosts(filters: PostFilters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v) params.set(k, v);
  });

  return useQuery<{ posts: Post[]; source: string }>({
    queryKey: ["posts", filters],
    queryFn: async () => {
      const res = await fetch(`/api/posts?${params.toString()}`);
      if (!res.ok) throw new Error("No se pudieron cargar las publicaciones");
      return res.json();
    },
  });
}

export function usePostAnalysis() {
  const queryClient = useQueryClient();
  return useMutation<{ insight: AiPostInsight; generatedWithAI: boolean }, Error, string>({
    mutationFn: async (postId: string) => {
      const res = await fetch(`/api/posts/${postId}/analyze`, { method: "POST" });
      if (!res.ok) throw new Error("No se pudo generar el análisis con IA");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
  });
}

export interface CreativeAnalysisResult {
  transcript: string;
  framesAnalyzed: number;
  hookAnalysis: string;
  ganchoAnalysis: string;
  cierreAnalysis: string;
  toneOfVoice: string;
  scenario: string;
  cameraWork: string;
  pacingAssessment: string;
  retentionDropAnalysis: string;
}

/**
 * A diferencia de usePostAnalysis (rápido, barato), esto descarga y
 * procesa el video real — puede tardar bastante más y tiene un costo
 * distinto (Whisper + GPT-4o Vision). Por eso siempre es una acción
 * explícita del usuario, nunca automática.
 */
export function usePostCreativeAnalysis() {
  const queryClient = useQueryClient();
  return useMutation<CreativeAnalysisResult, Error, string>({
    mutationFn: async (postId: string) => {
      const res = await fetch(`/api/posts/${postId}/analyze-creative`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo generar el análisis creativo");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
  });
}

export function useComparePosts() {
  return useMutation<
    { postA: Post; postB: Post; scoreA: number; scoreB: number; winner: string; conclusion: string },
    Error,
    { postIdA: string; postIdB: string }
  >({
    mutationFn: async ({ postIdA, postIdB }) => {
      const res = await fetch("/api/posts/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postIdA, postIdB }),
      });
      if (!res.ok) throw new Error("No se pudo comparar las publicaciones");
      return res.json();
    },
  });
}

export function useMonthlyRanking(month: number, year: number) {
  return useQuery<{ posts: Post[]; month: number; year: number }>({
    queryKey: ["ranking", month, year],
    queryFn: async () => {
      const res = await fetch(`/api/posts/ranking?month=${month}&year=${year}`);
      if (!res.ok) throw new Error("No se pudo cargar el ranking");
      return res.json();
    },
  });
}
