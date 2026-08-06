"use client";

import { useEffect } from "react";
import { useBranding } from "@/hooks/use-branding";

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  return [parseInt(clean.slice(0, 2), 16), parseInt(clean.slice(2, 4), 16), parseInt(clean.slice(4, 6), 16)];
}

function readableForeground(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  // Luminancia relativa aproximada — decide si el texto sobre este color debe ser blanco o negro
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? "#14141a" : "#ffffff";
}

/**
 * Aplica el branding guardado en Configuración a toda la app en tiempo real:
 * título de la pestaña, favicon, y color de acento (--accent). No requiere
 * volver a desplegar — los cambios se reflejan apenas se guardan.
 */
export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const { data: branding } = useBranding();

  useEffect(() => {
    if (!branding) return;

    document.title = branding.platformName;

    const root = document.documentElement;
    root.style.setProperty("--accent", branding.primaryColor);
    root.style.setProperty("--accent-foreground", readableForeground(branding.primaryColor));
    root.style.setProperty("--brand-secondary", branding.secondaryColor);

    if (branding.faviconDataUrl) {
      let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      link.href = branding.faviconDataUrl;
    }
  }, [branding]);

  return <>{children}</>;
}
