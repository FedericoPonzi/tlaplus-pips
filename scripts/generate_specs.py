#!/usr/bin/env python3
"""Generate TLA+ specs for PIPS puzzles from the NYT API."""

import json
import os
import sys
import urllib.request

API_URL = "https://www.nytimes.com/svc/pips/v1/{date}.json"

CORE_LOGIC = r"""
\* ===== DERIVED CONSTANTS =====

NumDominoes == Len(DominoValues)
NumRegions == Len(Regions)

\* ===== VARIABLES =====

VARIABLES grid, usedDominoes

vars == <<grid, usedDominoes>>

\* ===== HELPERS =====

CellLT(a, b) ==
    \/ a[1] < b[1]
    \/ (a[1] = b[1] /\ a[2] < b[2])

Adjacent(c1, c2) ==
    \/ (c1[1] = c2[1] /\ c1[2] = c2[2] + 1)
    \/ (c1[1] = c2[1] /\ c1[2] = c2[2] - 1)
    \/ (c1[2] = c2[2] /\ c1[1] = c2[1] + 1)
    \/ (c1[2] = c2[2] /\ c1[1] = c2[1] - 1)

EmptyCells == {c \in GridCells : grid[c] = -1}

NextEmptyCell ==
    CHOOSE c \in EmptyCells :
        \A c2 \in EmptyCells : c = c2 \/ CellLT(c, c2)

RECURSIVE SetSum(_)
SetSum(S) ==
    IF S = {} THEN 0
    ELSE LET x == CHOOSE x \in S : TRUE
         IN grid[x] + SetSum(S \ {x})

\* ===== CONSTRAINT CHECKING =====

CheckRegion(i) ==
    LET r == Regions[i] IN
    CASE r.type = "sum"     -> SetSum(r.cells) = r.target
      [] r.type = "equals"  -> LET v == grid[CHOOSE c \in r.cells : TRUE]
                                IN \A c \in r.cells : grid[c] = v
      [] r.type = "greater" -> LET c == CHOOSE c \in r.cells : TRUE
                                IN grid[c] > r.target
      [] OTHER              -> TRUE

AllConstraintsMet ==
    \A i \in 1..NumRegions : CheckRegion(i)

PartialConstraintsOk ==
    /\ \A c \in EmptyCells :
        \E c2 \in GridCells : Adjacent(c, c2) /\ grid[c2] = -1
    /\ \A i \in 1..NumRegions :
        LET r == Regions[i] IN
        LET covered == {c \in r.cells : grid[c] /= -1} IN
        IF covered = {} THEN TRUE
        ELSE
            CASE r.type = "sum" ->
                IF covered = r.cells
                THEN SetSum(r.cells) = r.target
                ELSE SetSum(covered) <= r.target
              [] r.type = "equals" ->
                LET v == grid[CHOOSE c \in covered : TRUE]
                IN \A c \in covered : grid[c] = v
              [] r.type = "greater" ->
                IF covered = r.cells
                THEN LET c == CHOOSE c \in r.cells : TRUE
                     IN grid[c] > r.target
                ELSE TRUE
              [] OTHER -> TRUE

\* ===== STATE MACHINE =====

Init ==
    /\ grid = [c \in GridCells |-> -1]
    /\ usedDominoes = {}

Next ==
    /\ EmptyCells /= {}
    /\ LET cell == NextEmptyCell IN
       \E d \in (1..NumDominoes) \ usedDominoes :
           \E nbr \in GridCells :
               /\ Adjacent(cell, nbr)
               /\ grid[nbr] = -1
               /\ LET a == DominoValues[d][1]
                      b == DominoValues[d][2]
                  IN \/ grid' = [grid EXCEPT ![cell] = a, ![nbr] = b]
                     \/ (a /= b /\ grid' = [grid EXCEPT ![cell] = b, ![nbr] = a])
               /\ usedDominoes' = usedDominoes \cup {d}

\* ===== INVARIANT =====

NotSolved ==
    \/ EmptyCells /= {}
    \/ ~AllConstraintsMet

====
"""


def fetch_puzzle(puzzle_date):
    """Fetch puzzle data from NYT API."""
    url = API_URL.format(date=puzzle_date)
    req = urllib.request.Request(url, headers={"User-Agent": "pips-solver/1.0"})
    with urllib.request.urlopen(req) as response:
        return json.loads(response.read())


def fmt_cell(cell):
    """Format a cell as TLA+ tuple."""
    return f"<<{cell[0]},{cell[1]}>>"


