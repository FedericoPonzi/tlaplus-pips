---- MODULE hard ----
EXTENDS Integers, Sequences, FiniteSets

\* Auto-generated puzzle data from NYT PIPS API.

DominoValues == <<
    <<3, 0>>,
    <<5, 5>>,
    <<4, 1>>,
    <<2, 3>>,
    <<1, 6>>,
    <<4, 4>>,
    <<5, 0>>,
    <<3, 1>>,
    <<2, 0>>,
    <<6, 5>>,
    <<2, 2>>,
    <<5, 4>>,
    <<6, 2>>,
    <<1, 5>>,
    <<6, 0>>
>>

GridCells == {
    <<0,3>>, <<0,5>>, <<1,3>>, <<1,5>>, <<2,3>>,
    <<2,4>>, <<2,5>>, <<2,6>>, <<2,7>>, <<3,5>>,
    <<3,6>>, <<3,7>>, <<4,0>>, <<4,1>>, <<4,2>>,
    <<4,3>>, <<4,4>>, <<4,5>>, <<5,0>>, <<5,2>>,
    <<5,3>>, <<5,4>>, <<5,5>>, <<6,0>>, <<6,2>>,
    <<6,5>>, <<7,2>>, <<7,5>>, <<8,2>>, <<8,5>>
}

Regions == <<
    [cells |-> {<<0,3>>}, type |-> "sum", target |-> 2],
    [cells |-> {<<0,5>>, <<1,5>>}, type |-> "equals", target |-> 0],
    [cells |-> {<<1,3>>, <<2,3>>}, type |-> "equals", target |-> 0],
    [cells |-> {<<2,4>>, <<2,5>>, <<3,5>>}, type |-> "sum", target |-> 8],
    [cells |-> {<<2,6>>, <<2,7>>}, type |-> "sum", target |-> 8],
    [cells |-> {<<3,6>>, <<3,7>>}, type |-> "sum", target |-> 6],
    [cells |-> {<<4,0>>, <<5,0>>, <<6,0>>}, type |-> "sum", target |-> 15],
    [cells |-> {<<4,1>>}, type |-> "sum", target |-> 1],
    [cells |-> {<<4,2>>, <<5,2>>, <<5,3>>}, type |-> "sum", target |-> 1],
    [cells |-> {<<4,3>>, <<4,4>>}, type |-> "equals", target |-> 0],
    [cells |-> {<<4,5>>, <<5,4>>, <<5,5>>, <<6,5>>}, type |-> "equals", target |-> 0],
    [cells |-> {<<6,2>>, <<7,2>>}, type |-> "sum", target |-> 9],
    [cells |-> {<<7,5>>}, type |-> "sum", target |-> 2],
    [cells |-> {<<8,2>>}, type |-> "greater", target |-> 4],
    [cells |-> {<<8,5>>}, type |-> "greater", target |-> 0]
>>

VARIABLES grid, usedDominoes, usedFaces

INSTANCE Pips

====
