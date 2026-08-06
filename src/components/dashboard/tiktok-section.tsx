"use client";

import { useState } from "react";
import { Panel } from "@/components/dashboard/panel";
import { PostCard } from "@/components/dashboard/post-card";
import { PostDetailPanel } from "@/components/dashboard/post-detail-panel";
import { PostComparator } from "@/components/dashboard/post-comparator";
import { MonthlyRanking } from "@/components/dashboard/monthly-ranking";
import { FollowersSection } from "@/components/dashboard/followers-section";
import { useTikTokPosts, useTikTokRanking } from "@/hooks/use-tiktok";
import { cn } from "@/lib/utils";
import { Scale } from "lucide-react";
import type { Post } from "@/types/domain";

const SORT_OPTIONS = [
  { value: "score", label: "Mayor Performance Score" },
  { value: "reproducciones", label: "Mayor reproducciones" },
  { value: "alcance", label: "Mayor alcance" },
  { value: "engagement", label: "Mayor engagement" },
  { value: "comentarios", label: "Mayor comentarios" },
  { value: "compartidos", label: "Mayor compartidos" },
];

const now = new Date();
const MONTH_NAMES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

export function TikTokSection({ brand, days }: { brand: string; days: number }) {
  const [sort, setSort] = useState("score");
  const [compareMode, setCompareMode] = useState(false);
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);
  const [detailPost, setDetailPost] = useState<Post | null>(null);
  const [showRanking, setShowRanking] = useState(false);

  const { data, isLoading } = useTikTokPosts({ brand, sort });
  const { data: ranking } = useTikTokRanking(now.getMonth() + 1, now.getFullYear());

  function toggleSelect(id: string) {
    setSelectedForCompare((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold tracking-tight">TikTok</h2>
        <p className="text-sm text-muted">Contenido orgánico, seguidores y rendimiento</p>
      </div>

      <FollowersSection brand={brand} network="TIKTOK" days={days} accentColor="var(--danger)" />

      <div className="flex items-center gap-2 flex-wrap">
        <select value={sort} onChange={(e) => setSort(e.target.value)} className="text-xs rounded-md border border-border bg-surface px-2.5 py-1.5 outline-none focus:border-accent">
          {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <button
          onClick={() => {
            setCompareMode((v) => !v);
            setSelectedForCompare([]);
          }}
          className={cn(
            "flex items-center gap-1.5 text-xs font-medium rounded-md border px-2.5 py-1.5 transition-colors",
            compareMode ? "bg-accent text-accent-foreground border-accent" : "border-border hover:bg-surface"
          )}
        >
          <Scale className="h-3.5 w-3.5" />
          Comparar
        </button>
      </div>

      {compareMode && (
        <div className="rounded-lg border border-accent/40 bg-accent-soft p-3 text-xs text-accent">
          Selecciona 2 videos para compararlos ({selectedForCompare.length}/2 seleccionados).
        </div>
      )}

      <Panel
        title="Ranking mensual"
        description={`Top 10 de ${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()} por Performance Score`}
        action={
          <button onClick={() => setShowRanking((v) => !v)} className="text-xs font-medium text-accent">
            {showRanking ? "Ocultar" : "Ver ranking"}
          </button>
        }
      >
        {showRanking && (ranking ? <MonthlyRanking posts={ranking.posts} /> : <p className="text-sm text-muted">Cargando...</p>)}
      </Panel>

      <Panel title="Videos" description={`${data?.posts.length ?? 0} videos encontrados`}>
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="aspect-[4/5] rounded-xl bg-surface-2 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {data?.posts.map((post, idx) => (
              <PostCard
                key={post.id}
                post={post}
                delay={Math.min(idx * 0.02, 0.3)}
                selectable={compareMode}
                selected={selectedForCompare.includes(post.id)}
                onToggleSelect={() => toggleSelect(post.id)}
                onClick={() => (compareMode ? toggleSelect(post.id) : setDetailPost(post))}
              />
            ))}
          </div>
        )}
      </Panel>

      <PostDetailPanel post={detailPost} onClose={() => setDetailPost(null)} />
      <PostComparator
        postIdA={selectedForCompare[0] ?? null}
        postIdB={selectedForCompare[1] ?? null}
        onClose={() => setSelectedForCompare([])}
      />
    </div>
  );
}
