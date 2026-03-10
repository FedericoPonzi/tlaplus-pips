import { useState, useEffect, useRef, useCallback } from "react";
import Head from "next/head";
import { PIPS_SPEC, generateDataSpec, generateCfg } from "../lib/spec-gen";
import { parseSolution, extractError, extractStats } from "../lib/tlc-parser";
import { fetchPuzzle } from "../lib/puzzle-api";

const DIFFICULTIES = ["easy", "medium", "hard"];

export async function getStaticProps() {
  const today = new Date().toISOString().slice(0, 10);
  let puzzleData = null;
  let dataSpecs = {};

  try {
    const res = await fetch(
      `https://www.nytimes.com/svc/pips/v1/${today}.json`
    );
    if (res.ok) {
      puzzleData = await res.json();
      for (const d of DIFFICULTIES) {
        if (puzzleData[d]) dataSpecs[d] = generateDataSpec(puzzleData[d], d);
      }
    }
  } catch (e) {
    console.warn("Build-time puzzle fetch failed:", e.message);
  }

  return {
    props: {
      buildDate: today,
      puzzleData,
      dataSpecs,
      pipsSpec: PIPS_SPEC,
      cfg: generateCfg(),
    },
  };
}

export default function Home({
  buildDate,
  puzzleData: initialPuzzle,
  dataSpecs: initialDataSpecs,
  pipsSpec: initialPipsSpec,
  cfg,
}) {
  const [date, setDate] = useState(buildDate);
  const [difficulty, setDifficulty] = useState("hard");
  const [puzzle, setPuzzle] = useState(initialPuzzle);
  const [dataSpecs, setDataSpecs] = useState(initialDataSpecs);
  // Editable specs
  const [editedPipsSpec, setEditedPipsSpec] = useState(initialPipsSpec);
  const [editedDataSpec, setEditedDataSpec] = useState(initialDataSpecs?.hard || "");
  const [solving, setSolving] = useState(false);
  const [cheerpjReady, setCheerpjReady] = useState(false);
  const [cheerpjError, setCheerpjError] = useState(null);
  const [output, setOutput] = useState("");
  const [status, setStatus] = useState({ text: "Initializing CheerpJ…", type: "" });
  const [activeTab, setActiveTab] = useState("data");
  const [stoppedMessage, setStoppedMessage] = useState("");
  const [modulesLoaded, setModulesLoaded] = useState(false);

  const puzzleRef = useRef(null);
  const rendererRef = useRef(null);
  const outputRef = useRef(null);
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

  // Re-render puzzle SVG
  useEffect(() => {
    const diffData = puzzle?.[difficulty];
    if (diffData && puzzleRef.current && renderPuzzleFn.current) {
      rendererRef.current = renderPuzzleFn.current(puzzleRef.current, diffData);
    }
  }, [puzzle, difficulty, modulesLoaded]);

  // Update data spec when difficulty changes
  useEffect(() => {
    const spec = dataSpecs?.[difficulty];
    if (spec) setEditedDataSpec(spec);
  }, [dataSpecs, difficulty]);

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
      const newDataSpecs = {};
      for (const d of DIFFICULTIES) {
        if (data[d]) newDataSpecs[d] = generateDataSpec(data[d], d);
      }
      setDataSpecs(newDataSpecs);
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
    setStoppedMessage("");
    setStatus({ text: "Running TLC…", type: "" });

    const startTime = Date.now();

    try {
      const result = await cheerpjRef.current.runTlc(
        editedDataSpec,
        cfg,
        { workers: 1, checkDeadlock: false },
        (line) => setOutput((prev) => prev + line + "\n"),
        { "Pips.tla": editedPipsSpec }
      );

      // null result means stopped by user — keep streamed output as-is
      if (result == null) return;

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
        setActiveTab("data");
      } else if (error) {
        setStatus({ text: `✗ ${error}`, type: "error" });
      } else {
        setStatus({ text: `TLC finished in ${elapsed}s`, type: "" });
      }
    } catch (e) {
      setStatus({ text: `Error: ${e.message}`, type: "error" });
    }

    setSolving(false);
  }, [solving, puzzle, difficulty, editedDataSpec, editedPipsSpec, cfg]);

  const handleStop = useCallback(() => {
    if (!solving || !cheerpjRef.current) return;
    cheerpjRef.current.stopTlc();
    setStoppedMessage("\nTLC execution stopped by user.\n");
    setSolving(false);
    setStatus({ text: "Stopped by user", type: "" });
  }, [solving]);

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
          {solving ? (
            <button className="stop-btn" onClick={handleStop}>
              Stop
            </button>
          ) : (
            <button
              className="solve-btn"
              onClick={handleSolve}
              disabled={!cheerpjReady || !diffData}
            >
              {cheerpjReady
                ? "Solve"
                : cheerpjError
                  ? "Unavailable"
                  : "Loading CheerpJ…"}
            </button>
          )}
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
              className={`tab ${activeTab === "data" ? "active" : ""}`}
              onClick={() => setActiveTab("data")}
            >
              {difficulty}.tla
            </button>
            <button
              className={`tab ${activeTab === "pips" ? "active" : ""}`}
              onClick={() => setActiveTab("pips")}
            >
              Pips.tla
            </button>
            <button
              className={`tab ${activeTab === "cfg" ? "active" : ""}`}
              onClick={() => setActiveTab("cfg")}
            >
              Pips.cfg
            </button>
            <button
              className={`tab ${activeTab === "output" ? "active" : ""}`}
              onClick={() => setActiveTab("output")}
            >
              TLC Output
            </button>
          </div>
          <textarea
            className={`tab-content spec-editor ${activeTab === "data" ? "active" : ""}`}
            value={editedDataSpec}
            onChange={(e) => setEditedDataSpec(e.target.value)}
            spellCheck={false}
          />
          <textarea
            className={`tab-content spec-editor ${activeTab === "pips" ? "active" : ""}`}
            value={editedPipsSpec}
            onChange={(e) => setEditedPipsSpec(e.target.value)}
            spellCheck={false}
          />
          <pre
            className={`tab-content ${activeTab === "cfg" ? "active" : ""}`}
          >
            {cfg}
          </pre>
          <pre
            ref={outputRef}
            className={`tab-content ${activeTab === "output" ? "active" : ""}`}
          >
            {output || "Click Solve to run TLC"}
            {stoppedMessage && <strong>{stoppedMessage}</strong>}
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
