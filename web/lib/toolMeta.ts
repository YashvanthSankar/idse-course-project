// Presentation details for each detective tool (icon, one-line "what it does").
export const TOOL_META: Record<string, { icon: string; blurb: string; lib: string }> = {
  summary: { icon: "Σ", blurb: "Who spends what, at a glance", lib: "pandas · describe()" },
  groupby: { icon: "▦", blurb: "Habits that differ from the pack", lib: "crosstab · chi-square" },
  zscore: { icon: "z", blurb: "Claims far from normal", lib: "numpy · z-scores" },
  iqr_box: { icon: "⊡", blurb: "Beyond the far-out fence", lib: "quantiles · IQR" },
  duplicates: { icon: "⧉", blurb: "The same bill, twice", lib: "pandas · self-merge" },
  benford: { icon: "1", blurb: "Do the digits look real?", lib: "scipy · chisquare" },
  timeseries: { icon: "⌁", blurb: "Spending while the office sleeps", lib: "resample · binomtest" },
  regression: { icon: "╱", blurb: "Expenses vs the deals they serve", lib: "sklearn · LinearRegression" },
  isoforest: { icon: "◎", blurb: "Let the machine find the odd one", lib: "sklearn · IsolationForest" },
};

export const PARAM_LABELS: Record<string, string> = {
  per_employee: "per person",
  global: "global",
  weekday: "weekday",
  vendor: "vendor",
  category: "category",
  hour_bucket: "hour",
  D: "daily",
  W: "weekly",
};

export const toolMeta = (id: string) =>
  TOOL_META[id] ?? { icon: "?", blurb: "", lib: "" };
