import { useQuery } from "@tanstack/react-query";

export interface BrandingSettings {
  platformName: string;
  companyName: string;
  logoDataUrl: string | null;
  faviconDataUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  source: string;
}

export const DEFAULT_BRANDING: BrandingSettings = {
  platformName: "Marketing Segal",
  companyName: "Segal",
  logoDataUrl: null,
  faviconDataUrl: null,
  primaryColor: "#6E56CF",
  secondaryColor: "#3FBF8F",
  source: "default",
};

export function useBranding() {
  return useQuery<BrandingSettings>({
    queryKey: ["branding"],
    queryFn: async () => {
      const res = await fetch("/api/settings/branding");
      if (!res.ok) return DEFAULT_BRANDING;
      return res.json();
    },
    initialData: DEFAULT_BRANDING,
    staleTime: 60_000,
  });
}
