"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Layers, Image as ImageIcon } from "lucide-react";
import { useCampaignAdSets } from "@/hooks/use-campaigns";
import { formatCurrencyCLP, formatPercent, cn } from "@/lib/utils";

export function CampaignDrilldown({ campaignId, campaignName, onClose }: { campaignId: string | null; campaignName?: string; onClose: () => void }) {
  const { data, isLoading } = useCampaignAdSets(campaignId);

  return (
    <AnimatePresence>
      {campaignId && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-40"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 260 }}
            className="fixed right-0 top-0 h-full w-full max-w-md bg-background border-l border-border z-50 overflow-y-auto scrollbar-thin"
          >
            <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-background">
              <div>
                <p className="text-xs text-muted">Detalle de campaña</p>
                <h3 className="text-sm font-medium">{campaignName}</h3>
              </div>
              <button onClick={onClose} className="rounded-md p-1.5 hover:bg-surface">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {isLoading && <p className="text-sm text-muted">Cargando conjuntos de anuncios...</p>}

              {data?.adSets.map((adSet) => (
                <div key={adSet.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-center gap-2 mb-2.5">
                    <Layers className="h-3.5 w-3.5 text-accent" />
                    <span className="text-sm font-medium flex-1">{adSet.name}</span>
                    <span
                      className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded-full",
                        adSet.status === "ACTIVE" ? "bg-success/15 text-success" : "bg-muted/15 text-muted"
                      )}
                    >
                      {adSet.status === "ACTIVE" ? "Activo" : "Pausado"}
                    </span>
                  </div>

                  <div className="space-y-1.5 ml-1">
                    {adSet.ads.map((ad) => (
                      <div key={ad.id} className="flex items-center gap-2 rounded-md bg-surface px-2.5 py-2 text-xs">
                        <ImageIcon className="h-3 w-3 text-muted shrink-0" />
                        <span className="flex-1 truncate">{ad.name}</span>
                        <span className="text-muted tabular-nums">{formatCurrencyCLP(ad.spend)}</span>
                        <span className="text-muted tabular-nums">{formatPercent(ad.ctr)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
