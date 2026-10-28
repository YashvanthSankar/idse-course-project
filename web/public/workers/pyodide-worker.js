/* Real Python in the browser: Pyodide + pandas, with the case ledger loaded as `df`.
   Runs in a Web Worker so a runaway loop can be killed without freezing the game. */
importScripts("https://cdn.jsdelivr.net/pyodide/v0.27.2/full/pyodide.js");

let ready = null;

async function boot(csvUrl) {
  const py = await loadPyodide();
  await py.loadPackage(["pandas"]);
  const csv = await (await fetch(csvUrl)).text();
  py.FS.writeFile("/case.csv", csv);
  await py.runPythonAsync(
    "import numpy as np\nimport pandas as pd\n" +
      "pd.set_option('display.width', 120)\n" +
      "df = pd.read_csv('/case.csv', parse_dates=['date'])",
  );
  return py;
}

self.onmessage = async (event) => {
  const msg = event.data;
  if (msg.type === "init") {
    ready = boot(msg.csvUrl);
    try {
      await ready;
      self.postMessage({ type: "ready" });
    } catch (err) {
      self.postMessage({ type: "boot_error", error: String(err) });
    }
    return;
  }
  if (msg.type === "run") {
    const py = await ready;
    let stdout = "";
    py.setStdout({ batched: (s) => (stdout += s + "\n") });
    py.setStderr({ batched: (s) => (stdout += s + "\n") });
    try {
      const value = await py.runPythonAsync(msg.code);
      let text = null;
      if (value !== undefined && value !== null) {
        py.globals.set("_last", value);
        text = py.runPython(
          "(_last.to_string(max_rows=30, max_cols=12) if hasattr(_last, 'to_string') else repr(_last))",
        );
        if (value.destroy) value.destroy();
      }
      self.postMessage({ type: "result", id: msg.id, stdout, text });
    } catch (err) {
      self.postMessage({ type: "result", id: msg.id, stdout, error: String(err.message || err) });
    }
  }
};
