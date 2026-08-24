import type { BrandSlug } from "@/types/domain";

/**
 * Qué plataformas usa realmente cada marca — fuente única de verdad,
 * para no repetir esta lista en Comparación, en las pestañas de cada
 * marca, etc. Si una marca activa una plataforma nueva más adelante
 * (ej. Cinco Inversiones empieza a usar TikTok), solo hay que agregarla
 * acá.
 */
export const BRAND_PLATFORMS: Record<BrandSlug, string[]> = {
  segal_deudores: ["meta-ads", "meta-content", "tiktok", "google-analytics"],
  inversiones_cinco: ["meta-ads", "meta-content", "linkedin", "google-analytics"],
  informes_comerciales: ["meta-ads", "meta-content", "google-analytics"],
};

export function getBrandPlatforms(slug: string): string[] {
  return BRAND_PLATFORMS[slug as BrandSlug] ?? ["meta-ads", "meta-content", "google-analytics"];
}
