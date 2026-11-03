import { describe, expect, it, vi } from "vitest";
import { PythonSandbox, type WorkerLike } from "./pythonSandbox";

/** A fake worker: answers "ready" to init and echoes runs unless the code says "hang". */
function fakeFactory() {
  const created: FakeWorker[] = [];
  class FakeWorker implements WorkerLike {
    onmessage: ((e: MessageEvent) => void) | null = null;
    terminated = false;
    postMessage(raw: unknown) {
      const msg = raw as { type: string; id?: number; code?: string };
      queueMicrotask(() => {
        if (msg.type === "init") this.onmessage?.({ data: { type: "ready" } } as MessageEvent);
        if (msg.type === "run" && msg.code !== "hang") {
          this.onmessage?.({ data: { type: "result", id: msg.id, stdout: "", text: `ran ${msg.code}` } } as MessageEvent);
        }
      });
    }
    terminate() {
      this.terminated = true;
    }
  }
  const factory = () => {
    const w = new FakeWorker();
    created.push(w);
    return w;
  };
  return { factory, created };
}

describe("PythonSandbox", () => {
  it("boots and runs code", async () => {
    const { factory } = fakeFactory();
    const box = new PythonSandbox(factory, "http://x/case.csv");
    await box.ready;
    expect(await box.run("df.shape")).toEqual({ stdout: "", text: "ran df.shape" });
  });

  it("kills a runaway loop after the timeout and reboots a fresh worker", async () => {
    vi.useFakeTimers();
    const { factory, created } = fakeFactory();
    const box = new PythonSandbox(factory, "http://x/case.csv", 5000);
    await vi.runAllTicks();
    await box.ready;
    const pending = box.run("hang");
    await vi.advanceTimersByTimeAsync(5001);
    expect(await pending).toEqual({ timedOut: true });
    expect(created[0].terminated).toBe(true);
    expect(created).toHaveLength(2);
    vi.useRealTimers();
    await box.ready;
    expect(await box.run("1+1")).toEqual({ stdout: "", text: "ran 1+1" });
  });
});
