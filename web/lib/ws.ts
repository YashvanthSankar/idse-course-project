"use client";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { API_URL } from "./api";

// ---- messages (DESIGN.md §10.2) -------------------------------------------------

export type LobbyPlayer = { player_id: string; name: string; connected: boolean; solved: boolean };
export type BoardRow = { rank: number; player_id: string; name: string; score: number; correct: boolean; solved: boolean };
export type RoomMessage =
  | { type: "lobby"; status: "lobby" | "running" | "ended"; players: LobbyPlayer[] }
  | { type: "welcome"; player_id: string; status: string }
  | { type: "round_start"; level: number; ends_at: number }
  | { type: "your_case"; case_id: string }
  | { type: "leaderboard"; top: BoardRow[]; solved: number; total: number }
  | { type: "ticker"; text: string }
  | { type: "round_end" };

export type SocketStatus = "connecting" | "open" | "closed" | "not_found" | "forbidden";
export type Phase = "lobby" | "running" | "ended";

export type RoomState = {
  phase: Phase;
  players: LobbyPlayer[];
  level: number | null;
  endsAt: number | null;
  caseId: string | null;
  playerId: string | null;
  top: BoardRow[];
  solved: number;
  total: number;
  ticker: { id: number; text: string }[];
};

export const INITIAL_ROOM: RoomState = {
  phase: "lobby",
  players: [],
  level: null,
  endsAt: null,
  caseId: null,
  playerId: null,
  top: [],
  solved: 0,
  total: 0,
  ticker: [],
};

const TICKER_LINES = 6;
let tickerId = 0;

export function roomReducer(state: RoomState, msg: RoomMessage): RoomState {
  switch (msg.type) {
    case "lobby":
      return { ...state, players: msg.players, phase: msg.status === "running" ? "running" : msg.status === "ended" ? "ended" : state.phase };
    case "welcome":
      return { ...state, playerId: msg.player_id };
    case "round_start":
      return { ...state, phase: "running", level: msg.level, endsAt: msg.ends_at, caseId: null };
    case "your_case":
      return { ...state, caseId: msg.case_id };
    case "leaderboard":
      return { ...state, top: msg.top, solved: msg.solved, total: msg.total };
    case "ticker":
      return { ...state, ticker: [{ id: ++tickerId, text: msg.text }, ...state.ticker].slice(0, TICKER_LINES) };
    case "round_end":
      return { ...state, phase: "ended" };
    default:
      return state;
  }
}

// ---- connection ---------------------------------------------------------------

export function roomSocketUrl(
  apiUrl: string,
  code: string,
  role: "host" | "player",
  opts: { playerId?: string; name?: string; token?: string } = {},
): string {
  const base = apiUrl.replace(/\/+$/, "").replace(/^http/, "ws");
  const params = new URLSearchParams({ role });
  if (opts.playerId) params.set("player_id", opts.playerId);
  if (opts.name) params.set("name", opts.name);
  if (opts.token) params.set("token", opts.token);
  return `${base}/ws/rooms/${encodeURIComponent(code)}?${params.toString()}`;
}

/** true / false when the API answers, null when it can't be reached (keep retrying). */
async function roomExists(code: string): Promise<boolean | null> {
  try {
    const res = await fetch(`${API_URL}/api/rooms/${encodeURIComponent(code)}/autopsy`);
    return res.status === 404 ? false : true;
  } catch {
    return null;
  }
}

/** 500 ms, 1 s, 2 s, 4 s, then 5 s forever. */
export const backoffDelay = (attempt: number) => Math.min(5000, 500 * 2 ** attempt);

/**
 * A reconnecting room socket. Phones lock and Wi-Fi drops; the server keeps the
 * player's case for the same player id, so we simply keep dialling back in.
 */
export function useRoomSocket(
  code: string,
  role: "host" | "player",
  opts: { playerId?: string; name?: string; token?: string; enabled?: boolean } = {},
) {
  const { playerId, name, token, enabled = true } = opts;
  const [status, setStatus] = useState<SocketStatus>("connecting");
  const [state, dispatch] = useReducer(roomReducer, INITIAL_ROOM);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let attempt = 0;
    let stopped = false;
    let timer = 0;

    const connect = () => {
      const ws = new WebSocket(roomSocketUrl(API_URL, code, role, { playerId, name, token }));
      let opened = false;
      socketRef.current = ws;
      ws.onopen = () => {
        opened = true;
        attempt = 0;
        setStatus("open");
      };
      ws.onmessage = (event) => {
        try {
          dispatch(JSON.parse(event.data) as RoomMessage);
        } catch {
          // ignore malformed frames
        }
      };
      ws.onclose = (event) => {
        // Only forget this socket if it is still the current one: a stale socket from an
        // earlier effect run must never wipe out its live replacement.
        if (socketRef.current === ws) socketRef.current = null;
        if (stopped) return;
        if (event.code === 4404) {
          setStatus("not_found");
          return;
        }
        if (event.code === 4403) {
          setStatus("forbidden"); // wrong or missing host token: retrying won't help
          return;
        }
        setStatus("closed");
        const retry = () => {
          if (!stopped) timer = window.setTimeout(connect, backoffDelay(attempt++));
        };
        // A rejected handshake surfaces as 1006, never 4404: ask the API whether the room exists.
        if (!opened) {
          roomExists(code).then((exists) => {
            if (stopped) return;
            if (exists === false) setStatus("not_found");
            else retry();
          });
        } else {
          retry();
        }
      };
    };
    connect();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [code, role, playerId, name, token, enabled]);

  const send = useCallback((message: Record<string, unknown>) => {
    const ws = socketRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
      return true;
    }
    return false;
  }, []);

  return { status, state, send };
}
