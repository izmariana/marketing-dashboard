import { NextRequest, NextResponse } from "next/server";
import { getPrisma, isDatabaseConfigured } from "@/lib/db/prisma";

/**
 * GET /api/campaigns/[id]/adsets
 * Drill-down: Campaña → Ad Sets → Ads. En modo mock genera una estructura
 * plausible (2-4 ad sets, 2-3 ads cada uno) para poder probar la UI de
 * navegación jerárquica sin base de datos conectada.
 */
function seededRandom(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!isDatabaseConfigured) {
    const rnd = seededRandom(id);
    const adSetCount = 2 + Math.floor(rnd() * 3);
    const adSets = Array.from({ length: adSetCount }).map((_, i) => {
      const adCount = 2 + Math.floor(rnd() * 2);
      return {
        id: `${id}-adset-${i}`,
        name: `Conjunto de anuncios ${i + 1} — ${["Audiencia fría", "Retargeting", "Lookalike 1%", "Intereses financieros"][i % 4]}`,
        status: rnd() > 0.25 ? "ACTIVE" : "PAUSED",
        ads: Array.from({ length: adCount }).map((_, j) => ({
          id: `${id}-adset-${i}-ad-${j}`,
          name: `Anuncio ${j + 1} — ${["Video testimonio", "Carrusel beneficios", "Imagen estática", "Reel corto"][j % 4]}`,
          status: rnd() > 0.2 ? "ACTIVE" : "PAUSED",
          spend: Math.round(20000 + rnd() * 250000),
          ctr: Number((0.8 + rnd() * 2.5).toFixed(2)),
        })),
      };
    });
    return NextResponse.json({ adSets, source: "mock" });
  }

  const prisma = await getPrisma();
  const adSets = await prisma.adSet.findMany({
    where: { campaignId: id },
    include: { ads: true },
  });

  return NextResponse.json({ adSets, source: "database" });
}
