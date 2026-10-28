"""Simulate a lecture hall: N phones join a room, the host starts, everyone gets a case.

Usage: uv run python scripts/load_test.py --url http://localhost:8000 --players 200
"""

import argparse
import asyncio
import json
import statistics
import time
import urllib.request

import websockets


def create_room(base: str) -> tuple[str, str]:
    req = urllib.request.Request(f"{base}/api/rooms", method="POST")
    with urllib.request.urlopen(req) as res:
        body = json.load(res)
        return body["code"], body["host_token"]


async def player(ws_base: str, code: str, i: int, started: asyncio.Event, out: list[float]):
    url = f"{ws_base}/ws/rooms/{code}?role=player&player_id=load{i}&name=Detective{i}"
    async with websockets.connect(url, max_size=None) as ws:
        await started.wait()
        t0 = time.perf_counter()
        while True:
            msg = json.loads(await ws.recv())
            if msg["type"] == "your_case":
                out.append(time.perf_counter() - t0)
                return


async def main(base: str, n: int) -> None:
    ws_base = base.replace("http", "ws", 1)
    code, token = create_room(base)
    started, latencies = asyncio.Event(), []
    async with websockets.connect(f"{ws_base}/ws/rooms/{code}?role=host&token={token}", max_size=None) as host:
        t_join = time.perf_counter()
        tasks = [asyncio.create_task(player(ws_base, code, i, started, latencies))
                 for i in range(n)]
        while True:  # wait until the host sees everyone in the lobby
            msg = json.loads(await host.recv())
            if msg["type"] == "lobby" and len(msg["players"]) == n:
                break
        print(f"{n} players joined room {code} in {time.perf_counter() - t_join:.2f}s")
        started.set()
        await host.send(json.dumps({"type": "start", "level": 1, "seconds": 360}))
        await asyncio.wait_for(asyncio.gather(*tasks), timeout=60)
    lat = sorted(latencies)
    p95 = lat[int(0.95 * (len(lat) - 1))]
    print(f"cases delivered: {len(lat)}/{n}  median {statistics.median(lat):.3f}s  "
          f"p95 {p95:.3f}s  max {lat[-1]:.3f}s")
    assert len(lat) == n and p95 < 2.0, "load test failed"


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="http://localhost:8000")
    parser.add_argument("--players", type=int, default=200)
    args = parser.parse_args()
    asyncio.run(main(args.url, args.players))
