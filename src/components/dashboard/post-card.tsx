"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Heart, MessageCircle, Share2, Bookmark, MousePointerClick } from "lucide-react";
import { ScoreBadge } from "@/components/dashboard/score-badge";
import { formatCompact, formatDateShort, cn } from "@/lib/utils";
import type { Post } from "@/types/domain";

const NETWORK_LABEL: Record<string, string> = { FACEBOOK: "Facebook", INSTAGRAM: "Instagram", TIKTOK: "TikTok", LINKEDIN: "LinkedIn" };
const TYPE_LABEL: Record<string, string> = { REEL: "Reel", CAROUSEL: "Carrusel", IMAGE: "Imagen", STORY: "Historia", VIDEO: "Video" };

export function PostCard({
  post,
  selected,
  selectable,
  onClick,
  onToggleSelect,
  delay = 0,
}: {
  post: Post;
  selected?: boolean;
  selectable?: boolean;
  onClick?: () => void;
  onToggleSelect?: () => void;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className={cn(
        "rounded-xl border bg-surface overflow-hidden cursor-pointer transition-colors group",
        selected ? "border-accent ring-1 ring-accent" : "border-border hover:border-accent/40"
      )}
      onClick={onClick}
    >
      <div className="relative aspect-[4/5] bg-surface-2">
        <Image src={post.thumbnailUrl} alt="" fill unoptimized className="object-cover" />
        <div className="absolute top-2 left-2 flex gap-1">
          <span className="text-[10px] font-medium bg-black/60 text-white rounded-full px-2 py-0.5 backdrop-blur">
            {NETWORK_LABEL[post.network]}
          </span>
          <span className="text-[10px] font-medium bg-black/60 text-white rounded-full px-2 py-0.5 backdrop-blur">
            {TYPE_LABEL[post.type]}
          </span>
        </div>
        <span
          className={cn(
            "absolute top-2 right-2 text-[10px] font-medium rounded-full px-2 py-0.5 backdrop-blur",
            post.fundingType === "PAID" ? "bg-accent/80 text-white" : "bg-white/80 text-foreground"
          )}
        >
          {post.fundingType === "PAID" ? "Pagado" : "Orgánico"}
        </span>

        {selectable && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect?.();
            }}
            className={cn(
              "absolute bottom-2 right-2 h-6 w-6 rounded-full border-2 flex items-center justify-center text-[11px] font-bold transition-colors",
              selected ? "bg-accent border-accent text-accent-foreground" : "bg-black/40 border-white/70 text-white"
            )}
          >
            {selected ? "✓" : ""}
          </button>
        )}
      </div>

      <div className="p-3 space-y-2">
        <p className="text-xs text-foreground/90 line-clamp-2 min-h-[2.2em]">{post.copy}</p>

        <div className="flex items-center justify-between">
          <ScoreBadge score={post.performanceScore} />
          <span className="text-[11px] text-muted">{formatDateShort(post.publishedAt)}</span>
        </div>

        <div className="grid grid-cols-4 gap-1.5 pt-1.5 border-t border-border text-[11px] text-muted">
          <span className="flex items-center gap-1"><Heart className="h-3 w-3" />{formatCompact(post.likes)}</span>
          <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" />{formatCompact(post.comments)}</span>
          <span className="flex items-center gap-1"><Share2 className="h-3 w-3" />{formatCompact(post.shares)}</span>
          <span className="flex items-center gap-1"><Bookmark className="h-3 w-3" />{formatCompact(post.saves)}</span>
        </div>

        {post.fundingType === "PAID" && (
          <div className="flex items-center gap-1 text-[11px] text-accent pt-0.5">
            <MousePointerClick className="h-3 w-3" />
            {post.leads} leads · CTR {post.ctr.toFixed(1)}%
          </div>
        )}
      </div>
    </motion.div>
  );
}
