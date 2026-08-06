"use client";

import { useState } from "react";
import { Topbar } from "@/components/layout/topbar";
import { MetaAdsSection } from "@/components/dashboard/meta-ads-section";
import { MetaContentSection } from "@/components/dashboard/meta-content-section";
import { TikTokSection } from "@/components/dashboard/tiktok-section";
import { LinkedInSection } from "@/components/dashboard/linkedin-section";
import { GoogleAnalyticsSection } from "@/components/dashboard/google-analytics-section";
import { BRANDS } from "@/types/domain";
import { cn } from "@/lib/utils";
import { Megaphone, Layers, Music2, LineChart, Briefcase } from "lucide-react";

const TABS = [
  { key: "meta-ads", label: "Meta Ads", icon: Megaphone },
  { key: "meta-content", label: "Meta Contenido", icon: Layers },
  { key: "tiktok", label: "TikTok", icon: Music2 },
  { key: "linkedin", label: "LinkedIn", icon: Briefcase },
  { key: "google-analytics", label: "Google Analytics", icon: LineChart },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function BrandPageTabs({ slug }: { slug: string }) {
  const brand = BRANDS.find((b) => b.slug === slug);
  const [tab, setTab] = useState<TabKey>("meta-ads");
  const [days, setDays] = useState(30);

  return (
    <div>
      <Topbar title={brand?.name ?? "Marca"} brandSlug={slug} />

      <div className="p-6 space-y-5 max-w-[1400px]">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2.5">
            {brand && <span className="h-3 w-3 rounded-full" style={{ background: brand.themeColor }} />}
            <h2 className="text-lg font-semibold tracking-tight">{brand?.name ?? "Marca"}</h2>
          </div>
          <div className="flex items-center rounded-md border border-border p-0.5 bg-surface">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={cn("px-3 py-1.5 text-xs font-medium rounded-[6px] transition-colors", days === d ? "bg-accent text-accent-foreground" : "text-muted hover:text-foreground")}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1 border-b border-border overflow-x-auto scrollbar-thin">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors shrink-0",
                  active ? "border-accent text-accent" : "border-transparent text-muted hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="pt-1">
          {tab === "meta-ads" && <MetaAdsSection slug={slug} days={days} />}
          {tab === "meta-content" && <MetaContentSection brand={slug} days={days} />}
          {tab === "tiktok" && <TikTokSection brand={slug} days={days} />}
          {tab === "linkedin" && <LinkedInSection brand={slug} days={days} />}
          {tab === "google-analytics" && <GoogleAnalyticsSection brand={slug} days={days} />}
        </div>
      </div>
    </div>
  );
}
