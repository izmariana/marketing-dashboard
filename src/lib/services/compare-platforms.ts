import type { MetricPoint } from "@/types/domain";
import type { GaMetricPoint } from "@/lib/mock/generator";

export interface ComparisonRow {
  label: string;
  metaValue: number | null;
  metaLabel: string;
  gaValue: number | null;
  gaLabel: string;
  note: string;
}

export interface PlatformComparisonResult {
  rows: ComparisonRow[];
  narrative: string[];
}

function pctDiff(a: number, b: number): number {
  if (b === 0) return a === 0 ? 0 : 100;
  return ((a - b) / b) * 100;
}

/**
 * Compara métricas de Meta Ads y Google Analytics para el mismo período,
 * y genera explicaciones automáticas de por qué pueden diferir (ventanas
 * de atribución, bloqueadores de anuncios, diferencias metodológicas).
 */
export function comparePlatforms(meta: MetricPoint, ga: GaMetricPoint): PlatformComparisonResult {
  const rows: ComparisonRow[] = [
    {
      label: "Tráfico (Clics vs Sesiones)",
      metaValue: meta.clicks,
      metaLabel: "Clics en anuncios (Meta)",
      gaValue: ga.sessions,
      gaLabel: "Sesiones en el sitio (GA4)",
      note: "Meta cuenta cada clic en el anuncio; GA4 cuenta sesiones reales en el sitio. La diferencia normalmente se explica por bloqueadores de anuncios, clics accidentales, o tiempo de carga de la página.",
    },
    {
      label: "Conversiones",
      metaValue: meta.conversions,
      metaLabel: "Conversiones atribuidas (Meta)",
      gaValue: ga.conversions,
      gaLabel: "Conversiones registradas (GA4)",
      note: "Meta usa su propia ventana de atribución (por defecto 7 días clic / 1 día vista) y puede incluir conversiones que GA4 no captura si el usuario no aceptó cookies o usa Safari/iOS con restricciones de tracking.",
    },
    {
      label: "Leads",
      metaValue: meta.leads,
      metaLabel: "Leads reportados (Meta)",
      gaValue: null,
      gaLabel: "No disponible directamente en GA4",
      note: "GA4 solo puede medir leads si tienes configurado un evento de conversión específico (ej. generate_lead o form_submit) — revisa la sección Eventos en Google Analytics para esa cifra.",
    },
    {
      label: "CTR / Engagement Rate",
      metaValue: meta.ctr,
      metaLabel: "CTR de anuncios (Meta)",
      gaValue: ga.engagementRate,
      gaLabel: "Engagement Rate del sitio (GA4)",
      note: "Son métricas distintas: CTR mide qué tan atractivo es el anuncio; Engagement Rate mide qué tan comprometidos están los usuarios una vez en el sitio. Útiles en conjunto, no directamente comparables 1 a 1.",
    },
    {
      label: "CPC",
      metaValue: meta.cpc,
      metaLabel: "Costo por clic (Meta)",
      gaValue: null,
      gaLabel: "No aplica en GA4",
      note: "El CPC es una métrica exclusiva de la plataforma publicitaria — Google Analytics no gestiona presupuesto ni pujas.",
    },
    {
      label: "Engagement en el sitio",
      metaValue: null,
      metaLabel: "No disponible a nivel de cuenta en Meta Ads",
      gaValue: ga.engagementRate,
      gaLabel: "Engagement Rate (GA4)",
      note: "El engagement dentro del sitio web solo lo mide Google Analytics; Meta solo reporta engagement de sus propias publicaciones/anuncios, no de tu sitio.",
    },
  ];

  const narrative: string[] = [];

  const clickSessionDiff = pctDiff(meta.clicks, ga.sessions);
  if (Math.abs(clickSessionDiff) > 15) {
    narrative.push(
      clickSessionDiff > 0
        ? `Meta reporta ${clickSessionDiff.toFixed(0)}% más clics que las sesiones que GA4 registra en el sitio. Esto es normal y suele deberse a bloqueadores de anuncios, clics duplicados, o usuarios que cierran la página antes de que GA4 registre la sesión.`
        : `GA4 registra ${Math.abs(clickSessionDiff).toFixed(0)}% más sesiones que los clics reportados por Meta. Puede deberse a tráfico de otras campañas o fuentes que también aterrizan en la misma página, o a clics desde el feed que Meta no atribuye 100% a la campaña.`
    );
  }

  const conversionDiff = pctDiff(meta.conversions, ga.conversions);
  if (Math.abs(conversionDiff) > 20) {
    narrative.push(
      conversionDiff > 0
        ? `Meta reporta ${conversionDiff.toFixed(0)}% más conversiones que GA4. La ventana de atribución de Meta (hasta 7 días después del clic) suele ser más generosa que la de GA4, y Meta puede contar conversiones que GA4 no ve por restricciones de cookies en iOS/Safari.`
        : `GA4 registra ${Math.abs(conversionDiff).toFixed(0)}% más conversiones que las que Meta atribuye a sus campañas. Esto sugiere que una parte importante de tus conversiones viene de otros canales (orgánico, directo, otras redes) y no solo de Meta Ads.`
    );
  }

  if (narrative.length === 0) {
    narrative.push("Las métricas de Meta Ads y Google Analytics están razonablemente alineadas para este período — no se detectan discrepancias importantes de atribución.");
  }

  return { rows, narrative };
}
