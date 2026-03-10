# PIPS Solver

[![Verify TLC](../../actions/workflows/verify.yml/badge.svg)](../../actions/workflows/verify.yml)
[![Deploy](../../actions/workflows/deploy.yml/badge.svg)](../../actions/workflows/deploy.yml)

Solves the [NYT PIPS](https://www.nytimes.com/puzzles/pips) daily puzzle using [TLA+](https://lamport.azurewebsites.net/tla/tla.html) model checking — entirely in the browser, no backend required.

The app generates a TLA+ specification that models domino placement as a state machine, then runs the [TLC](https://lamport.azurewebsites.net/tla/tools.html) model checker via [CheerpJ](https://cheerpj.com/) (Java→WebAssembly) to find solutions by invariant violation.

## How it works

1. **Fetches** today's puzzle from the NYT PIPS API (easy / medium / hard)
2. **Generates** a TLA+ spec with the puzzle constraints embedded
3. **Runs TLC** in your browser via CheerpJ — no server, no installs
4. **Parses** the counterexample trace and renders the solution on the grid

The spec uses a **cell-sweep approach**: always fill the smallest empty cell first, pruning isolated cells early. This keeps the hard puzzle (~30 cells, 16 dominoes) solvable in under 2 minutes.

## Run locally

```bash
# Web app (Next.js)
cd web
npm install
npm run dev        # → http://localhost:3000

# Verify TLA+ specs with TLC (requires Java)
pip install requests
python scripts/generate_specs.py 2026-03-09
java -jar tla2tools.jar -config puzzles/2026-03-09/Pips.cfg -deadlock puzzles/2026-03-09/easy.tla
```

## Project structure

```
spec/               Reference TLA+ spec and config
scripts/            Python spec generator (fetches API → .tla files)
web/                Next.js frontend
  lib/              Spec generator, TLC parser, CheerpJ bridge, SVG renderer
  pages/            React page (fetches puzzle at build time)
  public/           CheerpJ worker iframe
puzzles/            Generated & verified puzzle specs
.github/workflows/  CI: verify TLC + deploy to GitHub Pages
```

## Deploy

Push to `main` → GitHub Actions builds the CheerpJ JAR, generates a static site with today's puzzle pre-embedded, and deploys to GitHub Pages.
