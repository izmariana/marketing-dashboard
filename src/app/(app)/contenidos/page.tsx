"use client";

import { useState } from "react";
import { Topbar } from "@/components/layout/topbar";
import { Panel } from "@/components/dashboard/panel";
import { PostCard } from "@/components/dashboard/post-card";
import { PostDetailPanel } from "@/components/dashboard/post-detail-panel";
import { PostComparator } from "@/components/dashboard/post-comparator";
import { MonthlyRanking } from "@/components/dashboard/monthly-ranking";
import { usePosts, useMonthlyRanking } from "@/hooks/use-posts";
import { BRANDS } from "@/types/domain";
import { cn } from "@/lib/utils";
import { Scale } from "lucide-react";
import type { Post } from "@/types/domain";

const SORT_OPTIONS = [
  { value: "score", label: "Mayor Performance Score" },
  { value: "alcance", label: "Mayor alcance" },
  { value: "engagement", label: "Mayor engagement" },
  { value: "ctr", label: "Mayor CTR" },
  { value: "leads", label: "Mayor cantidad de leads" },
  { value: "cpl", label: "Menor CPL" },
  { value: "comentarios", label: "Mayor cantidad de comentarios" },
  { value: "compartidos", label: "Mayor cantidad de compartidos" },
  { value: "guardados", label: "Mayor cantidad de guardados" },
];

const now = new Date();
const MONTH_NAMES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

export default function ContenidosPage() {
  const [brand, setBrand] = useState("");
  const [network, setNetwork] = useState("");
  const [type, setType] = useState("");
  const [funding, setFunding] = useState("");
  const [sort, setSort] = useState("score");
  const [compareMode, setCompareMode] = useState(false);
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);
  const [detailPost, setDetailPost] = useState<Post | null>(null);
  const [showRanking, setShowRanking] = useState(false);

  const { data, isLoading } = usePosts({ brand, network, type, funding, sort });
  const { data: ranking } = useMonthlyRanking(now.getMonth() + 1, now.getFullYear());

  function toggleSelect(id: string) {
    setSelectedForCompare((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  }

  return (
    <div>
      <Topbar title="Top Contenidos" />

      <div className="p-6 space-y-5 max-w-[1400px]">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Top Contenidos</h2>
            <p className="text-sm text-muted">Publicaciones de Facebook e Instagram de tus 3 marcas</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <select value={brand} onChange={(e) => setBrand(e.target.value)} className="text-xs rounded-md border border-border bg-surface px-2.5 py-1.5 outline-none focus:border-accent">
              <option value="">Todas las marcas</option>
              {BRANDS.map((b) => <option key={b.slug} value={b.slug}>{b.name}</option>)}
            </select>
            <select value={network} onChange={(e) => setNetwork(e.target.value)} className="text-xs rounded-md border border-border bg-surface px-2.5 py-1.5 outline-none focus:border-accent">
              <option value="">Facebook + Instagram</option>
              <option value="FACEBOOK">Facebook</option>
              <option value="INSTAGRAM">Instagram</option>
            </select>
            <select value={type} onChange={(e) => setType(e.target.value)} className="text-xs rounded-md border border-border bg-surface px-2.5 py-1.5 outline-none focus:border-accent">
              <option value="">Todos los tipos</option>
              <option value="REEL">Reel</option>
              <option value="CAROUSEL">Carrusel</option>
              <option value="IMAGE">Imagen</option>
              <option value="STORY">Historia</option>
              <option value="VIDEO">Video</option>
            </select>
            <select value={funding} onChange={(e) => setFunding(e.target.value)} className="text-xs rounded-md border border-border bg-surface px-2.5 py-1.5 outline-none focus:border-accent">
              <option value="">Orgánico + Pagado</option>
              <option value="ORGANIC">Orgánico</option>
              <option value="PAID">Pagado</option>
            </select>
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
        </div>

        {compareMode && (
          <div className="rounded-lg border border-accent/40 bg-accent-soft p-3 text-xs text-accent">
            Selecciona 2 publicaciones para compararlas ({selectedForCompare.length}/2 seleccionadas).
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

        <Panel title="Todas las publicaciones" description={`${data?.posts.length ?? 0} publicaciones encontradas`}>
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
      </div>

      <PostDetailPanel post={detailPost} onClose={() => setDetailPost(null)} />
      <PostComparator
        postIdA={selectedForCompare[0] ?? null}
        postIdB={selectedForCompare[1] ?? null}
        onClose={() => setSelectedForCompare([])}
      />
    </div>
  );
}
