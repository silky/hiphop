"use hiphop"
"use hopscript"

var hh = require( "hiphop" );

function foo( evt ) {
   console.log( "foo called by", evt.signalName, "with value", evt.signalValue );
}

hiphop module prg( in I, out O ) {
   await now( I );
   emit O( nowval( I ) );
}

var m = new hh.ReactiveMachine( prg, "awaitvalued" );
m.addEventListener( "O", foo );

exports.prg = m;