# PIPS Solver

[![Verify TLC](https://github.com/FedericoPonzi/tlaplus-pips/actions/workflows/verify.yml/badge.svg)](https://github.com/FedericoPonzi/tlaplus-pips/actions/workflows/verify.yml)
[![Deploy](https://github.com/FedericoPonzi/tlaplus-pips/actions/workflows/deploy.yml/badge.svg)](https://github.com/FedericoPonzi/tlaplus-pips/actions/workflows/deploy.yml)

[GitHub Repository](https://github.com/FedericoPonzi/tlaplus-pips)

A TLA+ solver for the [NYT PIPS](https://www.nytimes.com/puzzles/pips) daily puzzle using [TLA+](https://lamport.azurewebsites.net/tla/tla.html).

The app generates a TLA+ specification that models domino placement as a state machine, then runs the [TLC](https://lamport.azurewebsites.net/tla/tools.html) model checker via [CheerpJ](https://cheerpj.com/) (Java→WebAssembly) to find solutions by invariant violation.

Speaking about the hard puzzle: while running TLC locally should find the solution in about 20 seconds, it can take around 300s (~5mins) in the browser, depending on the complexity of the daily puzzle. 

## How it works

1. **Fetches** today's puzzle from the NYT PIPS API (easy / medium / hard)
2. **Generates** a TLA+ spec with the puzzle constraints embedded
3. **Runs TLC** in your browser via CheerpJ — no server, no installs
4. **Parses** the counterexample trace and renders the solution on the grid

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
