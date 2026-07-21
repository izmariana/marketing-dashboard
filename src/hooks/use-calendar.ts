import { useQuery } from "@tanstack/react-query";

export interface CalendarEvent {
  id: string;
  brandSlug: string;
  name: string;
  status: string;
  startDate: string;
  endDate: string;
  budget: number | null;
}

export function useCalendar(brand?: string) {
  return useQuery<{ events: CalendarEvent[]; source: string }>({
    queryKey: ["calendar", brand],
    queryFn: async () => {
      const params = brand ? `?brand=${brand}` : "";
      const res = await fetch(`/api/calendar${params}`);
      if (!res.ok) throw new Error("No se pudo cargar el calendario");
      return res.json();
    },
  });
}
