---- MODULE easy ----
EXTENDS Integers, Sequences, FiniteSets

\* Auto-generated puzzle data from NYT PIPS API.

DominoValues == <<
    <<3, 0>>,
    <<3, 4>>,
    <<2, 0>>,
    <<3, 5>>,
    <<6, 1>>
>>

GridCells == {
    <<0,1>>, <<0,2>>, <<1,0>>, <<1,1>>, <<1,2>>,
    <<1,4>>, <<2,0>>, <<2,1>>, <<2,2>>, <<2,4>>
}

Regions == <<
    [cells |-> {<<0,1>>, <<0,2>>}, type |-> "sum", target |-> 7],
    [cells |-> {<<1,1>>, <<2,0>>, <<2,1>>}, type |-> "equals", target |-> 0],
    [cells |-> {<<1,2>>, <<2,2>>}, type |-> "equals", target |-> 0],
    [cells |-> {<<1,4>>}, type |-> "greater", target |-> 4]
>>

VARIABLES grid, usedDominoes

INSTANCE Pips

====
