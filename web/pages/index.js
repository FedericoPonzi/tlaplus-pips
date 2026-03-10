import { useState, useEffect, useRef, useCallback } from "react";
import Head from "next/head";
import { generateSpec, generateCfg } from "../lib/spec-gen";
import { parseSolution, extractError, extractStats } from "../lib/tlc-parser";
import { fetchPuzzle } from "../lib/puzzle-api";

const DIFFICULTIES = ["easy", "medium", "hard"];

/**
 * At build time, fetch today's puzzle and pre-generate all TLA+ specs.
 * If the API is unavailable, the page still works — it fetches client-side.
 */
export async function getStaticProps() {
  const today = new Date().toISOString().slice(0, 10);
  let puzzleData = null;
  let specs = {};

  try {
    const res = await fetch(
      `https://www.nytimes.com/svc/pips/v1/${today}.json`
    );
    if (res.ok) {
      puzzleData = await res.json();
      for (const d of DIFFICULTIES) {
        if (puzzleData[d]) specs[d] = generateSpec(puzzleData[d], "Pips");
      }
    }
  } catch (e) {
    console.warn("Build-time puzzle fetch failed:", e.message);
  }

  return {
    props: {
      buildDate: today,
      puzzleData,
      specs,
      cfg: generateCfg(),
    },
  };
}

