---- MODULE Pips ----
EXTENDS Integers, Sequences, FiniteSets

\*
\* PIPS Puzzle Solver — auto-generated from NYT PIPS API.
\* TLC finds a counterexample to NotSolved = the puzzle solution.
\*
\* Cell-sweep approach: always fills the lexicographically smallest
\* empty cell first, choosing which domino and neighbor to pair with.
\* This gives deterministic cell ordering and enables early pruning.
\*

\* ===== PUZZLE DATA (example: 2026-03-09 easy) =====

DominoValues == <<
    <<3, 0>>,
    <<3, 4>>,
    <<2, 0>>,
    <<3, 5>>,
    <<6, 1>>
>>

GridCells == {
    <<0,1>>, <<0,2>>,
    <<1,0>>, <<1,1>>, <<1,2>>, <<1,4>>,
    <<2,0>>, <<2,1>>, <<2,2>>, <<2,4>>
}

Regions == <<
    [cells |-> {<<0,1>>, <<0,2>>}, type |-> "sum", target |-> 7],
    [cells |-> {<<1,1>>, <<2,0>>, <<2,1>>}, type |-> "equals", target |-> 0],
    [cells |-> {<<1,2>>, <<2,2>>}, type |-> "equals", target |-> 0],
    [cells |-> {<<1,4>>}, type |-> "greater", target |-> 4]
>>

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

\* Prune states where partially-covered regions already violate constraints,
\* or where an empty cell has no empty neighbor (can never be covered).
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
\* Violated when all dominoes placed AND all constraints met = solution found.

NotSolved ==
    \/ EmptyCells /= {}
    \/ ~AllConstraintsMet

====
