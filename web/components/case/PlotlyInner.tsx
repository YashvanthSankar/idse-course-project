"use client";
import Plotly from "plotly.js-dist-min";
import createPlotlyComponent from "react-plotly.js/factory";

const Plot = createPlotlyComponent(Plotly);

type Layout = Record<string, unknown> & { title?: unknown; margin?: Record<string, number> };
type Figure = { data?: unknown[]; layout?: Layout };

const axisKeys = (layout: Layout) => Object.keys(layout).filter((k) => /^[xy]axis\d*$/.test(k));

export default function PlotlyInner({ figure, height, compact }: { figure: Figure; height: number; compact: boolean }) {
  const base = figure.layout ?? {};
  const layout: Layout = { ...base, autosize: true, height };
  // Let Plotly make room for long suspect names instead of clipping them.
  for (const key of new Set([...axisKeys(base), "xaxis", "yaxis"])) {
    layout[key] = { ...(base[key] as object), automargin: true };
  }
  const title = typeof base.title === "object" && base.title ? (base.title as Record<string, unknown>) : { text: base.title };
  layout.title = {
    ...title,
    x: 0.01,
    xanchor: "left",
    font: { ...(title.font as object), size: compact ? 13 : 16 },
  };
  layout.margin = { ...base.margin, l: 8, r: 8, t: compact ? 34 : 42, b: 8 };
  if (compact) layout.font = { ...(base.font as object), size: 10 };

  return (
    <Plot
      data={figure.data ?? []}
      layout={layout}
      config={{ displayModeBar: false, responsive: true, scrollZoom: false }}
      useResizeHandler
      style={{ width: "100%", height }}
    />
  );
}
