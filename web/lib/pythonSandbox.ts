// Owns the Pyodide web worker: boots it with the case CSV, runs code with a hard
// timeout, and replaces the worker if a run hangs (e.g. `while True: pass`).

export type WorkerLike = {
  onmessage: ((e: MessageEvent) => void) | null;
  postMessage: (msg: unknown) => void;
  terminate: () => void;
};

export type RunResult =
  | { stdout: string; text?: string | null; error?: string }
  | { timedOut: true };

type Pending = { resolve: (r: RunResult) => void; timer: ReturnType<typeof setTimeout> };

export class PythonSandbox {
  ready!: Promise<void>;
  private worker!: WorkerLike;
  private nextId = 1;
  private pending = new Map<number, Pending>();

  constructor(
    private makeWorker: () => WorkerLike,
    private csvUrl: string,
    private timeoutMs = 5000,
  ) {
    this.boot();
  }

  private boot() {
    this.worker = this.makeWorker();
    this.ready = new Promise((resolve, reject) => {
      this.worker.onmessage = (e: MessageEvent) => {
        const msg = e.data;
        if (msg.type === "ready") resolve();
        else if (msg.type === "boot_error") reject(new Error(msg.error));
        else if (msg.type === "result") {
          const job = this.pending.get(msg.id);
          if (!job) return;
          clearTimeout(job.timer);
          this.pending.delete(msg.id);
          const { stdout, text, error } = msg;
          job.resolve(error ? { stdout, error } : { stdout, text });
        }
      };
    });
    this.worker.postMessage({ type: "init", csvUrl: this.csvUrl });
  }

  run(code: string): Promise<RunResult> {
    const id = this.nextId++;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        this.worker.terminate(); // the only way to stop a busy worker
        this.boot();
        resolve({ timedOut: true });
      }, this.timeoutMs);
      this.pending.set(id, { resolve, timer });
      this.worker.postMessage({ type: "run", id, code });
    });
  }

  dispose() {
    this.pending.forEach((p) => clearTimeout(p.timer));
    this.worker.terminate();
  }
}
