import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Alert } from "@/types/domain";

export function useAlerts(brand?: string) {
  return useQuery<{ alerts: Alert[]; source: string }>({
    queryKey: ["alerts-center", brand],
    queryFn: async () => {
      const params = brand ? `?brand=${brand}` : "";
      const res = await fetch(`/api/alerts${params}`);
      if (!res.ok) throw new Error("No se pudieron cargar las alertas");
      return res.json();
    },
  });
}

export function useMarkAlertRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (alertId: string) => {
      const res = await fetch("/api/alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertId }),
      });
      if (!res.ok) throw new Error("No se pudo marcar como leída");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts-center"] });
    },
  });
}
