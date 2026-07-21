"use client";

import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, Loader2 } from "lucide-react";
import { ScoreBadge } from "@/components/dashboard/score-badge";
import { usePostAnalysis } from "@/hooks/use-posts";
import { formatCompact, formatCurrencyCLP, formatPercent, formatDateShort } from "@/lib/utils";
import type { Post } from "@/types/domain";

const METRIC_LABELS: { key: keyof Post; label: string; formatter: (v: number) => string }[] = [
  { key: "reach", label: "Alcance", formatter: formatCompact },
  { key: "impressions", label: "Impresiones", formatter: formatCompact },
  { key: "engagement", label: "Engagement", formatter: formatCompact },
  { key: "clicks", label: "Clics", formatter: formatCompact },
  { key: "ctr", label: "CTR", formatter: formatPercent },
  { key: "likes", label: "Me gusta", formatter: formatCompact },
  { key: "comments", label: "Comentarios", formatter: formatCompact },
  { key: "shares", label: "Compartidos", formatter: formatCompact },
  { key: "saves", label: "Guardados", formatter: formatCompact },
  { key: "spend", label: "Gasto", formatter: formatCurrencyCLP },
  { key: "leads", label: "Leads", formatter: formatCompact },
  { key: "cpl", label: "CPL", formatter: formatCurrencyCLP },
];

export function PostDetailPanel({ post, onClose }: { post: Post | null; onClose: () => void }) {
  const analysis = usePostAnalysis();

  return (
    <AnimatePresence>
      {post && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 260 }}
            className="fixed right-0 top-0 h-full w-full max-w-lg bg-background border-l border-border z-50 overflow-y-auto scrollbar-thin"
          >
            <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-background z-10">
              <div>
                <p className="text-xs text-muted">{formatDateShort(post.publishedAt)}</p>
                <h3 className="text-sm font-medium">Detalle de publicación</h3>
              </div>
              <button onClick={onClose} className="rounded-md p-1.5 hover:bg-surface">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-surface-2">
                <Image src={post.thumbnailUrl} alt="" fill unoptimized className="object-cover" />
              </div>

              <p className="text-sm text-foreground/90">{post.copy}</p>

              <div className="flex items-center justify-between">
                <ScoreBadge score={post.performanceScore} size="md" />
                {post.campaignName && <span className="text-xs text-muted">Campaña: {post.campaignName}</span>}
              </div>

              <div className="grid grid-cols-3 gap-2">
                {METRIC_LABELS.map((m) => (
                  <div key={m.key} className="rounded-lg border border-border bg-surface p-2.5">
                    <p className="text-[10px] text-muted mb-0.5">{m.label}</p>
                    <p className="text-sm font-semibold tabular-nums">{m.formatter(Number(post[m.key]))}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-lg border border-border bg-surface p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-accent" /> Análisis con IA
                  </h4>
                  {!analysis.data && (
                    <button
                      onClick={() => analysis.mutate(post.id)}
                      disabled={analysis.isPending}
                      className="text-xs font-medium rounded-md bg-accent text-accent-foreground px-3 py-1.5 hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {analysis.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                      {analysis.isPending ? "Analizando..." : "Analizar con IA"}
                    </button>
                  )}
                </div>

                {analysis.data ? (
                  <div className="space-y-3 text-sm">
                    <InsightBlock label="¿Por qué funcionó?" text={analysis.data.insight.whyItWorked} />
                    <InsightBlock label="Qué replicar" text={analysis.data.insight.whatToReplicate} />
                    <InsightBlock label="Qué mejorar" text={analysis.data.insight.whatToImprove} />
                    <InsightBlock label="Ideas similares" text={analysis.data.insight.similarIdeas} />
                    <InsightBlock label="Próximo contenido recomendado" text={analysis.data.insight.nextContentIdea} />
                    {!analysis.data.generatedWithAI && (
                      <p className="text-[11px] text-muted italic">
                        Generado en modo simulado — agrega tu OpenAI API Key en Configuración para análisis con IA real.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted">
                    Genera un análisis automático de por qué funcionó esta publicación, qué replicar y qué contenido crear después.
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function InsightBlock({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-accent mb-1">{label}</p>
      <p className="text-foreground/90 text-[13px] leading-relaxed">{text}</p>
    </div>
  );
}
