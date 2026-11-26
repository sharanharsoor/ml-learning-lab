(() => {
  const byId = id => document.getElementById(id);
  const code = byId("demo-code");
  const demos = ["demo", "demo-sklearn"].map(prefix => {
    const useScikitLearn = prefix === "demo-sklearn";
    return {
      run: byId(prefix + "-run"),
      status: byId(prefix + "-status"),
      output: byId(prefix + "-output"),
      reference: byId(prefix + "-reference"),
      useScikitLearn,
      script: useScikitLearn
        ? byId("demo-data").textContent + "\n" + byId("demo-sklearn-code").textContent
        : code.textContent,
    };
  });
  const runtimeUrl = "https://cdn.jsdelivr.net/pyodide/v314.0.8/full/";
  let worker;
  let workerUrl;
  let timeout;
  let active;

  function runInWorker(indexURL) {
    let runtime;
    let scikitLearnReady = false;
    let lines = [];
    self.addEventListener("message", async ({ data: { script, useScikitLearn } }) => {
      try {
        if (!runtime) {
          const { loadPyodide } = await import(indexURL + "pyodide.mjs");
          runtime = await loadPyodide({ indexURL, stdout: line => lines.push(line) });
        }
      } catch {
        self.postMessage({ type: "unavailable" });
        return;
      }
      if (useScikitLearn && !scikitLearnReady) {
        self.postMessage({ type: "loading-packages" });
        try {
          await runtime.loadPackage("scikit-learn");
          scikitLearnReady = true;
        } catch {
          self.postMessage({ type: "packages-unavailable" });
          return;
        }
      }
      self.postMessage({ type: "running" });
      lines = [];
      try {
        runtime.runPython(script);
        self.postMessage({ type: "result", text: lines.join("\n") });
      } catch (error) {
        self.postMessage({ type: "error", text: String(error) });
      }
    });
  }

  function releaseWorkerUrl() {
    if (workerUrl) URL.revokeObjectURL(workerUrl);
    workerUrl = undefined;
  }

  function finish(message) {
    clearTimeout(timeout);
    active.status.textContent = message;
    active = undefined;
    for (const demo of demos) demo.run.disabled = false;
  }

  function showFallback(message, resetWorker = true) {
    if (resetWorker) {
      worker?.terminate();
      worker = undefined;
    }
    releaseWorkerUrl();
    active.reference.open = true;
    finish(message);
  }

  function handleMessage({ data: response }) {
    releaseWorkerUrl();
    const { status, output, useScikitLearn } = active;
    if (response.type === "loading-packages") {
      status.textContent = "Downloading scikit-learn and its dependencies…";
    } else if (response.type === "running") {
      status.textContent = useScikitLearn ? "Fitting the trees in scikit-learn…" : "Running the example in Python…";
    } else if (response.type === "result") {
      output.textContent = response.text;
      output.hidden = false;
      finish(useScikitLearn ? "Finished running in scikit-learn." : "Finished running in Python.");
    } else if (response.type === "error") {
      output.textContent = response.text;
      output.hidden = false;
      showFallback("Python started, but the example returned an error. The reference output is below.", false);
    } else if (response.type === "packages-unavailable") {
      showFallback("scikit-learn could not load. You can retry or use the reference output below.", false);
    } else if (response.type === "unavailable") {
      showFallback("Python could not load. You can retry or use the reference output below.");
    }
  }

  function start(demo) {
    if (active) return;
    active = demo;
    for (const panel of demos) panel.run.disabled = true;
    const { status, output, script, useScikitLearn } = demo;
    output.hidden = true;
    status.textContent = worker ? "Preparing the example…" : "Loading Python for this browser…";
    try {
      if (!worker) {
        const program = `(${runInWorker.toString()})(${JSON.stringify(runtimeUrl)});`;
        workerUrl = URL.createObjectURL(new Blob([program], { type: "text/javascript" }));
        const nextWorker = new Worker(workerUrl, { type: "module" });
        worker = nextWorker;
        nextWorker.addEventListener("message", event => {
          if (worker === nextWorker && active) handleMessage(event);
        });
        nextWorker.addEventListener("error", () => {
          if (worker === nextWorker && active) {
            showFallback("Python could not start in this browser. The reference output is below.");
          }
        });
      }
      timeout = setTimeout(() => {
        const name = useScikitLearn ? "scikit-learn" : "Python";
        showFallback(name + " did not respond in time. You can retry or use the reference output below.");
      }, useScikitLearn ? 90_000 : 45_000);
      worker.postMessage({ script, useScikitLearn });
    } catch {
      showFallback("Python could not start in this browser. The reference output is below.");
    }
  }

  for (const demo of demos) demo.run.addEventListener("click", () => start(demo));

  byId("demo-copy").addEventListener("click", async () => {
    const copyStatus = byId("demo-copy-status");
    copyStatus.textContent = "";
    try {
      await navigator.clipboard.writeText(code.textContent);
      copyStatus.textContent = "Python code copied.";
    } catch {
      byId("demo-source").open = true;
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(code);
      selection.removeAllRanges();
      selection.addRange(range);
      copyStatus.textContent = "Code selected. Use your device’s Copy shortcut.";
    }
  });
})();
