/** Client for /api/model: TAREEKH, the course pipeline project's court-case model. */
import { API_URL, ApiError } from "./api";

export type Kind = {
  id: string;
  title: string;
  law_detail: string;
  case_type_name: string;
  court_level: string;
  cases_2017: number;
  within_1y_2017: number;
};

export type Options = {
  question: string;
  model: string;
  districts: string[];
  months: string[];
  kinds: Kind[];
  kinds_cover_2017: number;
  test: { n: number; auc: number; accuracy: number };
  notice: string;
  credit: string;
};

export type Effect = { input: string; label: string; value: string | null; effect: number };

export type Prediction = {
  probability: number;
  kind: Kind;
  district: string;
  filing_month: number;
  effects: Effect[];
  court_found: boolean;
  court: { pending: number; disposed_last_year: number; cutoff: string } | null;
  similar_filings_found: boolean;
  still_open: { label: string; months: Record<string, number>; median_days: number | null } | null;
  notice: string;
};

export type Sample = {
  case: Omit<Kind, "cases_2017" | "within_1y_2017"> & { district: string; filing_month: string; filed: string };
  probability: number;
  effects: Effect[];
  actual: { within_1y: boolean; ended: boolean; observed_days: number };
  notice: string;
};

export type Metric = { n: number; auc: number; brier: number; log_loss: number; accuracy: number; positive_rate: number };
export type Curve = { label: string; cases: number; median_days: number | null; still_open: Record<string, number> };
export type Rate = { mean: number; size: number };

export type Analytics = {
  national: {
    cases: number;
    monthly_decisions: Record<string, number>;
    states: { state: string; cases: number; cutoff: string | null; pending_2010_filings: number }[];
  };
  tamil_nadu: {
    cases: number;
    cleaning: {
      raw_law_names: number;
      canonical_laws: number;
      law_rows_named: number;
      raw_court_names: number;
      court_levels: number;
      decided_before_filing: number;
      gender_unclear: { defendant: number; petitioner: number };
      section_strings: Record<string, { raw: number; after: number }>;
    };
    survivorship: {
      courts_present_2010: number;
      cases_in_those_courts: Record<string, number>;
      same_day_share: Record<string, number>;
      median_days_among_decided: Record<string, number>;
    };
    still_open_curves: Record<string, Curve>;
    within_1y_by_year: Record<string, number>;
    within_1y_by_district: (Rate & { district: string })[];
    within_1y_by_type: (Rate & { type: string })[];
    within_1y_by_court_level: (Rate & { court_level: string })[];
    district_clusters: { k: number; silhouette: Record<string, number>; district_cluster: Record<string, number> };
  };
  case_type_names: Record<string, string>;
  model: {
    test: Record<string, Metric>;
    calibration: { predicted: string; cases: number; mean_predicted: number; observed: number }[];
    importance: Record<string, { mean: number; std: number }>;
    served: string;
  };
  experiments: {
    horizons: Record<string, { train: number[]; test: number; model: Metric; "baseline: rate per case type": Metric }>;
    weak_case_types: (Metric & { case_type: string; mean_predicted: number; observed: number })[];
  };
  credit: string;
};

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}/api/model${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {
      // non-JSON error body
    }
    throw new ApiError(res.status, detail);
  }
  return res.json() as Promise<T>;
}

export const getOptions = () => call<Options>("/options");
export const getAnalytics = () => call<Analytics>("/analytics");
export const getSample = () => call<Sample>("/sample");
export const predict = (district: string, kind: string, filing_month: number) =>
  call<Prediction>("/predict", { method: "POST", body: JSON.stringify({ district, kind, filing_month }) });

export const pct = (x: number, digits = 0) => `${(x * 100).toFixed(digits)}%`;
export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "1 year 4 months" for a day count. */
export function duration(days: number): string {
  if (days === 0) return "the same day";
  if (days < 31) return `${days} day${days === 1 ? "" : "s"}`;
  const months = Math.round(days / 30.44);
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (!years) return `${months} month${months === 1 ? "" : "s"}`;
  return `${years} year${years === 1 ? "" : "s"}${rest ? ` ${rest} month${rest === 1 ? "" : "s"}` : ""}`;
}
