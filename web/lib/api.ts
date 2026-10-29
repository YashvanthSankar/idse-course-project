import type { CaseState, Autopsy, CareerCharge, CareerVerdict, CareerView, CaseMeta, Cutscene, LevelInfo, Profile, RoomCreated, ToolId, ToolResult, ToolSpec, Verdict } from "./types";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(public status: number, public detail: string) {
    super(detail);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
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

const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });

export type LedgerRow = Record<string, string | number>;
export type Rows = { rows: LedgerRow[]; total: number };

export const createCase = (level: number, seed?: number, playerId?: string) =>
  post<CaseMeta>("/api/cases", { level, seed, player_id: playerId });

export const getCase = (caseId: string) => request<CaseMeta>(`/api/cases/${caseId}`);

/** Meta + every result run so far + the verdict (if closed): restores a case after a reload. */
export const getCaseState = (caseId: string) => request<CaseState>(`/api/cases/${caseId}/state`);

export const getRows = (caseId: string, offset = 0, limit = 200) =>
  request<Rows>(`/api/cases/${caseId}/rows?offset=${offset}&limit=${limit}`);

export const listTools = (level: number) => request<ToolSpec[]>(`/api/tools?level=${level}`);

export const runTool = (caseId: string, toolId: ToolId, params: Record<string, unknown> = {}) =>
  post<ToolResult>(`/api/cases/${caseId}/tools/${toolId}`, { params });

export const hackerCharge = (caseId: string) =>
  post<{ budget_left: number }>(`/api/cases/${caseId}/hacker-charge`);

export const accuse = (caseId: string, suspectId: string, evidenceIds: string[]) =>
  post<Verdict>(`/api/cases/${caseId}/accuse`, { suspect_id: suspectId, evidence_ids: evidenceIds });

export const csvUrl = (caseId: string) => `${API_URL}/api/cases/${caseId}/data.csv`;
export const reportUrl = (caseId: string) => `${API_URL}/api/cases/${caseId}/report.pdf`;

export const listLevels = () => request<LevelInfo[]>("/api/levels");

/** The host token proves this browser created the room (older servers didn't send one). */
export const createRoom = () => post<RoomCreated & { host_token?: string }>("/api/rooms");
export const getAutopsy = (code: string) => request<Autopsy>(`/api/rooms/${code}/autopsy`);
export const getProfile = (playerId: string) => request<Profile>(`/api/players/${encodeURIComponent(playerId)}/profile`);

/** Does this class room exist? (404 = no; network trouble is thrown, not treated as "no".) */
export async function roomExists(code: string): Promise<boolean> {
  try {
    await getAutopsy(code);
    return true;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return false;
    throw err;
  }
}

export const interrogate = (caseId: string, suspectId: string) =>
  request<{ suspect_id: string; statement: string }>(`/api/cases/${caseId}/interrogate/${suspectId}`);

// ── Career Mode ──────────────────────────────────────────────────────────────────
export const createCareer = (playerId?: string) => post<CareerView>("/api/career", { player_id: playerId });
export const getCareer = (code: string) => request<CareerView>(`/api/career/${encodeURIComponent(code)}`);
export const signContract = (code: string, companyId: string, practice = false) =>
  post<CareerView>(`/api/career/${encodeURIComponent(code)}/sign`, { company_id: companyId, practice });
export const retireCareer = (code: string) => post<CareerView>(`/api/career/${encodeURIComponent(code)}/retire`);
/** The contract's current case (created on first call). */
export const openCareerCase = (code: string) => post<CaseMeta>(`/api/career/${encodeURIComponent(code)}/case`);
export const careerAccuse = (caseId: string, accusations: CareerCharge[]) =>
  post<CareerVerdict>(`/api/career/cases/${caseId}/accuse`, { accusations });
/** One suspect's transactions, biggest first: where exhibits are picked. */
export const suspectRows = (caseId: string, suspectId: string) =>
  request<{ suspect_id: string; rows: LedgerRow[] }>(`/api/career/cases/${caseId}/suspects/${suspectId}/rows`);
export const getEnding = (code: string) => request<Cutscene>(`/api/career/${encodeURIComponent(code)}/ending`);
