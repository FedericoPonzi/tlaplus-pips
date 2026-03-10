---- MODULE Pips ----
EXTENDS Integers, Sequences, FiniteSets

CONSTANTS DominoValues, GridCells, Regions

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
