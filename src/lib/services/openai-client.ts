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
