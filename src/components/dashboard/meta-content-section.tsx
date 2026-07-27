"use client";

import { useState } from "react";
import { Panel } from "@/components/dashboard/panel";
import { PostCard } from "@/components/dashboard/post-card";
import { PostDetailPanel } from "@/components/dashboard/post-detail-panel";
import { PostComparator } from "@/components/dashboard/post-comparator";
import { MonthlyRanking } from "@/components/dashboard/monthly-ranking";
import { FollowersSection } from "@/components/dashboard/followers-section";
import { usePosts, useMonthlyRanking } from "@/hooks/use-posts";
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

type NetworkTab = "AMBAS" | "INSTAGRAM" | "FACEBOOK";

export function MetaContentSection({ brand, days }: { brand: string; days: number }) {
  const [networkTab, setNetworkTab] = useState<NetworkTab>("AMBAS");
  const [type, setType] = useState("");
  const [funding, setFunding] = useState("");
  const [sort, setSort] = useState("score");
  const [compareMode, setCompareMode] = useState(false);
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);
  const [detailPost, setDetailPost] = useState<Post | null>(null);
  const [showRanking, setShowRanking] = useState(false);

  const networkFilter = networkTab === "AMBAS" ? "" : networkTab;
  const { data, isLoading } = usePosts({ brand, network: networkFilter, type, funding, sort });
  const { data: ranking } = useMonthlyRanking(now.getMonth() + 1, now.getFullYear());

  function toggleSelect(id: string) {
    setSelectedForCompare((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Meta — Instagram y Facebook</h2>
          <p className="text-sm text-muted">Seguidores y contenido orgánico/pagado</p>
        </div>
        <div className="flex items-center rounded-md border border-border p-0.5 bg-surface">
          {(["INSTAGRAM", "FACEBOOK", "AMBAS"] as NetworkTab[]).map((n) => (
            <button
              key={n}
              onClick={() => setNetworkTab(n)}
              className={cn("px-3 py-1.5 text-xs font-medium rounded-[6px] transition-colors", networkTab === n ? "bg-accent text-accent-foreground" : "text-muted hover:text-foreground")}
            >
              {n === "AMBAS" ? "Ambas" : n === "INSTAGRAM" ? "Instagram" : "Facebook"}
            </button>
          ))}
        </div>
      </div>

      {networkTab === "AMBAS" ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-medium text-muted mb-2 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[var(--brand-inversiones)]" /> Instagram
            </p>
            <FollowersSection brand={brand} network="INSTAGRAM" days={days} accentColor="var(--brand-inversiones)" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted mb-2 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[var(--brand-informes)]" /> Facebook
            </p>
            <FollowersSection brand={brand} network="FACEBOOK" days={days} accentColor="var(--brand-informes)" />
          </div>
        </div>
      ) : (
        <FollowersSection brand={brand} network={networkTab} days={days} accentColor={networkTab === "INSTAGRAM" ? "var(--brand-inversiones)" : "var(--brand-informes)"} />
      )}

      <div className="flex items-center gap-2 flex-wrap">
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

      <Panel title="Publicaciones" description={`${data?.posts.length ?? 0} publicaciones encontradas`}>
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
