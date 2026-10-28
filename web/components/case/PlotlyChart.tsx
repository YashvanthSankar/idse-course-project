"use client";
import dynamic from "next/dynamic";

// Plotly touches `window`, so it only ever loads in the browser.
const PlotlyInner = dynamic(() => import("./PlotlyInner"), {
  ssr: false,
  loading: () => <ChartSkeleton />,
});

function ChartSkeleton() {
  return (
    <div className="flex h-full min-h-60 items-center justify-center rounded border border-dashed border-line font-mono text-xs text-muted">
      developing the photograph…
    </div>
  );
}

export function PlotlyChart({ figure, height = 380, compact = false }: { figure: object; height?: number; compact?: boolean }) {
  return (
    <div data-testid="plotly-chart" className="w-full" style={{ minHeight: height }}>
      <PlotlyInner figure={figure as { data?: unknown[] }} height={height} compact={compact} />
    </div>
  );
}
