import { describe, expect, it } from "vitest";
import { backoffDelay, INITIAL_ROOM, roomReducer, roomSocketUrl } from "./ws";

describe("roomSocketUrl", () => {
  it("swaps http for ws and encodes params", () => {
    expect(roomSocketUrl("http://localhost:8000", "ABCD", "host")).toBe(
      "ws://localhost:8000/ws/rooms/ABCD?role=host",
    );
    expect(roomSocketUrl("https://api.example.com/", "WXYZ", "player", { playerId: "p 1", name: "Asha R" })).toBe(
      "wss://api.example.com/ws/rooms/WXYZ?role=player&player_id=p+1&name=Asha+R",
    );
  });
});

describe("backoffDelay", () => {
  it("doubles from 500 ms and caps at 5 s", () => {
    expect([0, 1, 2, 3, 4, 5, 10].map(backoffDelay)).toEqual([500, 1000, 2000, 4000, 5000, 5000, 5000]);
  });
});

describe("roomReducer", () => {
  it("tracks lobby, round, case, leaderboard, ticker and end", () => {
    let s = roomReducer(INITIAL_ROOM, {
      type: "lobby",
      status: "lobby",
      players: [{ player_id: "p1", name: "Asha", connected: true, solved: false }],
    });
    expect(s.players).toHaveLength(1);
    expect(s.phase).toBe("lobby");
    s = roomReducer(s, { type: "round_start", level: 2, ends_at: 123 });
    expect(s.phase).toBe("running");
    expect(s.level).toBe(2);
    expect(s.endsAt).toBe(123);
    s = roomReducer(s, { type: "your_case", case_id: "c1" });
    expect(s.caseId).toBe("c1");
    s = roomReducer(s, { type: "leaderboard", top: [], solved: 1, total: 2 });
    expect(s.solved).toBe(1);
    expect(s.total).toBe(2);
    for (let i = 0; i < 9; i++) s = roomReducer(s, { type: "ticker", text: `t${i}` });
    expect(s.ticker.map((t) => t.text)).toEqual(["t8", "t7", "t6", "t5", "t4", "t3"]);
    s = roomReducer(s, { type: "round_end" });
    expect(s.phase).toBe("ended");
  });

  it("an ended lobby status maps to the ended phase", () => {
    const s = roomReducer(INITIAL_ROOM, { type: "lobby", status: "ended", players: [] });
    expect(s.phase).toBe("ended");
  });

  it("welcome records the player id", () => {
    expect(roomReducer(INITIAL_ROOM, { type: "welcome", player_id: "p9", status: "lobby" }).playerId).toBe("p9");
  });
});
