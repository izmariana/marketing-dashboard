"use client";

import Image from "next/image";
import { ScoreBadge } from "@/components/dashboard/score-badge";
import { BRANDS } from "@/types/domain";
import { formatCompact, formatPercent } from "@/lib/utils";
import type { Post } from "@/types/domain";

const MEDALS = ["🥇", "🥈", "🥉"];

export function MonthlyRanking({ posts }: { posts: Post[] }) {
  if (posts.length === 0) {
    return <p className="text-sm text-muted">Sin publicaciones registradas en este período.</p>;
  }

  return (
    <div className="space-y-2">
      {posts.map((post, idx) => {
        const brand = BRANDS.find((b) => b.slug === post.brandSlug);
        return (
          <div key={post.id} className="flex items-center gap-3 rounded-lg border border-border bg-surface p-2.5">
            <span className="w-7 text-center text-lg shrink-0">{MEDALS[idx] ?? `#${idx + 1}`}</span>
            <div className="relative h-12 w-12 rounded-md overflow-hidden shrink-0 bg-surface-2">
              <Image src={post.thumbnailUrl} alt="" fill unoptimized className="object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-foreground/90 truncate">{post.copy}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="flex items-center gap-1 text-[11px] text-muted">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: brand?.themeColor }} />
                  {brand?.name}
                </span>
              </div>
            </div>
            <div className="hidden sm:flex flex-col items-end text-[11px] text-muted shrink-0 gap-0.5">
              <span>{formatCompact(post.leads)} leads</span>
              <span>{formatPercent(post.ctr)} CTR</span>
              <span>{formatCompact(post.engagement)} engagement</span>
            </div>
            <ScoreBadge score={post.performanceScore} />
          </div>
        );
      })}
    </div>
  );
}
