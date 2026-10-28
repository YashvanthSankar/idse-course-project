"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { ApiError, csvUrl, hackerCharge } from "@/lib/api";
import { PythonSandbox, type RunResult } from "@/lib/pythonSandbox";
import { sfx } from "@/lib/sound";

const EXAMPLES = [
  "df.head()",
  "df.groupby('employee_id')['amount'].sum()",
  "df[df['hour'] < 6]",
  "df['vendor'].value_counts().tail(5)",
];

type Entry = { code: string; result: RunResult };

/** Hacker Mode: write your own pandas — real Python running in this browser tab. */
export function HackerConsole({ caseId, open, onClose, onBudget }: {
  caseId: string;
  open: boolean;
  onClose: () => void;
  onBudget: (budgetLeft: number) => void;
}) {
  const sandbox = useRef<PythonSandbox | null>(null);
  const [state, setState] = useState<"booting" | "ready" | "failed">("booting");
  const [code, setCode] = useState(EXAMPLES[1]);
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<Entry[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!open || sandbox.current) return;
    const box = new PythonSandbox(() => new Worker("/workers/pyodide-worker.js"), csvUrl(caseId));
    sandbox.current = box;
    box.ready.then(() => setState("ready"), () => setState("failed"));
  }, [open, caseId]);

  useEffect(() => () => sandbox.current?.dispose(), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function run() {
    const box = sandbox.current;
    if (!box || running || state !== "ready" || !code.trim()) return;
    setNotice(null);
    try {
      const { budget_left } = await hackerCharge(caseId); // pay first: 1 coin per query
      onBudget(budget_left);
      sfx.play("coin");
    } catch (err) {
      setNotice(err instanceof ApiError && err.status === 409 ? "Out of budget." : "Couldn't reach the lab.");
      return;
    }
    setRunning(true);
    const result = await box.run(code);
    setRunning(false);
    if ("timedOut" in result) {
      setState("booting");
      box.ready.then(() => setState("ready"), () => setState("failed"));
    }
    setHistory((h) => [{ code, result }, ...h].slice(0, 8));
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.section
          role="dialog"
          aria-label="Hacker mode"
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", stiffness: 260, damping: 30 }}
          className="fixed inset-x-0 bottom-0 z-[95] flex max-h-[80dvh] flex-col border-t border-green/40 bg-ink-950/97 shadow-2xl backdrop-blur"
        >
          <header className="flex items-center justify-between gap-4 border-b border-line px-5 py-3">
            <div>
              <h2 className="font-display text-2xl italic text-green">Hacker Mode</h2>
              <p className="text-sm text-paper/70">
                Real Python in your browser. The ledger is loaded as <code className="text-green">df</code>.
                Each run costs 1 coin · results are notes, not evidence.
              </p>
            </div>
            <button onClick={onClose} className="rounded border border-line px-3 py-1.5 text-sm text-paper/80 hover:border-paper/50">
              Close · Esc
            </button>
          </header>

          <div className="grid min-h-0 flex-1 gap-0 md:grid-cols-2">
            <div className="flex flex-col gap-3 border-line p-5 md:border-r">
              <textarea
                aria-label="Python code"
                value={code}
                spellCheck={false}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void run();
                  if (e.key === "Tab") {
                    e.preventDefault();
                    setCode((c) => `${c}    `);
                  }
                }}
                className="min-h-36 flex-1 resize-none rounded-md border border-line bg-black/60 p-4 font-mono text-[15px] leading-relaxed text-green outline-none focus:border-green/60"
              />
              <div className="flex flex-wrap gap-2">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    onClick={() => setCode(ex)}
                    className="rounded-full border border-line px-3 py-1 font-mono text-xs text-paper/70 hover:border-green/50 hover:text-green"
                  >
                    {ex}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => void run()}
                  disabled={state !== "ready" || running}
                  className="rounded-md bg-green px-5 py-2 font-semibold text-ink-950 transition-opacity disabled:opacity-40"
                >
                  {running ? "Running…" : "Run · 1 coin"}
                </button>
                <span className="text-sm text-paper/60">
                  {state === "booting" && "Booting Python in your browser… (first time takes a moment)"}
                  {state === "failed" && "Python couldn't load — check the connection."}
                  {state === "ready" && "⌘/Ctrl + Enter to run"}
                </span>
                {notice && <span className="text-sm text-red">{notice}</span>}
              </div>
            </div>

            <div className="min-h-0 overflow-y-auto p-5" aria-live="polite">
              {history.length === 0 ? (
                <p className="text-paper/50">Output appears here.</p>
              ) : (
                <ol className="space-y-5">
                  {history.map((entry, i) => (
                    <li key={history.length - i}>
                      <p className="mb-1 font-mono text-xs text-paper/50">&gt;&gt;&gt; {entry.code}</p>
                      <Output result={entry.result} />
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}

function Output({ result }: { result: RunResult }) {
  if ("timedOut" in result) {
    return <p className="text-amber">Timed out after 5 s — Python was restarted. Avoid endless loops.</p>;
  }
  return (
    <div className="space-y-2">
      {result.stdout && <pre className="whitespace-pre-wrap font-mono text-sm text-paper/80">{result.stdout}</pre>}
      {result.text && (
        <pre className="overflow-x-auto rounded bg-black/50 p-3 font-mono text-[13px] leading-snug text-paper">{result.text}</pre>
      )}
      {result.error && <pre className="whitespace-pre-wrap font-mono text-sm text-red">{result.error.split("\n").slice(-3).join("\n")}</pre>}
    </div>
  );
}
