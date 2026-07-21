import { useQuery } from "@tanstack/react-query";

export interface ReportHistoryItem {
  id: string;
  type: string;
  format: string;
  periodStart: string;
  periodEnd: string;
  summary: string | null;
  createdAt: string;
  createdBy?: { name: string };
}

export function useReportHistory() {
  return useQuery<{ reports: ReportHistoryItem[]; source: string }>({
    queryKey: ["report-history"],
    queryFn: async () => {
      const res = await fetch("/api/reports/history");
      if (!res.ok) throw new Error("No se pudo cargar el historial de reportes");
      return res.json();
    },
  });
}
