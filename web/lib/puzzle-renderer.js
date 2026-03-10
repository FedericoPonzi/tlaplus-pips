/**
 * SVG puzzle renderer — draws the PIPS grid, constraint regions,
 * domino tiles, and solution overlay.
 */

const CELL_SIZE = 56;
const CELL_PAD = 2;
const INNER = CELL_SIZE - CELL_PAD * 2;
const SVG_NS = "http://www.w3.org/2000/svg";

const REGION_COLORS = [
  "#4e79a7", "#f28e2b", "#e15759", "#76b7b2",
  "#59a14f", "#edc948", "#b07aa1", "#ff9da7",
  "#9c755f", "#bab0ac", "#86bcb6", "#8cd17d",
  "#d4a6c8", "#d7b5a6", "#a0cbe8", "#ffbe7d",
];

/**
 * Build a region-color map: cell key "r,c" -> color string.
 * Assigns colors based on region index.
 */
function buildCellRegionMap(regions) {
  const map = new Map();
  regions.forEach((region, i) => {
    const color = REGION_COLORS[i % REGION_COLORS.length];
    for (const cell of region.indices) {
      map.set(`${cell[0]},${cell[1]}`, { color, regionIdx: i, region });
    }
  });
  return map;
}

/**
 * Compute the centroid of a region's cells for label placement.
 */
function regionCenter(region) {
  let sr = 0,
    sc = 0;
  for (const c of region.indices) {
    sr += c[0];
    sc += c[1];
  }
  const n = region.indices.length;
  return { row: sr / n, col: sc / n };
}

function svgEl(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    el.setAttribute(k, v);
  }
  return el;
}

/**
 * Format a constraint label for a region.
 */
function constraintLabel(region) {
  if (region.type === "sum") return `Σ${region.target}`;
  if (region.type === "equals") return "=";
  if (region.type === "greater") return `>${region.target}`;
  return "";
}

/**
 * Draw pip dots on a cell.
 * @param {SVGElement} parent
 * @param {number} cx - center x
 * @param {number} cy - center y
 * @param {number} value - 0-6
 * @param {number} size - cell size for pip layout
 * @param {string} fill - dot color
 */
function drawPips(parent, cx, cy, value, size, fill = "#fff") {
  const r = size * 0.07;
  const off = size * 0.22;

  const positions = {
    0: [],
    1: [[0, 0]],
    2: [
      [-off, -off],
      [off, off],
    ],
    3: [
      [-off, -off],
      [0, 0],
      [off, off],
    ],
    4: [
      [-off, -off],
      [off, -off],
      [-off, off],
      [off, off],
    ],
    5: [
      [-off, -off],
      [off, -off],
      [0, 0],
      [-off, off],
      [off, off],
    ],
    6: [
      [-off, -off],
      [off, -off],
      [-off, 0],
      [off, 0],
      [-off, off],
      [off, off],
    ],
  };

  const dots = positions[value] || [];
  for (const [dx, dy] of dots) {
    parent.appendChild(
      svgEl("circle", {
        cx: cx + dx,
        cy: cy + dy,
        r,
        fill,
      })
    );
  }
}

/**
 * Render the puzzle grid into a container element.
 * @param {HTMLElement} container
 * @param {object} puzzleData - Difficulty data with dominoes, regions
 * @returns {object} Renderer handle with update methods
 */
