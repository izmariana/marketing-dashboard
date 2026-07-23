import { NextRequest, NextResponse } from "next/server";
import { findMockPostById } from "@/lib/mock/generator";
import { getPrisma, isDatabaseConfigured } from "@/lib/db/prisma";
import { comparePosts } from "@/lib/services/recommendation-engine";
import type { Post } from "@/types/domain";

export async function POST(req: NextRequest) {
  const { postIdA, postIdB } = await req.json();
  if (!postIdA || !postIdB) {
    return NextResponse.json({ error: "Debes enviar postIdA y postIdB" }, { status: 400 });
  }

  let a: Post | undefined;
  let b: Post | undefined;

  if (!isDatabaseConfigured) {
    a = findMockPostById(postIdA);
    b = findMockPostById(postIdB);
  } else {
    const prisma = await getPrisma();
    const [dbA, dbB] = await Promise.all([
      prisma.post.findUnique({ where: { id: postIdA } }),
      prisma.post.findUnique({ where: { id: postIdB } }),
    ]);
    a = dbA as unknown as Post;
    b = dbB as unknown as Post;
  }

  if (!a || !b) return NextResponse.json({ error: "Una o ambas publicaciones no existen" }, { status: 404 });

  const maxOf = (key: keyof Post) => Math.max(Number(a![key]), Number(b![key]), 1);

  const toInputs = (p: Post) => ({
    name: p.copy.slice(0, 40) || p.id,
    engagement: p.engagement,
    ctr: p.ctr,
    leads: p.leads,
    reach: p.reach,
    shares: p.shares,
    saves: p.saves,
    maxEngagement: maxOf("engagement"),
    maxCtr: maxOf("ctr"),
    maxLeads: maxOf("leads"),
    maxReach: maxOf("reach"),
    maxShares: maxOf("shares"),
    maxSaves: maxOf("saves"),
  });

  const result = comparePosts(toInputs(a), toInputs(b));

  return NextResponse.json({
    postA: a,
    postB: b,
    scoreA: result.scoreA,
    scoreB: result.scoreB,
    winner: result.winner,
    conclusion: result.conclusion,
  });
}
