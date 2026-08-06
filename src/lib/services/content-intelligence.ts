import type { Post, PostType } from "@/types/domain";

/**
 * Analiza un conjunto de publicaciones y detecta patrones automáticos:
 * mejor formato, mejor día/hora de publicación, temas frecuentes en el
 * copy de las publicaciones top, y genera recomendaciones accionables.
 *
 * Nota de factibilidad técnica: Meta Graph API no expone la duración de
 * video de forma consistente para contenido orgánico en todos los casos,
 * así que ese análisis específico ("duración de los videos más exitosos")
 * no se incluye aquí — se documenta como limitación en vez de inventar un
 * dato que la API no garantiza entregar.
 */

const STOPWORDS = new Set([
  "que", "para", "con", "los", "las", "una", "uno", "del", "por", "más", "sin", "sobre", "como", "esta",
  "este", "tus", "sus", "the", "and", "de", "la", "el", "en", "y", "a", "tu", "su", "es", "un", "lo", "al",
]);

export interface FormatStat {
  type: PostType;
  count: number;
  avgScore: number;
  avgEngagement: number;
  avgCtr: number;
}

export interface DayStat {
  day: string;
  avgScore: number;
  count: number;
}

export interface HourStat {
  hourRange: string;
  avgScore: number;
  count: number;
}

export interface ThemeStat {
  word: string;
  occurrences: number;
  avgScoreWhenPresent: number;
}

export interface CtaStat {
  phrase: string;
  count: number;
  avgScore: number;
  avgCtr: number;
}

export interface ContentIntelligenceResult {
  postsAnalyzed: number;
  formatStats: FormatStat[];
  bestFormat: FormatStat | null;
  worstFormat: FormatStat | null;
  dayStats: DayStat[];
  bestDay: DayStat | null;
  hourStats: HourStat[];
  bestHour: HourStat | null;
  topThemes: ThemeStat[];
  ctaStats: CtaStat[];
  bestCta: CtaStat | null;
  topPerformers: Post[];
  underPerformers: Post[];
  recommendations: string[];
  limitations: string[];
}

const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