export default function Home({
  buildDate,
  puzzleData: initialPuzzle,
  specs: initialSpecs,
  cfg,
}) {
  const [date, setDate] = useState(buildDate);
  const [difficulty, setDifficulty] = useState("hard");
  const [puzzle, setPuzzle] = useState(initialPuzzle);
  const [specs, setSpecs] = useState(initialSpecs);
  const [solving, setSolving] = useState(false);
  const [cheerpjReady, setCheerpjReady] = useState(false);
  const [cheerpjError, setCheerpjError] = useState(null);
  const [output, setOutput] = useState("");
  const [status, setStatus] = useState({ text: "Initializing CheerpJ…", type: "" });
  const [activeTab, setActiveTab] = useState("spec");
  const [modulesLoaded, setModulesLoaded] = useState(false);

  const puzzleRef = useRef(null);
  const rendererRef = useRef(null);
  const outputRef = useRef(null);

  // Browser-only module refs
  const cheerpjRef = useRef(null);
  const renderPuzzleFn = useRef(null);

  // Load browser-only modules and init CheerpJ
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      import("../lib/cheerpj-bridge"),
      import("../lib/puzzle-renderer"),
    ]).then(([cheerpj, renderer]) => {
      if (cancelled) return;
      cheerpjRef.current = cheerpj;
      renderPuzzleFn.current = renderer.renderPuzzle;
      setModulesLoaded(true);

      cheerpj
        .initCheerpJ()
        .then(() => {
          if (cancelled) return;
          setCheerpjReady(true);
          setStatus({ text: "Ready — click Solve to find solution", type: "" });
        })
        .catch((e) => {
          if (cancelled) return;
          setCheerpjError(e.message);
          setStatus({ text: `CheerpJ failed: ${e.message}`, type: "error" });
        });
    }).catch((e) => {
      if (cancelled) return;
      setCheerpjError(e.message);
      setStatus({ text: `Failed to load modules: ${e.message}`, type: "error" });
    });
    return () => { cancelled = true; };
  }, []);

  // Re-render puzzle SVG when data, difficulty, or modules change
  useEffect(() => {
    const diffData = puzzle?.[difficulty];
    if (diffData && puzzleRef.current && renderPuzzleFn.current) {
      rendererRef.current = renderPuzzleFn.current(puzzleRef.current, diffData);
    }
  }, [puzzle, difficulty, modulesLoaded]);

  // Auto-scroll output
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  const handleDateChange = useCallback(async (newDate) => {
    setDate(newDate);
    setOutput("");
    setStatus({ text: "Fetching puzzle…", type: "" });

    try {
      const data = await fetchPuzzle(newDate);
      setPuzzle(data);
      const newSpecs = {};
      for (const d of DIFFICULTIES) {
        if (data[d]) newSpecs[d] = generateSpec(data[d], "Pips");
      }
      setSpecs(newSpecs);
      setStatus({ text: `Loaded puzzle for ${newDate}`, type: "" });
    } catch (e) {
      setStatus({ text: `Failed: ${e.message}`, type: "error" });
    }
  }, []);

  const handleSolve = useCallback(async () => {
    const diffData = puzzle?.[difficulty];
    if (solving || !diffData || !cheerpjRef.current) return;
    setSolving(true);
    setActiveTab("output");
    setOutput("");
    setStatus({ text: "Running TLC…", type: "" });

    const spec = specs[difficulty] || generateSpec(diffData, "Pips");
    const startTime = Date.now();

    try {
      const result = await cheerpjRef.current.runTlc(
        spec,
        cfg,
        { workers: 1, checkDeadlock: false },
        (line) => setOutput((prev) => prev + line + "\n")
      );

      setOutput(result);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const solution = parseSolution(result);
      const stats = extractStats(result);
      const error = extractError(result);

      if (solution) {
        rendererRef.current?.showSolution(solution.steps);
        const statsMsg = stats
          ? ` (${stats.states.toLocaleString()} states, ${stats.time})`
          : "";
        setStatus({
          text: `✓ Solved in ${elapsed}s${statsMsg}`,
          type: "success",
        });
        setActiveTab("spec");
      } else if (error) {
        setStatus({ text: `✗ ${error}`, type: "error" });
      } else {
        setStatus({ text: `TLC finished in ${elapsed}s`, type: "" });
      }
    } catch (e) {
      setStatus({ text: `Error: ${e.message}`, type: "error" });
    }

    setSolving(false);
  }, [solving, puzzle, difficulty, specs, cfg]);

  const diffData = puzzle?.[difficulty];
  const constraintCount =
    diffData?.regions?.filter((r) => r.type !== "empty").length || 0;

  return (
    <>
      <Head>
        <title>PIPS Solver — TLA+ in the Browser</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta
          name="description"
          content="Solve NYT PIPS daily puzzles using TLA+ model checking in the browser"
        />
      </Head>

      <header>
        <h1>
          PIPS <span>Solver</span>
        </h1>
        <div className="controls">
          <input
            type="date"
            value={date}
            onChange={(e) => handleDateChange(e.target.value)}
            title="Puzzle date"
          />
          <select
            value={difficulty}
            onChange={(e) => {
              setDifficulty(e.target.value);
              setOutput("");
              rendererRef.current?.clearSolution();
            }}
            title="Difficulty"
          >
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {d.charAt(0).toUpperCase() + d.slice(1)}
              </option>
            ))}
          </select>
          <button
            className="solve-btn"
            onClick={handleSolve}
            disabled={!cheerpjReady || solving || !diffData}
          >
            {solving
              ? "Solving…"
              : cheerpjReady
                ? "Solve"
                : cheerpjError
                  ? "Unavailable"
                  : "Loading CheerpJ…"}
          </button>
        </div>
      </header>

      <main>
        <div className="panel puzzle-panel">
          <h2>
            Puzzle
            {diffData && (
              <span className="puzzle-info">
                {" "}— {diffData.dominoes.length} dominoes, {constraintCount}{" "}
                constraints
              </span>
            )}
          </h2>
          <div ref={puzzleRef} id="puzzle-grid" />
        </div>

        <div className="panel output-panel">
          <div className="tabs">
            <button
              className={`tab ${activeTab === "spec" ? "active" : ""}`}
              onClick={() => setActiveTab("spec")}
            >
              TLA+ Spec
            </button>
            <button
              className={`tab ${activeTab === "output" ? "active" : ""}`}
              onClick={() => setActiveTab("output")}
            >
              TLC Output
            </button>
          </div>
          <pre
            className={`tab-content ${activeTab === "spec" ? "active" : ""}`}
          >
            {specs?.[difficulty] ||
              (diffData
                ? generateSpec(diffData, "Pips")
                : "Select a puzzle to see the spec")}
          </pre>
          <pre
            ref={outputRef}
            className={`tab-content ${activeTab === "output" ? "active" : ""}`}
          >
            {output || "Click Solve to run TLC"}
          </pre>
          <div className={`status-bar ${status.type}`}>
            {solving && <span className="spinner" />}
            {status.text}
          </div>
        </div>
      </main>
    </>
  );
}
