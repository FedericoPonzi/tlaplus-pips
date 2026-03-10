#!/usr/bin/env python3
"""Generate TLA+ specs for PIPS puzzles from the NYT API."""

import json
import os
import sys
import urllib.request

API_URL = "https://www.nytimes.com/svc/pips/v1/{date}.json"

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(SCRIPT_DIR)
SPEC_DIR = os.path.join(REPO_ROOT, "spec")


def read_pips_spec():
    """Read the core Pips.tla spec from the spec/ folder."""
    path = os.path.join(SPEC_DIR, "Pips.tla")
    with open(path) as f:
        return f.read()


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


def generate_data_spec(difficulty_data, module_name="hard"):
    """Generate a data-only TLA+ spec that INSTANCEs Pips."""
    dominoes = difficulty_data["dominoes"]
    regions = difficulty_data["regions"]

    grid_cells = set()
    for region in regions:
        for cell in region["indices"]:
            grid_cells.add(tuple(cell))
    grid_cells = sorted(grid_cells)

    constraint_regions = [r for r in regions if r["type"] != "empty"]

    lines = []
    lines.append(f"---- MODULE {module_name} ----")
    lines.append("EXTENDS Integers, Sequences, FiniteSets")
    lines.append("")
    lines.append(r"\* Auto-generated puzzle data from NYT PIPS API.")
    lines.append("")

    lines.append("DominoValues == <<")
    for i, d in enumerate(dominoes):
        comma = "," if i < len(dominoes) - 1 else ""
        lines.append(f"    <<{d[0]}, {d[1]}>>{comma}")
    lines.append(">>")
    lines.append("")

    lines.append("GridCells == {")
    cell_strs = [fmt_cell(c) for c in grid_cells]
    for i in range(0, len(cell_strs), 5):
        chunk = cell_strs[i : i + 5]
        line = "    " + ", ".join(chunk)
        if i + 5 < len(cell_strs):
            line += ","
        lines.append(line)
    lines.append("}")
    lines.append("")

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
    lines.append("")
    lines.append("VARIABLES grid, usedDominoes, usedFaces")
    lines.append("")
    lines.append("INSTANCE Pips")
    lines.append("")
    lines.append("====")
    lines.append("")

    return "\n".join(lines)


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
        with open(json_path, "w") as f:
            json.dump(data, f, indent=2)
        print(f"Cached puzzle data to {json_path}")

    # Copy Pips.tla from spec/ folder
    pips_spec = read_pips_spec()
    pips_path = os.path.join(output_dir, "Pips.tla")
    with open(pips_path, "w") as f:
        f.write(pips_spec)
    print(f"Copied {pips_path} from spec/Pips.tla")

    # Generate data spec for each difficulty (INSTANCE Pips)
    for difficulty in ["easy", "medium", "hard"]:
        if difficulty not in data:
            print(f"Warning: {difficulty} not found in puzzle data, skipping")
            continue
        spec = generate_data_spec(data[difficulty], module_name=difficulty)
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
