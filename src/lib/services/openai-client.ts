import OpenAI from "openai";
import type { AiPostInsight } from "@/types/domain";

function getClient(apiKey?: string) {
  const key = apiKey ?? process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error(
      "OPENAI_API_KEY no está configurada. Ingrésala en Configuración o en .env"
    );
  }
  return new OpenAI({ apiKey: key });
}

async function completeJson<T>(systemPrompt: string, userPrompt: string, apiKey?: string): Promise<T> {
  const client = getClient(apiKey);
  const completion = await client.chat.completions.create({
    model: "gpt-4o",
    temperature: 0.4,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  return JSON.parse(raw) as T;
}

// ---------------------------------------------------------------------------
// Análisis IA por publicación
// ---------------------------------------------------------------------------

export async function analyzePostWithAI(
  post: {
    copy: string;
    network: string;
    type: string;
    metrics: Record<string, number>;
  },
  apiKey?: string
): Promise<AiPostInsight> {
  const systemPrompt = `Eres un estratega senior de marketing digital especializado en Meta Ads
y contenido orgánico en Facebook e Instagram para el mercado chileno. Responde SIEMPRE
en JSON válido con las claves: whyItWorked, whatToReplicate, whatToImprove, similarIdeas,
nextContentIdea. Cada valor es un string en español, lenguaje ejecutivo, 1-3 frases.`;

  const userPrompt = `Analiza esta publicación:
Red: ${post.network}
Tipo: ${post.type}
Copy: "${post.copy}"
Métricas: ${JSON.stringify(post.metrics)}

Genera el análisis solicitado.`;

  return completeJson<AiPostInsight>(systemPrompt, userPrompt, apiKey);
}

async function completeJsonVision<T>(
  systemPrompt: string,
  userText: string,
  images: string[],
  apiKey?: string
): Promise<T> {
  const client = getClient(apiKey);
  const content: Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }> = [
    { type: "text", text: userText },
    ...images.map((url) => ({ type: "image_url" as const, image_url: { url } })),
  ];

  const completion = await client.chat.completions.create({
    model: "gpt-4o",
    temperature: 0.4,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  return JSON.parse(raw) as T;
}

// ---------------------------------------------------------------------------
// Análisis creativo profundo de video (guion, tono, escenario, cámara, ritmo)
// ---------------------------------------------------------------------------

export interface CreativeAnalysisInput {
  network: string;
  transcript: string;
  frameCount: number;
  videoDurationSec: number | null;
  retentionCurve: { p25: number | null; p50: number | null; p75: number | null; p95: number | null } | null;
  metrics: Record<string, number>;
}

export interface CreativeAnalysisOutput {
  hookAnalysis: string;
  ganchoAnalysis: string;
  cierreAnalysis: string;
  toneOfVoice: string;
  scenario: string;
  cameraWork: string;
  pacingAssessment: string;
  retentionDropAnalysis: string;
}

export async function analyzeCreative(input: CreativeAnalysisInput, images: string[], apiKey?: string): Promise<CreativeAnalysisOutput> {
  const systemPrompt = `Eres un director creativo senior especializado en video para redes sociales (Reels, TikTok),
con ojo clínico para guion, ritmo y dirección de cámara. Analizas en español, con lenguaje directo y accionable
para un equipo de contenido, nunca genérico — cada observación debe referirse a algo concreto que viste en el
guion, las imágenes o los datos de retención entregados. Responde SOLO en JSON válido con las claves:
hookAnalysis, ganchoAnalysis, cierreAnalysis, toneOfVoice, scenario, cameraWork, pacingAssessment, retentionDropAnalysis.
Cada valor es un string de 1-3 frases.

- hookAnalysis: qué pasa en los primeros 2-3 segundos y si logra detener el scroll.
- ganchoAnalysis: qué mantiene la atención durante el desarrollo (o qué la pierde).
- cierreAnalysis: cómo termina, si hay CTA claro, si el cierre es abrupto o natural.
- toneOfVoice: tono de quien habla (cercano, formal, urgente, informativo, etc.) basado en el guion transcrito.
- scenario: ambientación, locación, iluminación — lo que se ve en los frames.
- cameraWork: movimientos de cámara, cortes, encuadres — lo que se ve en los frames.
- pacingAssessment: si el ritmo de edición es adecuado, muy lento o muy rápido para el formato.
- retentionDropAnalysis: si hay datos de retención, en qué punto del video (según el guion con marcas de
  tiempo) probablemente ocurre la caída, y una hipótesis concreta de por qué. Si no hay datos de retención,
  indícalo explícitamente en vez de inventar un punto de caída.`;

  const retentionText = input.retentionCurve
    ? `Curva de retención (% relativo de espectadores que llegó a cada punto, tomando el 25% como base):
25% del video: ${input.retentionCurve.p25 ?? "sin dato"}%
50% del video: ${input.retentionCurve.p50 ?? "sin dato"}%
75% del video: ${input.retentionCurve.p75 ?? "sin dato"}%
95% del video: ${input.retentionCurve.p95 ?? "sin dato"}%`
    : "Sin datos de retención disponibles para este video (red social sin esta métrica, o video sin suficientes vistas).";

  const userText = `Red: ${input.network}
Duración del video: ${input.videoDurationSec ? `${input.videoDurationSec}s` : "desconocida"}

Guion transcrito (con marcas de tiempo aproximadas por el orden de los segmentos):
"""
${input.transcript || "(sin audio detectable o video sin diálogo)"}
"""

${retentionText}

Métricas: ${JSON.stringify(input.metrics)}

Se adjuntan ${input.frameCount} frames del video, tomados a intervalos regulares desde el inicio hasta el final.
Analiza guion, tono, escenario, cámara, ritmo y la caída de retención según lo solicitado.`;

  return completeJsonVision<CreativeAnalysisOutput>(systemPrompt, userText, images, apiKey);
}

// ---------------------------------------------------------------------------
// Marketing Advisor IA — resumen ejecutivo estratégico
// ---------------------------------------------------------------------------

export interface ExecutiveSummaryInput {
  brandName: string;
  periodLabel: string;
  currentMetrics: Record<string, number>;
  previousMetrics: Record<string, number>;
  topCampaigns: { name: string; spend: number; leads: number; cpl: number }[];
  topPosts: { copy: string; engagement: number; performanceScore: number }[];
}

export interface ExecutiveSummaryOutput {
  resumenEjecutivo: string;
  hallazgos: string[];
  problemasDetectados: string[];
  oportunidades: string[];
  accionesPrioritarias: string[];
  proximosPasos: string[];
}

export async function generateExecutiveSummary(
  input: ExecutiveSummaryInput,
  apiKey?: string
): Promise<ExecutiveSummaryOutput> {
  const systemPrompt = `Eres el Marketing Advisor IA de un dashboard de inteligencia de marketing.
Escribes en español, con lenguaje ejecutivo apto para presentar a gerencia (directo, sin
tecnicismos innecesarios, orientado a decisiones). Responde SOLO en JSON válido con las claves:
resumenEjecutivo (string), hallazgos (string[]), problemasDetectados (string[]),
oportunidades (string[]), accionesPrioritarias (string[]), proximosPasos (string[]).`;

  const userPrompt = `Marca: ${input.brandName}
Período: ${input.periodLabel}

Métricas actuales: ${JSON.stringify(input.currentMetrics)}
Métricas período anterior: ${JSON.stringify(input.previousMetrics)}

Top campañas: ${JSON.stringify(input.topCampaigns)}
Top publicaciones: ${JSON.stringify(input.topPosts)}

Genera el informe ejecutivo solicitado, comparando contra el período anterior explícitamente.`;

  return completeJson<ExecutiveSummaryOutput>(systemPrompt, userPrompt, apiKey);
}
