// Plotly figures from Python encode numeric arrays as base64 typed arrays
// ({dtype, bdata}). These helpers turn them back into plain arrays so the
// Reveal can slice the fraud trace point by point.

type Typed = { dtype: string; bdata: string };
type Trace = Record<string, unknown> & { x?: unknown; y?: unknown; customdata?: unknown };
export type Figure = { data?: Trace[]; layout?: Record<string, unknown> };

const VIEWS: Record<string, (b: ArrayBuffer) => ArrayLike<number>> = {
  f8: (b) => new Float64Array(b),
  f4: (b) => new Float32Array(b),
  i4: (b) => new Int32Array(b),
  u4: (b) => new Uint32Array(b),
  i2: (b) => new Int16Array(b),
  u2: (b) => new Uint16Array(b),
  i1: (b) => new Int8Array(b),
  u1: (b) => new Uint8Array(b),
};

function base64ToBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

const isTyped = (v: unknown): v is Typed =>
  typeof v === "object" && v !== null && "bdata" in v && "dtype" in v;

export function decodeArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (isTyped(value)) {
    const view = VIEWS[value.dtype.replace(/^[<>|]/, "")];
    if (view) return Array.from(view(base64ToBuffer(value.bdata)));
  }
  return [];
}

/** The reveal figure with only the first `shown` points of the last ("the fraud") trace. */
export function revealFigure(figure: Figure, shown: number) {
  const traces = figure.data ?? [];
  const decoded = traces.map((t) => ({ ...t, x: decodeArray(t.x), y: decodeArray(t.y) }));
  const last = decoded.length - 1;
  const fraudCount = last >= 0 ? decoded[last].y.length : 0;
  const data = decoded.map((t, i) => {
    if (i !== last) return t;
    const custom = Array.isArray(t.customdata) ? t.customdata.slice(0, shown) : t.customdata;
    return { ...t, x: t.x.slice(0, shown), y: t.y.slice(0, shown), customdata: custom };
  });
  return { data, layout: figure.layout, fraudCount };
}
