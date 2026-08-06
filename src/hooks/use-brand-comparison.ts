import { useQuery } from "@tanstack/react-query";
import type { BrandComparisonRow } from "@/app/api/brand-comparison/route";

export function useBrandComparison(days: number) {
  return useQuery<{ rows: BrandComparisonRow[]; days: number; source: string }>({
    queryKey: ["brand-comparison", days],
    queryFn: async () => {
      const res = await fetch(`/api/brand-comparison?days=${days}`);
      if (!res.ok) throw new Error("No se pudo cargar la comparación entre marcas");
      return res.json();
    },
  });
}
