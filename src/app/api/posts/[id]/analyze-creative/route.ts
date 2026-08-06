import { NextRequest, NextResponse } from "next/server";
import { getPrisma, isDatabaseConfigured } from "@/lib/db/prisma";
import { transcribeVideo, extractFrames } from "@/lib/services/video-processing";
import { analyzeCreative } from "@/lib/services/openai-client";
import { resolveOpenAiApiKey } from "@/lib/services/settings-resolver";

// Descargar el video + transcribirlo + extraer frames puede tardar bastante
// más que el límite por defecto de una función serverless.
export const maxDuration = 60;

/**
 * POST /api/posts/[id]/analyze-creative
 *
 * Análisis creativo profundo — bajo demanda, un post a la vez (a
 * diferencia de /analyze, que es rápido y barato y sí se puede correr en
 * bulk). Este endpoint descarga el video real, lo transcribe con Whisper
 * y extrae frames con ffmpeg antes de mandarlo a GPT-4o Vision — tiene un
 * costo y tiempo de espera notoriamente mayores.
 *
 * Solo aplica a publicaciones de tipo video (REEL/VIDEO) con mediaUrl.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!isDatabaseConfigured) {
    return NextResponse.json(
      { error: "El análisis creativo necesita una base de datos conectada y contenido real sincronizado — no está disponible en modo de datos de ejemplo." },
      { status: 400 }
    );
  }

  const prisma = await getPrisma();
  const post = await prisma.post.findUnique({ where: { id } });
  if (!post) return NextResponse.json({ error: "Publicación no encontrada" }, { status: 404 });

  if (post.type !== "VIDEO" && post.type !== "REEL") {
    return NextResponse.json({ error: "El análisis creativo profundo solo aplica a publicaciones de video." }, { status: 400 });
  }
  if (!post.mediaUrl) {
    return NextResponse.json({ error: "Esta publicación no tiene una URL de video guardada — puede haber expirado. Sincroniza de nuevo." }, { status: 400 });
  }

  const apiKey = await resolveOpenAiApiKey();
  if (!apiKey) {
    return NextResponse.json({ error: "Falta la OpenAI API Key en Configuración — es obligatoria para el análisis creativo." }, { status: 400 });
  }

  try {
    const [transcription, frames] = await Promise.all([
      transcribeVideo(post.mediaUrl, apiKey),
      extractFrames(post.mediaUrl, 6),
    ]);

    const retentionCurve =
      post.retentionP25 !== null
        ? {
            p25: post.retentionP25 ? Number(post.retentionP25) : null,
            p50: post.retentionP50 ? Number(post.retentionP50) : null,
            p75: post.retentionP75 ? Number(post.retentionP75) : null,
            p95: post.retentionP95 ? Number(post.retentionP95) : null,
          }
        : null;

    const analysis = await analyzeCreative(
      {
        network: post.network,
        transcript: transcription.text,
        frameCount: frames.length,
        videoDurationSec: post.videoDurationSec,
        retentionCurve,
        metrics: {
          reach: post.reach,
          engagement: post.engagement,
          avgWatchPct: post.avgWatchPct ? Number(post.avgWatchPct) : 0,
        },
      },
      frames,
      apiKey
    );

    await prisma.aiInsight.upsert({
      where: { postId: id },
      create: {
        postId: id,
        brandId: post.brandId,
        // Campos "clásicos" (por qué funcionó, etc.) quedan vacíos si nunca
        // se corrió /analyze — se completan solo cuando corresponde.
        whyItWorked: "",
        whatToReplicate: "",
        whatToImprove: "",
        similarIdeas: "",
        nextContentIdea: "",
        transcript: transcription.text,
        ...analysis,
        creativeAnalyzedAt: new Date(),
      },
      update: {
        transcript: transcription.text,
        ...analysis,
        creativeAnalyzedAt: new Date(),
      },
    });

    return NextResponse.json({
      transcript: transcription.text,
      framesAnalyzed: frames.length,
      ...analysis,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido analizando el video";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
