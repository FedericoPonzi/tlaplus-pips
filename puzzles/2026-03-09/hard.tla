---- MODULE hard ----
EXTENDS Integers, Sequences, FiniteSets

\* Auto-generated from NYT PIPS API.

DominoValues == <<
    <<0, 3>>,
    <<6, 6>>,
    <<3, 1>>,
    <<4, 4>>,
    <<0, 2>>,
    <<4, 5>>,
    <<2, 3>>,
    <<0, 6>>,
    <<3, 5>>,
    <<4, 1>>,
    <<5, 6>>,
    <<4, 3>>,
    <<5, 5>>,
    <<1, 1>>,
    <<3, 3>>,
    <<0, 1>>
>>

GridCells == {
    <<0,7>>, <<0,8>>, <<1,0>>, <<1,1>>, <<1,2>>,
    <<1,3>>, <<1,4>>, <<1,5>>, <<1,6>>, <<1,7>>,
    <<1,8>>, <<2,0>>, <<2,1>>, <<2,2>>, <<2,3>>,
    <<2,4>>, <<2,5>>, <<2,6>>, <<2,7>>, <<2,8>>,
    <<3,1>>, <<3,2>>, <<3,3>>, <<3,4>>, <<3,5>>,
    <<4,1>>, <<4,2>>, <<4,5>>, <<5,2>>, <<5,3>>,
    <<5,5>>, <<5,6>>
}

Regions == <<
    [cells |-> {<<0,7>>}, type |-> "sum", target |-> 6],
    [cells |-> {<<0,8>>, <<1,8>>, <<2,8>>}, type |-> "equals", target |-> 0],
    [cells |-> {<<1,0>>}, type |-> "sum", target |-> 4],
    [cells |-> {<<1,1>>, <<1,2>>}, type |-> "equals", target |-> 0],
    [cells |-> {<<1,3>>, <<1,4>>, <<1,5>>, <<2,3>>, <<2,4>>, <<2,5>>, <<3,4>>}, type |-> "equals", target |-> 0],
    [cells |-> {<<1,7>>, <<2,6>>, <<2,7>>}, type |-> "equals", target |-> 0],
    [cells |-> {<<2,0>>, <<2,1>>, <<2,2>>, <<3,1>>, <<4,1>>}, type |-> "equals", target |-> 0],
    [cells |-> {<<3,2>>, <<3,3>>}, type |-> "equals", target |-> 0],
    [cells |-> {<<4,5>>, <<5,5>>, <<5,6>>}, type |-> "sum", target |-> 18],
    [cells |-> {<<5,2>>, <<5,3>>}, type |-> "equals", target |-> 0]
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
