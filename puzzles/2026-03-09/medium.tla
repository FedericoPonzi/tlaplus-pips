---- MODULE medium ----
EXTENDS Integers, Sequences, FiniteSets

\* Auto-generated puzzle data from NYT PIPS API.

DominoValues == <<
    <<1, 1>>,
    <<2, 4>>,
    <<5, 1>>,
    <<3, 0>>,
    <<6, 1>>,
    <<3, 6>>,
    <<4, 1>>
>>

GridCells == {
    <<0,0>>, <<0,1>>, <<0,2>>, <<0,3>>, <<0,4>>,
    <<0,5>>, <<0,6>>, <<0,7>>, <<1,2>>, <<1,3>>,
    <<1,4>>, <<1,5>>, <<2,2>>, <<2,5>>
}

Regions == <<
    [cells |-> {<<0,0>>}, type |-> "greater", target |-> 4],
    [cells |-> {<<0,1>>, <<0,2>>}, type |-> "equals", target |-> 0],
    [cells |-> {<<0,3>>, <<1,3>>}, type |-> "equals", target |-> 0],
    [cells |-> {<<0,5>>, <<0,6>>, <<0,7>>}, type |-> "equals", target |-> 0],
    [cells |-> {<<1,2>>, <<2,2>>}, type |-> "sum", target |-> 6],
    [cells |-> {<<1,4>>, <<1,5>>}, type |-> "sum", target |-> 6]
>>

VARIABLES grid, usedDominoes

INSTANCE Pips

====
