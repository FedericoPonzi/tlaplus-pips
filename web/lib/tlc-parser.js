/**
 * Parse TLC invariant-violation output into structured solution steps.
 *
 * TLC output for an invariant violation looks like:
 *   Error: Invariant NotSolved is violated.
 *   Error: The behavior up to this point is:
 *   State 1: <Initial predicate>
 *   /\ grid = (<<0,1>> :> -1 @@ <<0,2>> :> -1 @@ ...)
 *   /\ usedDominoes = {}
 *   State 2: <Next line ...>
 *   /\ grid = (<<0,1>> :> 3 @@ <<0,2>> :> -1 @@ ...)
 *   /\ usedDominoes = {1}
 *   ...
 *
 * We parse each state's grid, then diff consecutive states to find
 * which cells changed (= where the domino was placed).
 */

/**
 * Parse a TLA+ grid expression into a Map<string, number>.
 * Input: "(<<0,1>> :> 3 @@ <<0,2>> :> -1 @@ ...)"
 * Output: Map { "0,1" => 3, "0,2" => -1, ... }
 */
function parseGrid(gridStr) {
  const grid = new Map();
  const re = /<<(\d+),\s*(\d+)>>\s*:>\s*(-?\d+)/g;
  let match;
  while ((match = re.exec(gridStr)) !== null) {
    const row = parseInt(match[1], 10);
    const col = parseInt(match[2], 10);
    const val = parseInt(match[3], 10);
    grid.set(`${row},${col}`, val);
  }
  return grid;
}

/**
 * Parse a TLA+ set of integers: "{1, 3, 5}" or "{}".
 */
function parseIntSet(setStr) {
  const s = setStr.trim();
  if (s === "{}") return new Set();
  const nums = s
    .replace(/[{}]/g, "")
    .split(",")
    .map((x) => parseInt(x.trim(), 10));
  return new Set(nums);
}

/**
 * Parse TLC output into an array of states.
 * Each state has { grid: Map, usedDominoes: Set, stateNum: number }.
 */
function parseStates(output) {
  const states = [];
  const stateBlocks = output.split(/^State \d+:/m);

  for (let i = 1; i < stateBlocks.length; i++) {
    const block = stateBlocks[i];

    const gridMatch = block.match(/grid\s*=\s*\(([\s\S]*?)\)\s*\n\s*\/\\/);
    // Also try grid at end of block (last state)
    const gridMatch2 = block.match(/grid\s*=\s*\(([\s\S]*?)\)\s*$/m);
    const gm = gridMatch || gridMatch2;

    const usedMatch = block.match(/usedDominoes\s*=\s*(\{[^}]*\})/);

    if (gm && usedMatch) {
      states.push({
        stateNum: i,
        grid: parseGrid(gm[1]),
        usedDominoes: parseIntSet(usedMatch[1]),
      });
    }
  }

  return states;
}

/**
 * @typedef {Object} SolutionStep
 * @property {number} dominoIndex - 1-based domino index
 * @property {number[]} cell1 - [row, col] of first cell
 * @property {number[]} cell2 - [row, col] of second cell
 * @property {number} value1 - pip value at cell1
 * @property {number} value2 - pip value at cell2
 */

/**
 * Parse TLC invariant violation output into solution steps.
 * @param {string} output - Raw TLC output text
 * @returns {{ steps: SolutionStep[], finalGrid: Map<string, number> } | null}
 */
export function parseSolution(output) {
  if (!output.includes("Invariant NotSolved is violated")) {
    return null;
  }

  const states = parseStates(output);
  if (states.length < 2) return null;

  const steps = [];
  for (let i = 1; i < states.length; i++) {
    const prev = states[i - 1];
    const curr = states[i];

    // Find which domino was added
    const newDominoes = [...curr.usedDominoes].filter(
      (d) => !prev.usedDominoes.has(d)
    );
    const dominoIndex = newDominoes.length === 1 ? newDominoes[0] : -1;

    // Find cells that changed from -1 to a value
    const changedCells = [];
    for (const [key, val] of curr.grid) {
      if (prev.grid.get(key) === -1 && val !== -1) {
        const [row, col] = key.split(",").map(Number);
        changedCells.push({ row, col, value: val });
      }
    }

    if (changedCells.length === 2 && dominoIndex > 0) {
      steps.push({
        dominoIndex,
        cell1: [changedCells[0].row, changedCells[0].col],
        cell2: [changedCells[1].row, changedCells[1].col],
        value1: changedCells[0].value,
        value2: changedCells[1].value,
      });
    }
  }

  const finalGrid = states[states.length - 1].grid;
  return { steps, finalGrid };
}

/**
 * Extract error message from TLC output, if any.
 * @param {string} output
 * @returns {string|null}
 */
export function extractError(output) {
  if (output.includes("Invariant NotSolved is violated")) return null;

  const errorLines = output
    .split("\n")
    .filter((l) => l.startsWith("Error:"));
  if (errorLines.length > 0) {
    return errorLines.join("\n");
  }

  if (output.includes("Model checking completed. No error has been found")) {
    return "No solution found — model checking completed without finding an invariant violation.";
  }

  return null;
}

/**
 * Extract statistics from TLC output.
 * @param {string} output
 * @returns {{ states: number, distinct: number, time: string } | null}
 */
export function extractStats(output) {
  const statsMatch = output.match(
    /(\d+) states generated, (\d+) distinct states found/
  );
  const timeMatch = output.match(/Finished in (\S+)/);
  if (statsMatch) {
    return {
      states: parseInt(statsMatch[1], 10),
      distinct: parseInt(statsMatch[2], 10),
      time: timeMatch ? timeMatch[1] : "unknown",
    };
  }
  return null;
}
