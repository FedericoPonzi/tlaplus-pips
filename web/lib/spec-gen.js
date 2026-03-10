/**
 * Generate TLA+ specs from PIPS puzzle JSON data.
 *
 * Pips.tla is loaded from spec/ folder at build time (in getStaticProps).
 * <difficulty>.tla: puzzle data definitions + INSTANCE Pips
 */

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
