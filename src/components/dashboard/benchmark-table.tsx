import { formatCurrencyCLP, formatPercent, cn } from "@/lib/utils";

const STATUS_CONFIG = {
  por_debajo: { label: "Por debajo", className: "bg-danger/15 text-danger" },
  promedio: { label: "Dentro del promedio", className: "bg-warning/15 text-warning" },
  superior: { label: "Superior", className: "bg-success/15 text-success" },
};

const METRIC_LABELS: Record<string, { label: string; formatter: (v: number) => string }> = {
  ctr: { label: "CTR", formatter: formatPercent },
  cpc: { label: "CPC", formatter: formatCurrencyCLP },
  cpm: { label: "CPM", formatter: formatCurrencyCLP },
  cpl: { label: "CPL", formatter: formatCurrencyCLP },
  engagementRate: { label: "Engagement Rate", formatter: formatPercent },
};

interface BenchmarkEntry {
  value: number;
  status: keyof typeof STATUS_CONFIG;
}

export function BenchmarkTable({ benchmarks }: { benchmarks: Record<string, BenchmarkEntry> }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs text-muted border-b border-border">
          <th className="pb-2 font-medium">Métrica</th>
          <th className="pb-2 font-medium text-right">Tu valor</th>
          <th className="pb-2 font-medium text-right">vs. Benchmark Chile</th>
        </tr>
      </thead>
      <tbody>
        {Object.entries(benchmarks)
          .filter(([key]) => key !== "engagementRate") // se muestra a nivel de publicación en Contenidos
          .map(([key, entry]) => {
            const meta = METRIC_LABELS[key];
            const status = STATUS_CONFIG[entry.status];
            return (
              <tr key={key} className="border-b border-border last:border-0">
                <td className="py-2.5 font-medium">{meta.label}</td>
                <td className="py-2.5 text-right tabular-nums">{meta.formatter(entry.value)}</td>
                <td className="py-2.5 text-right">
                  <span className={cn("text-xs px-2 py-0.5 rounded-full", status.className)}>{status.label}</span>
                </td>
              </tr>
            );
          })}
      </tbody>
    </table>
  );
}