def fmt_cell_set(cells):
    """Format a set of cells as TLA+ set literal."""
    return "{" + ", ".join(fmt_cell(c) for c in sorted(cells, key=lambda c: (c[0], c[1]))) + "}"


def generate_spec(difficulty_data, module_name="Pips"):
    """Generate a complete TLA+ spec for a puzzle difficulty."""
    dominoes = difficulty_data["dominoes"]
    regions = difficulty_data["regions"]

    # Grid cells = union of all region cells
    grid_cells = set()
    for region in regions:
        for cell in region["indices"]:
            grid_cells.add(tuple(cell))
    grid_cells = sorted(grid_cells)

    # Only keep regions with actual constraints
    constraint_regions = [r for r in regions if r["type"] != "empty"]

    # Build puzzle data section
    lines = []
    lines.append(f"---- MODULE {module_name} ----")
    lines.append("EXTENDS Integers, Sequences, FiniteSets")
    lines.append("")
    lines.append(r"\* Auto-generated from NYT PIPS API.")
    lines.append("")

    # Domino values
    lines.append("DominoValues == <<")
    for i, d in enumerate(dominoes):
        comma = "," if i < len(dominoes) - 1 else ""
        lines.append(f"    <<{d[0]}, {d[1]}>>{comma}")
    lines.append(">>")
    lines.append("")

    # Grid cells
    lines.append("GridCells == {")
    cell_strs = [fmt_cell(c) for c in grid_cells]
    # Print 5 per line for readability
    for i in range(0, len(cell_strs), 5):
        chunk = cell_strs[i : i + 5]
        line = "    " + ", ".join(chunk)
        if i + 5 < len(cell_strs):
            line += ","
        lines.append(line)
    lines.append("}")
    lines.append("")

    # Regions
    lines.append("Regions == <<")
    for i, r in enumerate(constraint_regions):
        cells_str = fmt_cell_set(r["indices"])
        rtype = r["type"]
        target = r.get("target", 0)
        comma = "," if i < len(constraint_regions) - 1 else ""
        lines.append(
            f'    [cells |-> {cells_str}, type |-> "{rtype}", target |-> {target}]{comma}'
        )
    lines.append(">>")

    puzzle_data = "\n".join(lines)
    return puzzle_data + "\n" + CORE_LOGIC


def generate_cfg():
    """Generate the shared TLC config file."""
    return "INIT Init\nNEXT Next\nINVARIANT NotSolved\nCONSTRAINT PartialConstraintsOk\n"


def main():
    if len(sys.argv) < 2:
        print("Usage: generate_specs.py <date> [output_dir]")
        print("  date: YYYY-MM-DD format")
        print("  output_dir: directory for generated files (default: puzzles/<date>)")
        sys.exit(1)

    puzzle_date = sys.argv[1]
    output_dir = sys.argv[2] if len(sys.argv) > 2 else f"puzzles/{puzzle_date}"
    os.makedirs(output_dir, exist_ok=True)

    # Allow reading from local JSON file (for CI without network)
    json_path = os.path.join(output_dir, "puzzle.json")
    if os.path.exists(json_path):
        print(f"Reading puzzle from {json_path}")
        with open(json_path) as f:
            data = json.load(f)
    else:
        print(f"Fetching puzzle for {puzzle_date}...")
        data = fetch_puzzle(puzzle_date)
        # Cache the JSON
        with open(json_path, "w") as f:
            json.dump(data, f, indent=2)
        print(f"Cached puzzle data to {json_path}")

    # Generate spec for each difficulty
    for difficulty in ["easy", "medium", "hard"]:
        if difficulty not in data:
            print(f"Warning: {difficulty} not found in puzzle data, skipping")
            continue
        spec = generate_spec(data[difficulty], module_name=difficulty)
        spec_path = os.path.join(output_dir, f"{difficulty}.tla")
        with open(spec_path, "w") as f:
            f.write(spec)
        n_dominoes = len(data[difficulty]["dominoes"])
        n_regions = len([r for r in data[difficulty]["regions"] if r["type"] != "empty"])
        print(f"Generated {spec_path} ({n_dominoes} dominoes, {n_regions} constraint regions)")

    # Generate shared cfg
    cfg_path = os.path.join(output_dir, "Pips.cfg")
    with open(cfg_path, "w") as f:
        f.write(generate_cfg())
    print(f"Generated {cfg_path}")


if __name__ == "__main__":
    main()
