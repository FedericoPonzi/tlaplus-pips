/**
 * Generate TLA+ specs from PIPS puzzle JSON data.
 *
 * Produces two files:
 *   - Pips.tla: core algorithm with CONSTANTS (shared across difficulties)
 *   - <difficulty>.tla: puzzle data definitions + INSTANCE Pips
 */

/**
 * Core algorithm spec with CONSTANTS declared (no puzzle data).
 */
export const PIPS_SPEC = `---- MODULE Pips ----
EXTENDS Integers, Sequences, FiniteSets

CONSTANTS DominoValues, GridCells, Regions

\\* ===== DERIVED CONSTANTS =====

NumDominoes == Len(DominoValues)
NumRegions == Len(Regions)

\\* ===== VARIABLES =====

VARIABLES grid, usedDominoes

vars == <<grid, usedDominoes>>

\\* ===== HELPERS =====

CellLT(a, b) ==
    \\/ a[1] < b[1]
    \\/ (a[1] = b[1] /\\ a[2] < b[2])

Adjacent(c1, c2) ==
    \\/ (c1[1] = c2[1] /\\ c1[2] = c2[2] + 1)
    \\/ (c1[1] = c2[1] /\\ c1[2] = c2[2] - 1)
    \\/ (c1[2] = c2[2] /\\ c1[1] = c2[1] + 1)
    \\/ (c1[2] = c2[2] /\\ c1[1] = c2[1] - 1)

EmptyCells == {c \\in GridCells : grid[c] = -1}

NextEmptyCell ==
    CHOOSE c \\in EmptyCells :
        \\A c2 \\in EmptyCells : c = c2 \\/ CellLT(c, c2)

RECURSIVE SetSum(_)
SetSum(S) ==
    IF S = {} THEN 0
    ELSE LET x == CHOOSE x \\in S : TRUE
         IN grid[x] + SetSum(S \\ {x})

\\* ===== CONSTRAINT CHECKING =====

CheckRegion(i) ==
    LET r == Regions[i] IN
    CASE r.type = "sum"     -> SetSum(r.cells) = r.target
      [] r.type = "equals"  -> LET v == grid[CHOOSE c \\in r.cells : TRUE]
                                IN \\A c \\in r.cells : grid[c] = v
      [] r.type = "greater" -> LET c == CHOOSE c \\in r.cells : TRUE
                                IN grid[c] > r.target
      [] OTHER              -> TRUE

AllConstraintsMet ==
    \\A i \\in 1..NumRegions : CheckRegion(i)

PartialConstraintsOk ==
    /\\ \\A c \\in EmptyCells :
        \\E c2 \\in GridCells : Adjacent(c, c2) /\\ grid[c2] = -1
    /\\ \\A i \\in 1..NumRegions :
        LET r == Regions[i] IN
        LET covered == {c \\in r.cells : grid[c] /= -1} IN
        IF covered = {} THEN TRUE
        ELSE
            CASE r.type = "sum" ->
                IF covered = r.cells
                THEN SetSum(r.cells) = r.target
                ELSE SetSum(covered) <= r.target
              [] r.type = "equals" ->
                LET v == grid[CHOOSE c \\in covered : TRUE]
                IN \\A c \\in covered : grid[c] = v
              [] r.type = "greater" ->
                IF covered = r.cells
                THEN LET c == CHOOSE c \\in r.cells : TRUE
                     IN grid[c] > r.target
                ELSE TRUE
              [] OTHER -> TRUE

\\* ===== STATE MACHINE =====

Init ==
    /\\ grid = [c \\in GridCells |-> -1]
    /\\ usedDominoes = {}

Next ==
    /\\ EmptyCells /= {}
    /\\ LET cell == NextEmptyCell IN
       \\E d \\in (1..NumDominoes) \\ usedDominoes :
           \\E nbr \\in GridCells :
               /\\ Adjacent(cell, nbr)
               /\\ grid[nbr] = -1
               /\\ LET a == DominoValues[d][1]
                      b == DominoValues[d][2]
                  IN \\/ grid' = [grid EXCEPT ![cell] = a, ![nbr] = b]
                     \\/ (a /= b /\\ grid' = [grid EXCEPT ![cell] = b, ![nbr] = a])
               /\\ usedDominoes' = usedDominoes \\cup {d}

\\* ===== INVARIANT =====

NotSolved ==
    \\/ EmptyCells /= {}
    \\/ ~AllConstraintsMet

====
`;

function fmtCell(cell) {
  return `<<${cell[0]},${cell[1]}>>`;
}

function fmtCellSet(cells) {
  const sorted = [...cells].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return "{" + sorted.map(fmtCell).join(", ") + "}";
}

/**
 * Generate a data spec that defines puzzle constants and instances Pips.
 * @param {object} difficultyData - Puzzle data for one difficulty
 * @param {string} moduleName - Module name (e.g. "easy", "medium", "hard")
 * @returns {string} .tla file content
 */
