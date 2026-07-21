import { NextRequest, NextResponse } from "next/server";
import { getPrisma, isDatabaseConfigured } from "@/lib/db/prisma";
import { getAllMockPosts } from "@/lib/mock/generator";
import { analyzePostWithAI } from "@/lib/services/openai-client";
import type { AiPostInsight, Post } from "@/types/domain";

function mockInsight(post: Post): AiPostInsight {
  const strongMetric = post.ctr > 2 ? "un CTR sobre el promedio" : post.engagement > 500 ? "un alto nivel de engagement" : "un buen alcance orgánico";
  return {
    whyItWorked: `Esta publicación destacó por ${strongMetric}, apoyada en un copy directo y una llamada a la acción clara para la audiencia de ${post.network === "INSTAGRAM" ? "Instagram" : "Facebook"}.`,
    whatToReplicate: `Repetir el formato "${post.type.toLowerCase()}" con el mismo tono de copy (beneficio concreto + pregunta) en las próximas publicaciones de esta marca.`,
    whatToImprove: post.ctr < 1.5 ? "El CTR es bajo para el alcance logrado: prueba un CTA más explícito y un primer frame más llamativo." : "Podría mejorar el guardado/compartido agregando un dato o cifra memorable en los primeros 3 segundos o líneas.",
    similarIdeas: "Testimonios de clientes reales, comparativas antes/después, y datos duros del mercado chileno presentados como carrusel.",
    nextContentIdea: `Un ${post.type === "REEL" ? "carrusel" : "reel"} que responda la objeción más común de esta audiencia, cerrando con el mismo CTA que funcionó aquí.`,
  };
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const post = isDatabaseConfigured
    ? await (await getPrisma()).post.findUnique({ where: { id } })
    : getAllMockPosts().find((p) => p.id === id);

  if (!post) return NextResponse.json({ error: "Publicación no encontrada" }, { status: 404 });

  const hasOpenAiKey = Boolean(process.env.OPENAI_API_KEY);

  let insight: AiPostInsight;
  if (hasOpenAiKey) {
    try {
      insight = await analyzePostWithAI({
        copy: post.copy ?? "",
        network: post.network,
        type: post.type,
        metrics: {
          reach: post.reach,
          engagement: post.engagement,
          ctr: Number(post.ctr),
          leads: post.leads,
          shares: post.shares,
          saves: post.saves,
        },
      });
    } catch {
      insight = mockInsight(post as Post);
    }
  } else {
    insight = mockInsight(post as Post);
  }

  if (isDatabaseConfigured) {
    const prisma = await getPrisma();
    await prisma.aiInsight.upsert({
      where: { postId: id },
      create: { postId: id, brandId: (post as { brandId: string }).brandId, ...insight },
      update: { ...insight },
    });
  }

  return NextResponse.json({ insight, generatedWithAI: hasOpenAiKey });
}
