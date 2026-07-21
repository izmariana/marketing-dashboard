import { NextRequest, NextResponse } from "next/server";
import { getPrisma, isDatabaseConfigured } from "@/lib/db/prisma";
import { getAllMockPosts } from "@/lib/mock/generator";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!isDatabaseConfigured) {
    const post = getAllMockPosts().find((p) => p.id === id);
    if (!post) return NextResponse.json({ error: "Publicación no encontrada" }, { status: 404 });
    return NextResponse.json({ post, source: "mock" });
  }

  const prisma = await getPrisma();
  const post = await prisma.post.findUnique({
    where: { id },
    include: { brand: true, campaign: true, aiInsight: true },
  });
  if (!post) return NextResponse.json({ error: "Publicación no encontrada" }, { status: 404 });

  return NextResponse.json({ post, source: "database" });
}
