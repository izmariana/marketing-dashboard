"use client";

import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { X, Trophy } from "lucide-react";
import { useEffect } from "react";
import { useComparePosts } from "@/hooks/use-posts";
import { formatCompact, formatPercent, cn } from "@/lib/utils";
import type { Post } from "@/types/domain";

const ROWS: { key: keyof Post; label: string; formatter: (v: number) => string }[] = [
  { key: "ctr", label: "CTR", formatter: formatPercent },
  { key: "engagement", label: "Engagement", formatter: formatCompact },
  { key: "leads", label: "Leads", formatter: formatCompact },
  { key: "reach", label: "Alcance", formatter: formatCompact },
  { key: "comments", label: "Comentarios", formatter: formatCompact },
  { key: "shares", label: "Compartidos", formatter: formatCompact },
  { key: "saves", label: "Guardados", formatter: formatCompact },
];

export function PostComparator({ postIdA, postIdB, onClose }: { postIdA: string | null; postIdB: string | null; onClose: () => void }) {
  const compare = useComparePosts();

  useEffect(() => {
    if (postIdA && postIdB) compare.mutate({ postIdA, postIdB });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postIdA, postIdB]);

  const active = Boolean(postIdA && postIdB);

  return (
    <AnimatePresence>
      {active && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="w-full max-w-2xl bg-background border border-border rounded-xl overflow-hidden max-h-[85vh] overflow-y-auto scrollbar-thin">
              <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-background">
                <h3 className="text-sm font-medium">Comparador de publicaciones</h3>
                <button onClick={onClose} className="rounded-md p-1.5 hover:bg-surface">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {compare.isPending && <p className="text-sm text-muted p-6 text-center">Comparando...</p>}

              {compare.data && (
                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    {[compare.data.postA, compare.data.postB].map((p, idx) => {
                      const score = idx === 0 ? compare.data!.scoreA : compare.data!.scoreB;
                      const isWinner = (idx === 0 ? compare.data!.scoreA : compare.data!.scoreB) === Math.max(compare.data!.scoreA, compare.data!.scoreB);
                      return (
                        <div key={p.id} className={cn("rounded-lg border p-3", isWinner ? "border-accent" : "border-border")}>
                          <div className="relative w-full aspect-video rounded-md overflow-hidden bg-surface-2 mb-2">
                            <Image src={p.thumbnailUrl} alt="" fill unoptimized className="object-cover" />
                            {isWinner && (
                              <span className="absolute top-1.5 right-1.5 bg-accent text-accent-foreground rounded-full p-1">
                                <Trophy className="h-3 w-3" />
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-foreground/90 line-clamp-2 mb-2">{p.copy}</p>
                          <p className="text-lg font-semibold">{score} pts</p>
                        </div>
                      );
                    })}
                  </div>

                  <div className="rounded-lg border border-border overflow-hidden">
                    <table className="w-full text-sm">
                      <tbody>
                        {ROWS.map((row) => {
                          const valA = Number(compare.data!.postA[row.key]);
                          const valB = Number(compare.data!.postB[row.key]);
                          const aWins = valA >= valB;
                          return (
                            <tr key={row.key} className="border-b border-border last:border-0">
                              <td className={cn("py-2 px-3 text-right tabular-nums w-1/3", aWins && "font-semibold text-success")}>{row.formatter(valA)}</td>
                              <td className="py-2 px-3 text-center text-xs text-muted w-1/3">{row.label}</td>
                              <td className={cn("py-2 px-3 tabular-nums w-1/3", !aWins && "font-semibold text-success")}>{row.formatter(valB)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="rounded-lg bg-accent-soft border border-accent/30 p-3">
                    <p className="text-xs font-medium text-accent mb-1">Conclusión automática</p>
                    <p className="text-sm text-foreground/90">{compare.data.conclusion}</p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