export function generateDataSpec(difficultyData, moduleName = "hard") {
  const dominoes = difficultyData.dominoes;
  const regions = difficultyData.regions;

  const gridCellsSet = new Set();
  for (const region of regions) {
    for (const cell of region.indices) {
      gridCellsSet.add(`${cell[0]},${cell[1]}`);
    }
  }
  const gridCells = [...gridCellsSet]
    .map((s) => s.split(",").map(Number))
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);

  const constraintRegions = regions.filter((r) => r.type !== "empty");

  const lines = [];
  lines.push(`---- MODULE ${moduleName} ----`);
  lines.push("EXTENDS Integers, Sequences, FiniteSets");
  lines.push("");
  lines.push("\\* Auto-generated puzzle data from NYT PIPS API.");
  lines.push("");

  // Domino values
  lines.push("DominoValues == <<");
  dominoes.forEach((d, i) => {
    const comma = i < dominoes.length - 1 ? "," : "";
    lines.push(`    <<${d[0]}, ${d[1]}>>${comma}`);
  });
  lines.push(">>");
  lines.push("");

  // Grid cells
  lines.push("GridCells == {");
  const cellStrs = gridCells.map(fmtCell);
  for (let i = 0; i < cellStrs.length; i += 5) {
    const chunk = cellStrs.slice(i, i + 5);
    let line = "    " + chunk.join(", ");
    if (i + 5 < cellStrs.length) line += ",";
    lines.push(line);
  }
  lines.push("}");
  lines.push("");

  // Regions
  lines.push("Regions == <<");
  constraintRegions.forEach((r, i) => {
    const cellsStr = fmtCellSet(r.indices);
    const rtype = r.type;
    const target = r.target || 0;
    const comma = i < constraintRegions.length - 1 ? "," : "";
    lines.push(
      `    [cells |-> ${cellsStr}, type |-> "${rtype}", target |-> ${target}]${comma}`
    );
  });
  lines.push(">>");
  lines.push("");

  lines.push("VARIABLES grid, usedDominoes");
  lines.push("");
  lines.push("INSTANCE Pips");
  lines.push("");
  lines.push("====");
  lines.push("");

  return lines.join("\n");
}

/**
 * Generate the TLC config string.
 * @returns {string} .cfg file content
 */
export function generateCfg() {
  return "INIT Init\nNEXT Next\nINVARIANT NotSolved\nCONSTRAINT PartialConstraintsOk\n";
}

/**
 * Generate a single combined spec (for backward compatibility / offline verification).
 * @param {object} difficultyData - Puzzle data for one difficulty
 * @param {string} moduleName - Module name
 * @returns {string} Complete self-contained .tla file
 */
export function generateSpec(difficultyData, moduleName = "Pips") {
  const dominoes = difficultyData.dominoes;
  const regions = difficultyData.regions;

  const gridCellsSet = new Set();
  for (const region of regions) {
    for (const cell of region.indices) {
      gridCellsSet.add(`${cell[0]},${cell[1]}`);
    }
  }
  const gridCells = [...gridCellsSet]
    .map((s) => s.split(",").map(Number))
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);

  const constraintRegions = regions.filter((r) => r.type !== "empty");

  const lines = [];
  lines.push(`---- MODULE ${moduleName} ----`);
  lines.push("EXTENDS Integers, Sequences, FiniteSets");
  lines.push("");
  lines.push("\\* Auto-generated from NYT PIPS API.");
  lines.push("");

  lines.push("DominoValues == <<");
  dominoes.forEach((d, i) => {
    const comma = i < dominoes.length - 1 ? "," : "";
    lines.push(`    <<${d[0]}, ${d[1]}>>${comma}`);
  });
  lines.push(">>");
  lines.push("");

  lines.push("GridCells == {");
  const cellStrs = gridCells.map(fmtCell);
  for (let i = 0; i < cellStrs.length; i += 5) {
    const chunk = cellStrs.slice(i, i + 5);
    let line = "    " + chunk.join(", ");
    if (i + 5 < cellStrs.length) line += ",";
    lines.push(line);
  }
  lines.push("}");
  lines.push("");

  lines.push("Regions == <<");
  constraintRegions.forEach((r, i) => {
    const cellsStr = fmtCellSet(r.indices);
    const rtype = r.type;
    const target = r.target || 0;
    const comma = i < constraintRegions.length - 1 ? "," : "";
    lines.push(
      `    [cells |-> ${cellsStr}, type |-> "${rtype}", target |-> ${target}]${comma}`
    );
  });
  lines.push(">>");

  // Inline core logic (replacing CONSTANTS with direct definitions)
  const coreBody = PIPS_SPEC
    .split("\n")
    .filter((l) => !l.startsWith("---- MODULE") && !l.startsWith("====") && !l.startsWith("CONSTANTS "))
    .join("\n");

  return lines.join("\n") + "\n" + coreBody + "\n====\n";
}
