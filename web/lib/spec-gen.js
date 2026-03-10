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

NumDominoes == Len(DominoValues)
NumRegions == Len(Regions)

AdjMap == [c \\in GridCells |->
    {c2 \\in GridCells :
        \\/ (c[1] = c2[1] /\\ (c[2] = c2[2] + 1 \\/ c[2] = c2[2] - 1))
        \\/ (c[2] = c2[2] /\\ (c[1] = c2[1] + 1 \\/ c[1] = c2[1] - 1))}]

CellRegion == [c \\in GridCells |->
    IF \\E i \\in 1..NumRegions : c \\in Regions[i].cells
    THEN CHOOSE i \\in 1..NumRegions : c \\in Regions[i].cells
    ELSE 0]

RegionSize == [i \\in 1..NumRegions |-> Cardinality(Regions[i].cells)]

\\* Precompute: for each domino, the face counts it contributes [0..6 |-> count]
DominoFaces(d) == [v \\in 0..6 |->
    (IF DominoValues[d][1] = v THEN 1 ELSE 0) +
    (IF DominoValues[d][2] = v THEN 1 ELSE 0)]

\\* Total face counts across all dominoes (constant, computed once)
TotalFaces == [v \\in 0..6 |->
    Cardinality({<<d, s>> \\in (1..NumDominoes) \\X {1, 2} : DominoValues[d][s] = v})]

VARIABLES grid, usedDominoes, usedFaces
vars == <<grid, usedDominoes, usedFaces>>

CellLT(a, b) ==
    \\/ a[1] < b[1]
    \\/ (a[1] = b[1] /\\ a[2] < b[2])

EmptyCells == {c \\in GridCells : grid[c] = -1}

NextEmptyCell ==
    CHOOSE c \\in EmptyCells :
        \\A c2 \\in EmptyCells : c = c2 \\/ CellLT(c, c2)

RECURSIVE SetSum(_)
SetSum(S) ==
    IF S = {} THEN 0
    ELSE LET x == CHOOSE x \\in S : TRUE
         IN grid[x] + SetSum(S \\ {x})

\\* Available faces for value v: O(1) lookup instead of recursive count
AvailFaces(v) == TotalFaces[v] - usedFaces[v]

\\* Precompute cell constraint info to avoid repeated SetSum calls.
\\* Returns <<type, ...>> where type: 0=none, 1=sum, 2=equals_free, 3=equals_fixed, 4=greater
CellConstraintInfo(c) ==
    LET ri == CellRegion[c] IN
    IF ri = 0 THEN <<0>>
    ELSE LET r == Regions[ri] IN
         CASE r.type = "sum" ->
              LET cov == {c2 \\in r.cells : c2 /= c /\\ grid[c2] /= -1} IN
              <<1, r.target, SetSum(cov), RegionSize[ri] - Cardinality(cov) - 1>>
           [] r.type = "equals" ->
              LET filled == {c2 \\in r.cells : c2 /= c /\\ grid[c2] /= -1} IN
              IF filled = {} THEN <<2>>
              ELSE <<3, grid[CHOOSE c2 \\in filled : TRUE]>>
           [] r.type = "greater" -> <<4, r.target>>
           [] OTHER -> <<0>>

\\* Fast value check using precomputed info — no SetSum calls
FastValueOk(v, info) ==
    CASE info[1] = 0 -> TRUE
      [] info[1] = 1 ->
         IF info[4] = 0
         THEN info[3] + v = info[2]
         ELSE /\\ info[3] + v <= info[2]
              /\\ info[2] - info[3] - v <= 6 * info[4]
      [] info[1] = 2 -> TRUE
      [] info[1] = 3 -> v = info[2]
      [] info[1] = 4 -> v > info[2]

ValueOkForCell(c, v) == FastValueOk(v, CellConstraintInfo(c))

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
        \\E c2 \\in AdjMap[c] : grid[c2] = -1
    /\\ \\A i \\in 1..NumRegions :
        LET r == Regions[i] IN
        LET covered == {c \\in r.cells : grid[c] /= -1} IN
        LET empty == r.cells \\ covered IN
        IF covered = {} THEN TRUE
        ELSE
            CASE r.type = "sum" ->
                LET currentSum == SetSum(covered) IN
                IF covered = r.cells
                THEN currentSum = r.target
                ELSE /\\ currentSum <= r.target
                     /\\ r.target - currentSum <= 6 * Cardinality(empty)
              [] r.type = "equals" ->
                LET v == grid[CHOOSE c \\in covered : TRUE] IN
                /\\ \\A c \\in covered : grid[c] = v
                /\\ AvailFaces(v) >= Cardinality(empty)
              [] r.type = "greater" ->
                /\\ \\A c \\in covered : grid[c] > r.target
              [] OTHER -> TRUE

Init ==
    /\\ grid = [c \\in GridCells |-> -1]
    /\\ usedDominoes = {}
    /\\ usedFaces = [v \\in 0..6 |-> 0]

Next ==
    /\\ EmptyCells /= {}
    /\\ LET cell == NextEmptyCell IN
       LET cellInfo == CellConstraintInfo(cell) IN
       \\E nbr \\in AdjMap[cell] :
           /\\ grid[nbr] = -1
           /\\ LET nbrInfo == CellConstraintInfo(nbr) IN
              \\E d \\in (1..NumDominoes) \\ usedDominoes :
                  LET a == DominoValues[d][1]
                      b == DominoValues[d][2]
                      df == DominoFaces(d)
                  IN /\\ usedFaces' = [v \\in 0..6 |-> usedFaces[v] + df[v]]
                     /\\ (\\/ (/\\ FastValueOk(a, cellInfo)
                             /\\ FastValueOk(b, nbrInfo)
                             /\\ grid' = [grid EXCEPT ![cell] = a, ![nbr] = b])
                         \\/ (/\\ a /= b
                             /\\ FastValueOk(b, cellInfo)
                             /\\ FastValueOk(a, nbrInfo)
                             /\\ grid' = [grid EXCEPT ![cell] = b, ![nbr] = a]))
                     /\\ usedDominoes' = usedDominoes \\cup {d}

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

  lines.push("VARIABLES grid, usedDominoes, usedFaces");
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