const CTA_PATTERNS = [
  "conoce", "descubre", "agenda", "cotiza", "contáctanos", "contactanos", "solicita", "revisa",
  "consulta", "escríbenos", "escribenos", "postula", "regístrate", "registrate", "simula",
];

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function analyzeContentIntelligence(posts: Post[]): ContentIntelligenceResult {
  const limitations = [
    "Duración de video: Meta Graph API no garantiza este dato para todo el contenido orgánico, así que no se incluye en este análisis para evitar mostrar cifras poco confiables.",
    "Detección de CTA y temas: se basa en coincidencia de palabras clave en el copy, no en una clasificación semántica real — es una aproximación útil, no una medición exacta.",
  ];

  if (posts.length === 0) {
    return {
      postsAnalyzed: 0,
      formatStats: [],
      bestFormat: null,
      worstFormat: null,
      dayStats: [],
      bestDay: null,
      hourStats: [],
      bestHour: null,
      topThemes: [],
      ctaStats: [],
      bestCta: null,
      topPerformers: [],
      underPerformers: [],
      recommendations: ["No hay suficientes publicaciones en el período seleccionado para generar un análisis."],
      limitations,
    };
  }

  // --- Por formato ---
  const byType = new Map<PostType, Post[]>();
  for (const p of posts) {
    const arr = byType.get(p.type) ?? [];
    arr.push(p);
    byType.set(p.type, arr);
  }
  const formatStats: FormatStat[] = Array.from(byType.entries()).map(([type, items]) => ({
    type,
    count: items.length,
    avgScore: Math.round(average(items.map((i) => i.performanceScore))),
    avgEngagement: Math.round(average(items.map((i) => i.engagement))),
    avgCtr: Number(average(items.map((i) => i.ctr)).toFixed(2)),
  }));
  const sortedFormats = [...formatStats].sort((a, b) => b.avgScore - a.avgScore);
  const bestFormat = sortedFormats[0] ?? null;
  const worstFormat = sortedFormats[sortedFormats.length - 1] ?? null;

  // --- Por día de la semana ---
  const byDay = new Map<number, Post[]>();
  for (const p of posts) {
    const day = new Date(p.publishedAt).getDay();
    const arr = byDay.get(day) ?? [];
    arr.push(p);
    byDay.set(day, arr);
  }
  const dayStats: DayStat[] = Array.from(byDay.entries())
    .map(([day, items]) => ({ day: DAY_NAMES[day], avgScore: Math.round(average(items.map((i) => i.performanceScore))), count: items.length }))
    .sort((a, b) => b.avgScore - a.avgScore);
  const bestDay = dayStats[0] ?? null;

  // --- Por franja horaria ---
  const byHour = new Map<string, Post[]>();
  for (const p of posts) {
    const hour = new Date(p.publishedAt).getHours();
    const bucket = hour < 6 ? "00:00–06:00" : hour < 12 ? "06:00–12:00" : hour < 18 ? "12:00–18:00" : "18:00–24:00";
    const arr = byHour.get(bucket) ?? [];
    arr.push(p);
    byHour.set(bucket, arr);
  }
  const hourStats: HourStat[] = Array.from(byHour.entries())
    .map(([hourRange, items]) => ({ hourRange, avgScore: Math.round(average(items.map((i) => i.performanceScore))), count: items.length }))
    .sort((a, b) => b.avgScore - a.avgScore);
  const bestHour = hourStats[0] ?? null;

  // --- Temas frecuentes (palabras del copy en publicaciones de alto rendimiento) ---
  const topPerformers = [...posts].sort((a, b) => b.performanceScore - a.performanceScore).slice(0, Math.max(3, Math.round(posts.length * 0.25)));
  const underPerformers = [...posts].sort((a, b) => a.performanceScore - b.performanceScore).slice(0, Math.max(3, Math.round(posts.length * 0.25)));

  const wordScores = new Map<string, { total: number; count: number }>();
  for (const p of posts) {
    const words = new Set(
      p.copy
        .toLowerCase()
        .replace(/[^\wáéíóúñ\s]/gi, "")
        .split(/\s+/)
        .filter((w) => w.length > 4 && !STOPWORDS.has(w))
    );
    for (const w of words) {
      const entry = wordScores.get(w) ?? { total: 0, count: 0 };
      entry.total += p.performanceScore;
      entry.count += 1;
      wordScores.set(w, entry);
    }
  }
  const topThemes: ThemeStat[] = Array.from(wordScores.entries())
    .filter(([, s]) => s.count >= 2)
    .map(([word, s]) => ({ word, occurrences: s.count, avgScoreWhenPresent: Math.round(s.total / s.count) }))
    .sort((a, b) => b.avgScoreWhenPresent - a.avgScoreWhenPresent)
    .slice(0, 8);

  // --- CTAs frecuentes ---
  const ctaScores = new Map<string, { scores: number[]; ctrs: number[] }>();
  for (const p of posts) {
    const lower = p.copy.toLowerCase();
    for (const phrase of CTA_PATTERNS) {
      if (lower.includes(phrase)) {
        const entry = ctaScores.get(phrase) ?? { scores: [], ctrs: [] };
        entry.scores.push(p.performanceScore);
        entry.ctrs.push(p.ctr);
        ctaScores.set(phrase, entry);
      }
    }
  }
  const ctaStats: CtaStat[] = Array.from(ctaScores.entries())
    .map(([phrase, s]) => ({ phrase, count: s.scores.length, avgScore: Math.round(average(s.scores)), avgCtr: Number(average(s.ctrs).toFixed(2)) }))
    .sort((a, b) => b.avgScore - a.avgScore);
  const bestCta = ctaStats[0] ?? null;

  // --- Recomendaciones accionables ---
  const recommendations: string[] = [];

  if (bestFormat && worstFormat && bestFormat.type !== worstFormat.type) {
    recommendations.push(
      `Prioriza el formato ${bestFormat.type} — promedia ${bestFormat.avgScore} pts de Performance Score, contra ${worstFormat.avgScore} pts de ${worstFormat.type}.`
    );
  }
  if (bestDay) {
    recommendations.push(`Publica más seguido los días ${bestDay.day}: es el día con mejor rendimiento promedio (${bestDay.avgScore} pts).`);
  }
  if (bestHour) {
    recommendations.push(`La franja horaria ${bestHour.hourRange} obtiene el mejor rendimiento promedio (${bestHour.avgScore} pts) — concentra las publicaciones ahí.`);
  }
  if (bestCta) {
    recommendations.push(`Los copys que incluyen la palabra "${bestCta.phrase}" promedian ${bestCta.avgScore} pts y ${bestCta.avgCtr}% de CTR — replica ese tipo de llamado a la acción.`);
  }
  if (topThemes.length > 0) {
    recommendations.push(`Los temas "${topThemes.slice(0, 3).map((t) => t.word).join('", "')}" aparecen en tus publicaciones de mejor desempeño — profundiza contenido sobre esos temas.`);
  }
  if (worstFormat && worstFormat.avgScore < 40) {
    recommendations.push(`Considera reducir o rediseñar el contenido tipo ${worstFormat.type}: promedia solo ${worstFormat.avgScore} pts de Performance Score.`);
  }
  recommendations.push(
    `Para el próximo mes: duplica el enfoque de tus ${Math.min(3, topPerformers.length)} publicaciones top (formato ${bestFormat?.type ?? "—"}, día ${bestDay?.day ?? "—"}) y evita repetir el patrón de tus publicaciones de menor rendimiento.`
  );

  return {
    postsAnalyzed: posts.length,
    formatStats: sortedFormats,
    bestFormat,
    worstFormat,
    dayStats,
    bestDay,
    hourStats,
    bestHour,
    topThemes,
    ctaStats,
    bestCta,
    topPerformers: topPerformers.slice(0, 5),
    underPerformers: underPerformers.slice(0, 5),
    recommendations,
    limitations,
  };
}