export function renderPuzzle(container, puzzleData) {
  container.innerHTML = "";

  const { regions, dominoes } = puzzleData;

  // Compute grid bounds
  const allCells = [];
  for (const region of regions) {
    for (const cell of region.indices) {
      allCells.push(cell);
    }
  }
  const minRow = Math.min(...allCells.map((c) => c[0]));
  const maxRow = Math.max(...allCells.map((c) => c[0]));
  const minCol = Math.min(...allCells.map((c) => c[1]));
  const maxCol = Math.max(...allCells.map((c) => c[1]));

  const cellSet = new Set(allCells.map((c) => `${c[0]},${c[1]}`));
  const regionMap = buildCellRegionMap(regions);

  const margin = 20;
  const width = (maxCol - minCol + 1) * CELL_SIZE + margin * 2;
  const height = (maxRow - minRow + 1) * CELL_SIZE + margin * 2;

  const svg = svgEl("svg", {
    width,
    height,
    viewBox: `0 0 ${width} ${height}`,
    class: "puzzle-svg",
  });

  const gridGroup = svgEl("g", { class: "grid" });
  const labelGroup = svgEl("g", { class: "labels" });
  const solutionGroup = svgEl("g", { class: "solution" });

  // Draw cells
  const cellElements = new Map();
  for (const key of cellSet) {
    const [r, c] = key.split(",").map(Number);
    const x = (c - minCol) * CELL_SIZE + margin + CELL_PAD;
    const y = (r - minRow) * CELL_SIZE + margin + CELL_PAD;

    const info = regionMap.get(key);
    const fill = info ? info.color : "#444";

    const rect = svgEl("rect", {
      x,
      y,
      width: INNER,
      height: INNER,
      rx: 4,
      fill,
      opacity: 0.35,
      stroke: "#666",
      "stroke-width": 1,
    });
    gridGroup.appendChild(rect);
    cellElements.set(key, { rect, x, y });
  }

  // Draw region constraint labels
  const drawnRegions = new Set();
  for (const region of regions) {
    if (region.type === "empty") continue;
    const label = constraintLabel(region);
    if (!label) continue;

    const center = regionCenter(region);
    const cx = (center.col - minCol + 0.5) * CELL_SIZE + margin;
    const cy = (center.row - minRow + 0.5) * CELL_SIZE + margin;

    const text = svgEl("text", {
      x: cx,
      y: cy,
      "text-anchor": "middle",
      "dominant-baseline": "central",
      fill: "#fff",
      "font-size": "13",
      "font-weight": "bold",
      "font-family": "monospace",
      "pointer-events": "none",
      opacity: 0.7,
    });
    text.textContent = label;
    labelGroup.appendChild(text);
  }

  svg.appendChild(gridGroup);
  svg.appendChild(solutionGroup);
  svg.appendChild(labelGroup);
  container.appendChild(svg);

  // Render domino tiles below the grid
  const tilesDiv = document.createElement("div");
  tilesDiv.className = "domino-tiles";
  const tileWidth = 100;
  const tileHeight = 44;
  const tilesSvg = svgEl("svg", {
    width: Math.min(dominoes.length * (tileWidth + 8) + 8, width),
    height: Math.ceil(dominoes.length / Math.floor(width / (tileWidth + 8))) * (tileHeight + 8) + 8,
    class: "tiles-svg",
  });

  const cols = Math.max(1, Math.floor(width / (tileWidth + 8)));
  dominoes.forEach((d, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const tx = col * (tileWidth + 8) + 4;
    const ty = row * (tileHeight + 8) + 4;

    const g = svgEl("g", {
      transform: `translate(${tx}, ${ty})`,
      class: "domino-tile",
      "data-index": i + 1,
    });
    g.appendChild(
      svgEl("rect", {
        x: 0, y: 0,
        width: tileWidth, height: tileHeight,
        rx: 6,
        fill: "#2a2a3e",
        stroke: "#555",
        "stroke-width": 1.5,
      })
    );
    // Divider
    g.appendChild(
      svgEl("line", {
        x1: tileWidth / 2, y1: 2,
        x2: tileWidth / 2, y2: tileHeight - 2,
        stroke: "#555",
        "stroke-width": 1,
      })
    );
    drawPips(g, tileWidth / 4, tileHeight / 2, d[0], tileHeight, "#aaa");
    drawPips(g, (tileWidth * 3) / 4, tileHeight / 2, d[1], tileHeight, "#aaa");

    // Index label
    const idxText = svgEl("text", {
      x: tileWidth / 2,
      y: -2,
      "text-anchor": "middle",
      fill: "#888",
      "font-size": "9",
      "font-family": "monospace",
    });
    idxText.textContent = `#${i + 1}`;
    g.appendChild(idxText);

    tilesSvg.appendChild(g);
  });

  tilesDiv.appendChild(tilesSvg);
  container.appendChild(tilesDiv);

  // Solution colors (one per domino)
  const DOMINO_COLORS = [
    "#4e79a7", "#f28e2b", "#e15759", "#76b7b2",
    "#59a14f", "#edc948", "#b07aa1", "#ff9da7",
    "#9c755f", "#bab0ac", "#d4a6c8", "#86bcb6",
    "#8cd17d", "#d7b5a6", "#a0cbe8", "#ffbe7d",
  ];

  return {
    /**
     * Display solution on the grid.
     * @param {Array} steps - Solution steps from TLC parser
     */
    showSolution(steps) {
      solutionGroup.innerHTML = "";

      for (const step of steps) {
        const color = DOMINO_COLORS[(step.dominoIndex - 1) % DOMINO_COLORS.length];
        const c1 = cellElements.get(`${step.cell1[0]},${step.cell1[1]}`);
        const c2 = cellElements.get(`${step.cell2[0]},${step.cell2[1]}`);
        if (!c1 || !c2) continue;

        // Draw filled cells
        for (const [cell, val] of [
          [c1, step.value1],
          [c2, step.value2],
        ]) {
          solutionGroup.appendChild(
            svgEl("rect", {
              x: cell.x,
              y: cell.y,
              width: INNER,
              height: INNER,
              rx: 4,
              fill: color,
              opacity: 0.8,
            })
          );
          drawPips(
            solutionGroup,
            cell.x + INNER / 2,
            cell.y + INNER / 2,
            val,
            INNER,
            "#fff"
          );
        }

        // Draw connecting line between the two cells of a domino
        const midX1 = c1.x + INNER / 2;
        const midY1 = c1.y + INNER / 2;
        const midX2 = c2.x + INNER / 2;
        const midY2 = c2.y + INNER / 2;
        solutionGroup.appendChild(
          svgEl("line", {
            x1: midX1, y1: midY1,
            x2: midX2, y2: midY2,
            stroke: color,
            "stroke-width": 3,
            opacity: 0.5,
          })
        );

        // Mark domino tile as used
        const tileEl = tilesSvg.querySelector(`[data-index="${step.dominoIndex}"]`);
        if (tileEl) {
          tileEl.style.opacity = "0.3";
        }
      }
    },

    /**
     * Clear solution overlay.
     */
    clearSolution() {
      solutionGroup.innerHTML = "";
      tilesSvg.querySelectorAll(".domino-tile").forEach((el) => {
        el.style.opacity = "1";
      });
    },
  };
}
