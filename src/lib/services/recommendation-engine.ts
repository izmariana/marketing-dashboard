import type { MetricPoint } from "@/types/domain";

export interface Recommendation {
  id: string;
  severity: "info" | "warning" | "critical" | "opportunity";
  title: string;
  detail: string;
  metricTrigger: string;
}

/**
 * Reglas de negocio del brief. Cada regla es independiente y puede dispararse
 * en simultáneo con otras. El orden refleja prioridad de lectura en la UI.
 */
export function evaluateRecommendations(metrics: MetricPoint): Recommendation[] {
  const recs: Recommendation[] = [];

  if (metrics.ctr < 1.5) {
    recs.push({
      id: "ctr-low",
      severity: "warning",
      title: "Cambiar creatividades",
      detail: `El CTR actual (${metrics.ctr.toFixed(2)}%) está por debajo de 1.5%. Las creatividades muestran fatiga; renueva imágenes/videos y prueba nuevos ángulos de copy.`,
      metricTrigger: "ctr",
    });
  }

  if (metrics.cpc > 150) {
    recs.push({
      id: "cpc-high",
      severity: "warning",
      title: "Optimizar segmentación",
      detail: `El CPC ($${metrics.cpc.toFixed(0)}) supera el umbral de $150. Revisa la audiencia: acota intereses o activa una audiencia similar (lookalike) más ajustada.`,
      metricTrigger: "cpc",
    });
  }

  if (metrics.frequency > 3) {
    recs.push({
      id: "frequency-high",
      severity: "critical",
      title: "Renovar anuncios",
      detail: `La frecuencia (${metrics.frequency.toFixed(1)}) supera 3. La audiencia está saturada de ver el mismo anuncio; esto suele preceder una caída de CTR.`,
      metricTrigger: "frequency",
    });
  }

  if (metrics.engagementRate > 0 && metrics.engagementRate < BENCHMARKS_CHILE.engagementRate.low) {
    recs.push({
      id: "engagement-low",
      severity: "warning",
      title: "Revisar creatividad y segmentación",
      detail: `La tasa de interacción actual (${metrics.engagementRate.toFixed(2)}%) está por debajo del referente de industria (${BENCHMARKS_CHILE.engagementRate.low}%). El anuncio no está resonando con la audiencia — prueba un formato distinto o ajusta la segmentación.`,
      metricTrigger: "engagementRate",
    });
  }

  if (metrics.ctr > 2.5 && metrics.engagementRate > BENCHMARKS_CHILE.engagementRate.avgHigh) {
    recs.push({
      id: "scale-opportunity",
      severity: "opportunity",
      title: "Escalar presupuesto +20%",
      detail: `CTR alto (${metrics.ctr.toFixed(2)}%) combinado con una tasa de interacción sobre el referente de industria (${metrics.engagementRate.toFixed(2)}%) indica un anuncio ganador. Aumenta el presupuesto diario en 20% de forma gradual.`,
      metricTrigger: "ctr+engagementRate",
    });
  }

  return recs;
}

// ---------------------------------------------------------------------------
// Benchmarks Chile (valores de referencia de industria, actualizables desde
// Configuración → en producción reemplazar por fuente propia o de terceros)
// ---------------------------------------------------------------------------

export const BENCHMARKS_CHILE = {
  ctr: { low: 1.0, avgLow: 1.5, avgHigh: 2.5 }, // %
  cpc: { low: 250, avgLow: 150, avgHigh: 80 }, // $ (invertido: menor es mejor)
  cpm: { low: 8000, avgLow: 5000, avgHigh: 3000 },
  cpl: { low: 3000, avgLow: 2000, avgHigh: 900 },
  engagementRate: { low: 1.0, avgLow: 2.0, avgHigh: 4.0 }, // %
};

export type BenchmarkStatus = "por_debajo" | "promedio" | "superior";

export function compareToBenchmark(
  metric: keyof typeof BENCHMARKS_CHILE,
  value: number
): BenchmarkStatus {
  const b = BENCHMARKS_CHILE[metric];
  const higherIsBetter = metric === "ctr" || metric === "engagementRate";

  if (higherIsBetter) {
    if (value < b.low) return "por_debajo";
    if (value >= b.avgHigh) return "superior";
    return "promedio";
  } else {
    // cpc, cpm, cpl: menor es mejor
    if (value > b.low) return "por_debajo";
    if (value <= b.avgHigh) return "superior";
    return "promedio";
  }
}

// ---------------------------------------------------------------------------
// Performance Score (0-100) para publicaciones
// ---------------------------------------------------------------------------

export interface PerformanceInputs {
  engagement: number;
  ctr: number;
  leads: number;
  reach: number;
  shares: number;
  saves: number;
  // valores máximos observados en el set para normalizar (0-1)
  maxEngagement: number;
  maxCtr: number;
  maxLeads: number;
  maxReach: number;
  maxShares: number;
  maxSaves: number;
}

const WEIGHTS = {
  engagement: 0.25,
  ctr: 0.2,
  leads: 0.2,
  reach: 0.15,
  shares: 0.1,
  saves: 0.1,
};

export function calculatePerformanceScore(i: PerformanceInputs): number {
  const norm = (val: number, max: number) => (max > 0 ? Math.min(val / max, 1) : 0);

  const score =
    norm(i.engagement, i.maxEngagement) * WEIGHTS.engagement +
    norm(i.ctr, i.maxCtr) * WEIGHTS.ctr +
    norm(i.leads, i.maxLeads) * WEIGHTS.leads +
    norm(i.reach, i.maxReach) * WEIGHTS.reach +
    norm(i.shares, i.maxShares) * WEIGHTS.shares +
    norm(i.saves, i.maxSaves) * WEIGHTS.saves;

  return Math.round(score * 100);
}

export function performanceBadge(score: number): { label: string; emoji: string; colorVar: string } {
  if (score >= 85) return { label: "Excelente", emoji: "🟢", colorVar: "var(--score-excellent)" };
  if (score >= 70) return { label: "Muy bueno", emoji: "🔵", colorVar: "var(--score-great)" };
  if (score >= 50) return { label: "Bueno", emoji: "🟡", colorVar: "var(--score-good)" };
  if (score >= 30) return { label: "Mejorable", emoji: "🟠", colorVar: "var(--score-fair)" };
  return { label: "Bajo", emoji: "🔴", colorVar: "var(--score-low)" };
}

export function comparePosts(a: PerformanceInputs & { name: string }, b: PerformanceInputs & { name: string }) {
  const scoreA = calculatePerformanceScore(a);
  const scoreB = calculatePerformanceScore(b);
  const winner = scoreA >= scoreB ? a.name : b.name;
  const diff = Math.abs(scoreA - scoreB);

  return {
    scoreA,
    scoreB,
    winner,
    conclusion: `${winner} obtuvo mejor rendimiento (${Math.max(scoreA, scoreB)} vs ${Math.min(
      scoreA,
      scoreB
    )} pts), una diferencia de ${diff} puntos, impulsada principalmente por ${
      scoreA >= scoreB
        ? a.engagement >= a.ctr * 100
          ? "mayor engagement"
          : "mejor CTR"
        : b.engagement >= b.ctr * 100
        ? "mayor engagement"
        : "mejor CTR"
    }.`,
  };
}
