/*=====================================================================*/
/*    serrano/prgm/project/hiphop/hiphop/preprocessor/astparser.js     */
/*    -------------------------------------------------------------    */
/*    Author      :  Manuel Serrano                                    */
/*    Creation    :  Tue Jul 17 17:53:13 2018                          */
/*    Last change :  Fri Sep 14 07:54:56 2018 (serrano)                */
/*    Copyright   :  2018 Manuel Serrano                               */
/*    -------------------------------------------------------------    */
/*    HipHop parser based on the genuine Hop parser                    */
/*=====================================================================*/
"use hopscript"

const hopc = require( hop.hopc );
const ast = require( hopc.ast );
const astutils = require( "./astutils.js" );
const error = require( "../lib/error.js" );
const parser = new hopc.Parser();

const hhname = "__hh_module";
const hhmodule = "hiphop";

/*---------------------------------------------------------------------*/
/*    location ...                                                     */
/*---------------------------------------------------------------------*/
function location( loc ) {
   return astutils.J2SObjInit(
      loc,
      [ astutils.J2SDataPropertyInit(
	 loc,
	 astutils.J2SString( loc, "filename" ),
	 astutils.J2SString( loc, loc.cdr.car ) ),
	astutils.J2SDataPropertyInit(
	   loc,
	   astutils.J2SString( loc, "pos" ),
	   astutils.J2SNumber( loc, loc.cdr.cdr.car ) ) ] );
}

/*---------------------------------------------------------------------*/
/*    locInit ...                                                      */
/*---------------------------------------------------------------------*/
function locInit( loc ) {
   return astutils.J2SDataPropertyInit(
      loc,
      astutils.J2SString( loc, "%location" ),
      location( loc ) );
}

/*---------------------------------------------------------------------*/
/*    tokenLocation ...                                                */
/*---------------------------------------------------------------------*/
function tokenLocation( token ) {
   return { filename: token.filename, pos: token.pos };
}

/*---------------------------------------------------------------------*/
/*    tokenValueError ...                                              */
/*---------------------------------------------------------------------*/
function tokenValueError( token ) {
   return error.SyntaxError( "unexpected token `" + token.value + "'",
			     tokenLocation( token ) );
}


/*---------------------------------------------------------------------*/
/*    tokenTypeError ...                                               */
/*---------------------------------------------------------------------*/
function tokenTypeError( token ) {
   return error.SyntaxError( "unexpected token `" + token.type + "'",
			     tokenLocation( token ) );
}

/*---------------------------------------------------------------------*/
/*    isIdToken ...                                                    */
/*---------------------------------------------------------------------*/
function isIdToken( parser, token, id ) {
   return token.type === parser.ID && token.value == id;
}

/*---------------------------------------------------------------------*/
/*    hhref ...                                                        */
/*---------------------------------------------------------------------*/
function hhref( loc, name ) {
   return astutils.J2SAccess(
      loc,
      astutils.J2SRef( loc, hhname ),
      astutils.J2SString( loc, name ) );
}

/*---------------------------------------------------------------------*/
/*    hhwrapDecl ...                                                   */
/*    -------------------------------------------------------------    */
/*    Generate:                                                        */
/*      STMT -> __hh_module = require( "hiphop" ); STMT                */
/*---------------------------------------------------------------------*/
function hhwrapDecl( token, stmt ) {
   const loc = token.location;
   const req = astutils.J2SCall( loc, astutils.J2SRef( loc, "require" ),
				 [ astutils.J2SUndefined( loc ) ],
				 [ astutils.J2SString( loc, hhmodule ) ] );
   const decl = astutils.J2SDeclInit( loc, hhname, req, "var" );

   return astutils.J2SVarDecls( stmt.loc, [ decl ].concat( stmt.decls ) );
}

/*---------------------------------------------------------------------*/
/*    hhwrapExpr ...                                                   */
/*    -------------------------------------------------------------    */
/*    Generate:                                                        */
/*      EXPR -> ((__hh_module => EXPR)require( "hiphop" ))             */
/*---------------------------------------------------------------------*/
function hhwrapExpr( token, expr ) {
   const loc = token.location;
   const req = astutils.J2SCall( loc, astutils.J2SRef( loc, "require" ),
				 [ astutils.J2SUndefined( loc ) ],
				 [ astutils.J2SString( loc, hhmodule ) ] );
   const fun = astutils.J2SFun(
      loc, "hhwrap", [ astutils.J2SDecl( loc, hhname, "param" ) ],
      astutils.J2SBlock( loc, loc, [ astutils.J2SReturn( loc, expr ) ] ) );

   return astutils.J2SCall( loc, fun,
			    [ astutils.J2SUndefined( loc ) ],
			    [ req ] );
}
   
/*---------------------------------------------------------------------*/
/*    parseHHAccessors ...                                             */
/*    -------------------------------------------------------------    */
/*    hhexpr ::= ${ jsexpr }                                           */
/*       | jsexpr                                                      */
/*       | now( ident )                                                */
/*       | pre( ident )                                                */
/*       | nowval( ident )                                             */
/*       | preval( ident )                                             */
/*---------------------------------------------------------------------*/
function parseHHAccessors( parser, iscnt = false ) {
   
   let accessors = [];

   const hhparser = function( token ) {
      const loc = token.location
      let pre = false, val = false, access = "present";
      
      this.consumeToken( this.LPAREN );
      
      const tid = this.consumeToken( this.ID );
      const locid = tid.location;
      
      this.consumeToken( this.RPAREN );

      switch( token.value ) {
	 case "now": break;
	 case "pre": pre = true; access = "prePresent"; break;
	 case "nowval": val = true; access = "value"; break;
	 case "preval": pre = true, val = true; access = "preValue"; break;
      }

      const signame = astutils.J2SDataPropertyInit(
	 locid,
	 astutils.J2SString( locid, "signame" ),
	 astutils.J2SString( locid,  tid.value ) );
      const sigpre = astutils.J2SDataPropertyInit(
	 locid,
	 astutils.J2SString( locid, "pre" ),
	 astutils.J2SBool( locid, pre ) );
      const sigval = astutils.J2SDataPropertyInit(
	 locid,
	 astutils.J2SString( locid, "val" ),
	 astutils.J2SBool( locid, val ) );
      const sigcnt = astutils.J2SDataPropertyInit(
	 locid,
	 astutils.J2SString( locid, "cnt" ),
	 astutils.J2SBool( locid, iscnt ) );

      const attrs =
	    astutils.J2SObjInit( loc, [ signame, sigpre, sigval, sigcnt ] );
      const sigaccess = astutils.J2SCall(
	 loc, hhref( loc, "SIGACCESS" ), null, [ attrs ] );

      // push the accessor dependencies list
      accessors.push( sigaccess );

      // return the actual expression
      return astutils.J2SAccess(
	 locid,
	 astutils.J2SAccess( locid,
			     astutils.J2SHopRef( loc, "this" ),
			     astutils.J2SString( loc, access ) ),
	 astutils.J2SString( locid, tid.value ) );
   }
   
   this.addPlugin( "now", hhparser );
   this.addPlugin( "pre", hhparser );
   this.addPlugin( "nowval", hhparser );
   this.addPlugin( "preval", hhparser );
   try {
      return parser.call( this, accessors );
   } finally {
      this.removePlugin( "preval" );
      this.removePlugin( "nowval" );
      this.removePlugin( "pre" );
      this.removePlugin( "now" );
   }
}

/*---------------------------------------------------------------------*/
/*    parseHHThisBlock ...                                             */
/*    -------------------------------------------------------------    */
/*    Parse JS block with augmented expression as in parseHHAccessors. */
/*---------------------------------------------------------------------*/
function parseHHThisBlock() {
   
   let accessors = [];

   const hhparser = function( token ) {
      const loc = token.location
      let pre = false, val = false, access = "present";
      
      this.consumeToken( this.LPAREN );
      
      const tid = this.consumeToken( this.ID );
      const locid = tid.location;
      
      this.consumeToken( this.RPAREN );

      switch( token.value ) {
	 case "now": break;
	 case "pre": pre = true; access = "prePresent"; break;
	 case "nowval": val = true; access = "value"; break;
	 case "preval": pre = true, val = true; access = "preValue"; break;
      }

      const signame = astutils.J2SDataPropertyInit(
	 locid,
	 astutils.J2SString( locid, "signame" ),
	 astutils.J2SString( locid,  tid.value ) );
      const sigpre = astutils.J2SDataPropertyInit(
	 locid,
	 astutils.J2SString( locid, "pre" ),
	 astutils.J2SBool( locid, pre ) );
      const sigval = astutils.J2SDataPropertyInit(
	 locid,
	 astutils.J2SString( locid, "val" ),
	 astutils.J2SBool( locid, val ) );

      const attrs =
	    astutils.J2SObjInit( loc, [ signame, sigpre, sigval ] );
      const sigaccess = astutils.J2SCall(
	 loc, hhref( loc, "SIGACCESS" ), null, [ attrs ] );

      // push the accessor dependencies list
      accessors.push( sigaccess );

      // return the actual expression
      return astutils.J2SAccess(
	 locid,
	 astutils.J2SAccess( locid,
			     astutils.J2SHopRef( loc, "this" ),
			     astutils.J2SString( loc, access ) ),
	 astutils.J2SString( locid, tid.value ) );
   }
   
   this.addPlugin( "now", hhparser );
   this.addPlugin( "pre", hhparser );
   this.addPlugin( "nowval", hhparser );
   this.addPlugin( "preval", hhparser );
   try {
      const { self, block } = this.parseThisBlock();
      return { self: self, block: block, accessors: accessors };
   } finally {
      this.removePlugin( "preval" );
      this.removePlugin( "nowval" );
      this.removePlugin( "pre" );
      this.removePlugin( "now" );
   }
}

/*---------------------------------------------------------------------*/
/*    parseHHExpression ...                                            */
/*---------------------------------------------------------------------*/
function parseHHExpression() {
   return parseHHAccessors.call( this, accessors => {
      if( this.peekToken().type === this.DOLLAR ) {
	 const expr = this.parseDollarExpression();
	 return { expr: expr, accessors: accessors };
      } else {
	 const expr = this.parseCondExpression();
	 return { expr: expr, accessors: accessors };
      }
   } );
}

/*---------------------------------------------------------------------*/
/*    parseHHCondExpression ...                                        */
/*---------------------------------------------------------------------*/
function parseHHCondExpression( iscnt ) {
   return parseHHAccessors.call(
      this,
      accessors => {
	 if( this.peekToken().type === this.DOLLAR ) {
	    const expr = this.parseDollarExpression();
	    return { expr: expr, accessors: accessors };
	 } else {
	    const expr = this.parseCondExpression();
	    return { expr: expr, accessors: accessors };
	 }
      },
      iscnt );
}

/*---------------------------------------------------------------------*/
/*    parseValueApply ...                                              */
/*---------------------------------------------------------------------*/
function parseValueApply( loc ) {
   const { expr: expr, accessors } = parseHHExpression.call( this );
   let init;
   if( typeof expr == "J2SDollar" ) {
      init = astutils.J2SDataPropertyInit(
	 loc,
	 astutils.J2SString( loc, "value" ),
	 expr.node );
   } else {
      const fun = astutils.J2SFun(
	 loc, "iffun", [],
	 astutils.J2SBlock( loc, loc, [ astutils.J2SReturn( loc, expr ) ] ) );
      init = astutils.J2SDataPropertyInit(
	 loc,
	 astutils.J2SString( loc, "apply" ),
	 fun );
   }
   return { init: init, accessors: accessors }
}
   
/*---------------------------------------------------------------------*/
/*    parseDelay ...                                                   */
/*    -------------------------------------------------------------    */
/*    delay ::= hhexpr                                                 */
/*       | count( hhexpr, hhexpr )                                     */
/*       | immediate( hhexpr )                                         */
/*---------------------------------------------------------------------*/
function parseDelay( loc, tag, action = "apply", id = false ) {
   if( isIdToken( this, this.peekToken(), "count" ) ) {
      // COUNT( hhexpr, hhexpr )
      const loccnt = this.consumeAny();
      this.consumeToken( this.LPAREN );
      const { expr: count, accessors: cntaccessors } =
	    parseHHCondExpression.call( this, true );
      this.consumeToken( this.COMMA );
      const { expr, accessors } =
	    parseHHCondExpression.call( this, false );

      this.consumeToken( this.RPAREN );

      const fun = astutils.J2SFun(
	 loc, "delayfun", [], 
	 astutils.J2SBlock( loc, loc, [ astutils.J2SReturn( loc, expr ) ] ) );
      const cntfun = astutils.J2SFun(
	 loc, "cntfun", [], 
	 astutils.J2SBlock( loc, loc, [ astutils.J2SReturn( loc, count ) ] ) );
      
      const inits = [
	 astutils.J2SDataPropertyInit(
	    loc, astutils.J2SString( loc, "immediate" ),
	    astutils.J2SBool( loc, false ) ), 
	 astutils.J2SDataPropertyInit(
	    loc, astutils.J2SString( loc, action ),
	    fun ),
	 astutils.J2SDataPropertyInit(
	    loc, astutils.J2SString( loc, "count" + action ),
	    cntfun ) ];
      
      return { inits: inits, accessors: cntaccessors.concat( accessors ) };
   } else {
      let immediate = false;
      
      if( isIdToken( this, this.peekToken(), "immediate" ) ) {
	 // immediate( hhexpr )
	 const imm = this.consumeAny();
	 immediate = true;
	 if( isIdToken( this, this.peekToken(), "count" ) ) {
	    throw error.SyntaxError( tag + ": can't use immediate with count expression.",
				     tokenLocation( imm ) );
	 }
      }

      // hhexpr
      const { expr, accessors } = parseHHExpression.call( this );
      let inits;

      if( typeof expr == "J2SUnresolvedRef" ) {
	 inits = [
	    astutils.J2SDataPropertyInit(
	       loc, astutils.J2SString( loc, "immediate" ),
	       astutils.J2SBool( loc, immediate ) ), 
	    astutils.J2SDataPropertyInit(
	       loc, astutils.J2SString( loc, expr.id ),
	       astutils.J2SString( loc, expr.id ) ) ];
      } else {
	 const fun = astutils.J2SFun(
	    loc, "hhexprfun", [], 
	    astutils.J2SBlock( loc, loc, [ astutils.J2SReturn( loc, expr ) ] ) );
	 
	 inits = [
	    astutils.J2SDataPropertyInit(
	       loc, astutils.J2SString( loc, "immediate" ),
	       astutils.J2SBool( loc, immediate ) ), 
	    astutils.J2SDataPropertyInit(
	       loc, astutils.J2SString( loc, action ),
	       fun ) ];
      }
      return { inits: inits, accessors: accessors };
   }
}

/*---------------------------------------------------------------------*/
/*    parseHHBlock ...                                                 */
/*    -------------------------------------------------------------    */
/*    block ::= { stmt; ... }                                          */
/*---------------------------------------------------------------------*/
function parseHHBlock( consume = true ) {
   let nodes = [];

   if( consume ) this.consumeToken( this.LBRACE );

   while( true ) {
      switch( this.peekToken().type ) {
	 case this.SEMICOLON:
	    this.consumeAny();
	    break;
	    
	 case this.RBRACE: {
	    const nothing = this.consumeAny();
	    if( nodes.length == 0 ) {
	       return [ parseEmpty( nothing, "NOTHING" ) ];
	    } else {
	       return nodes;
	    }
	 }

	 case this.let:
	    nodes.push( parseLet.call( this, this.consumeAny(), "let" ) );
	    return nodes;

	 case this.const:
	    nodes.push( parseLet.call( this, this.consumeAny(), "const" ) );
	    return nodes;

	 case this.ID:
	    if( this.peekToken().value == "signal" ) {
	       nodes.push( parseSignal.call( this, this.consumeAny() ) );
	       return nodes;
	    } else {
	       nodes.push( parseStmt.call( this, this.peekToken(), false ) );
	       break;
	    }
	       
	 default:
	    nodes.push( parseStmt.call( this, this.peekToken(), false ) );
	    break;
      }
   }
}
   

/*---------------------------------------------------------------------*/
/*    parseModule ...                                                  */
/*    -------------------------------------------------------------    */
/*    stmt ::= ...                                                     */
/*       | module [ident] ( signal, ... ) block                        */
/*    signal ::= [direction] ident [combine]                           */
/*    direction ::= in | out | inout                                   */
/*    combine ::= combine expr                                         */
/*---------------------------------------------------------------------*/
function parseModule( token, declaration ) {
   
   function parseSignalModule( token ) {
      const loc = token.location;
      let name, direction;

      if( token.type === this.in ) {
	 let t = this.consumeToken( this.ID );
	 direction = "IN"
	 name = t.value;
      } else if( token.type === this.ID ) {
	 switch( token.value ) {
	    case "out": {
	       let t = this.consumeToken( this.ID );
	       direction = "OUT"
	       name = t.value;
	       break;
	    }
	    case "inout": {
	       let t = this.consumeToken( this.ID );
	       direction = "INOUT"
	       name = t.value;
	       break;
	    }
	    default: {
	       direction = "INOUT"
	       name = token.value;
	    }

	 }
      } else {
	 tokenTypeError( token )
      }
      
      const dir = astutils.J2SDataPropertyInit(
	 loc,
	 astutils.J2SString( loc, "direction" ),
	 astutils.J2SString( loc, direction ) );
      const id = astutils.J2SDataPropertyInit(
	 loc,
	 astutils.J2SString( loc, "name" ),
	 astutils.J2SString( loc, name ) );

      const inits = [ dir, id ];
      let accessors = [];
      
      if( this.peekToken().type === this.EGAL ) {
	 this.consumeAny();
	 const { expr, accessors: axs } = parseHHExpression.call( this );

	 const func = astutils.J2SFun(
	    loc, "initfunc", [],
	    astutils.J2SBlock(
	       loc, loc,
	       [ astutils.J2SReturn( loc, expr ) ] ) );
	 const initfunc = astutils.J2SDataPropertyInit(
	    loc,
	    astutils.J2SString( loc, "init_func" ),
	    func );

	 accessors = axs;
	 inits.push( initfunc );
      }
	 
      if( isIdToken( this, this.peekToken(), "combine" ) ) {
	 const locc = this.consumeAny().location;
	 const fun = this.parseCondExpression();

	 const combine = astutils.J2SDataPropertyInit(
	    loc,
	    astutils.J2SString( loc, "combine_func" ),
	    fun );
	 inits.push( combine );
      }

      const attrs = astutils.J2SObjInit( loc, inits );
      return astutils.J2SCall( loc, hhref( loc, "SIGNAL" ), null,
			       [ attrs ].concat( accessors ) );
   }

   function parseSiglist() {

      let lbrace = this.consumeToken( this.LPAREN );
      let args = [];

      while( true ) {
	 if( this.peekToken().type === this.RPAREN ) {
	    this.consumeAny();
	    return args;
	 } else {
	    args.push( parseSignalModule.call( this, this.consumeAny() ) );
	    
	    if( this.peekToken().type === this.RPAREN ) {
	       this.consumeAny();
	       return args;
	    } else {
	       this.consumeToken( this.COMMA );
	    }
	 }
      }
   }
   
   const loc = token.location;
   let id;
   let attrs;

   if( this.peekToken().type === this.ID ) {
      id = this.consumeAny();
      const locid = id.location;

      attrs = astutils.J2SObjInit(
	 locid,
	 [ astutils.J2SDataPropertyInit(
	    locid,
	    astutils.J2SString( locid, "id" ),
	    astutils.J2SString( locid, id.value ) ),
	   locInit( loc ) ] );
   } else if( declaration ) {
      tokenTypeError( this.consumeAny() );
   } else {
      attrs = astutils.J2SObjInit( loc, [ locInit( loc ) ] );
   }

   const args = parseSiglist.call( this );
   const stmts = parseHHBlock.call( this );
   const mod = astutils.J2SCall( loc, hhref( loc, "MODULE" ), 
				 null,
				 [ attrs ].concat( args, stmts ) );

   if( declaration ) {
      return astutils.J2SVarDecls(
	 loc, [ astutils.J2SDeclInit( loc, id.value, mod ) ] );
   } else {
      return mod;
   }
}

/*---------------------------------------------------------------------*/
/*    parseHop ...                                                     */
/*    -------------------------------------------------------------    */
/*    stmt ::= ...                                                     */
/*       | hop block                                                   */
/*---------------------------------------------------------------------*/
function parseAtom( token ) {
   
   function parseAtomBlock() {
      return parseHHAccessors.call( this, accessors => {
	 const block = this.parseBlock();
	 return { block: block, accessors: accessors };
      } );
   }

   const loc = token.location;
   const { block, accessors } = parseAtomBlock.call( this );
   const appl = astutils.J2SDataPropertyInit(
      loc, 
      astutils.J2SString( loc, "apply" ),
      astutils.J2SFun( loc, "atomfun", [], block ) );
   const attrs = astutils.J2SObjInit( loc, [ locInit( loc ), appl ] );
   
   return astutils.J2SCall( loc, hhref( loc, "ATOM" ), null,
			    [ attrs ].concat( accessors ) );
}

/*---------------------------------------------------------------------*/
/*    parseEmpty ...                                                   */
/*---------------------------------------------------------------------*/
function parseEmpty( token, fun ) {
   const loc = token.location;
   const attrs = astutils.J2SObjInit( loc, [ locInit( loc ) ] );
   
   return astutils.J2SCall( loc, hhref( loc, fun ), null, [ attrs ] );
}

/*---------------------------------------------------------------------*/
/*    parseNothing ...                                                 */
/*    -------------------------------------------------------------    */
/*    stmt ::= ...                                                     */
/*       | NOTHING                                                     */
/*---------------------------------------------------------------------*/
function parseNothing( token ) {
   return parseEmpty( token, "NOTHING" );
}

/*---------------------------------------------------------------------*/
/*    parsePause ...                                                   */
/*    -------------------------------------------------------------    */
/*    stmt ::= ...                                                     */
/*       | yield                                                       */
/*---------------------------------------------------------------------*/
function parsePause( token ) {
   return parseEmpty( token, "PAUSE" );
}

/*---------------------------------------------------------------------*/
/*    parseExit ...                                                    */
/*    -------------------------------------------------------------    */
/*    stmt ::= ...                                                     */
/*       | break lbl                                                   */
/*---------------------------------------------------------------------*/
function parseExit( token ) {
   const id = this.consumeToken( this.ID );
   const loc = id.location;
   const attrs = astutils.J2SObjInit(
      loc,
      [ astutils.J2SDataPropertyInit(
	 loc,
	 astutils.J2SString( loc, id.value ),
	 astutils.J2SString( loc, id.value ) ),
	locInit( loc ) ] );
   
   return astutils.J2SCall( loc, hhref( loc, "EXIT" ), null, [ attrs ] );
}

/*---------------------------------------------------------------------*/
/*    parseHalt ...                                                    */
/*    -------------------------------------------------------------    */
/*    stmt ::= ...                                                     */
/*       | exit                                                        */
/*---------------------------------------------------------------------*/
function parseHalt( token ) {
   return parseEmpty( token, "HALT" );
}

/*---------------------------------------------------------------------*/
/*    parseSequence ...                                                */
/*    -------------------------------------------------------------    */
/*    stmt ::= ...                                                     */
/*       | SEQUENCE block                                              */
/*---------------------------------------------------------------------*/
function parseSequence( token, consume ) {
   const loc = token.location;
   const attrs = astutils.J2SObjInit( loc, [ locInit( loc ) ] );
   const body = parseHHBlock.call( this, consume );

   return astutils.J2SCall( loc, hhref( loc, "SEQUENCE" ), 
			    null,
			    [ attrs ].concat( body ) );
}

/*---------------------------------------------------------------------*/
/*    parseFork ...                                                    */
/*    -------------------------------------------------------------    */
/*    stmt ::= ...                                                     */
/*       | fork ["name"] block [ par block ... ]                       */
/*---------------------------------------------------------------------*/
function parseFork( token ) {
   const loc = token.location;
   let id;
   let attrs;
   let body = [];

   if( this.peekToken().type === this.STRING ) {
      let id = this.consumeAny();
      const locid = id.location;

      attrs = astutils.J2SObjInit(
	 locid,
	 [ astutils.J2SDataPropertyInit(
	    locid,
	    astutils.J2SString( locid, "id" ),
	    astutils.J2SString( locid, id.value ) ),
	   locInit( loc ) ] );
   } else {
      attrs = astutils.J2SObjInit( loc, [ locInit( loc ) ] );
   }

   body.push( astutils.J2SCall( loc, hhref( loc, "SEQUENCE" ),
				null,
				[ astutils.J2SObjInit( loc, [ locInit( loc ) ] ) ]
				.concat( parseHHBlock.call( this ) ) ) );

   while( isIdToken( this, this.peekToken(), "par" ) ) {
      body.push( parseSequence.call( this, this.consumeAny(), true ) );
   }

   return astutils.J2SCall( loc, hhref( loc, "FORK" ), 
			    null,
			    [ attrs ].concat( body ) );
}

/*---------------------------------------------------------------------*/
/*    parseEmitSustain ...                                             */
/*    -------------------------------------------------------------    */
/*    emitsig ::= ident | ident( hhexpr )                              */
/*---------------------------------------------------------------------*/
function parseEmitSustain( token, command ) {
   
   function parseSignalEmit( loc ) {
      const id = this.consumeToken( this.ID );
      const locid = id.location;
      let inits = [ locInit( locid ), astutils.J2SDataPropertyInit(
	 locid,
	 astutils.J2SString( locid, id.value ),
	 astutils.J2SString( locid, id.value ) ) ];
      let accessors = [];

      const lparen = this.consumeToken( this.LPAREN );
	 
      if( this.peekToken().type !== this.RPAREN ) {
	 const ll = lparen.location;
	 const { init: val, accessors: axs } = parseValueApply.call( this, ll );
	 const rparen = this.consumeToken( this.RPAREN );

	 inits.push( val );
	 accessors = axs;
      } else {
	 this.consumeAny();
      }
      
      return astutils.J2SCall(
	 loc, hhref( loc, command ), null,
	 [ astutils.J2SObjInit( locid, inits ) ].concat( accessors ) );
   }

   const loc = token.location;
   let locinit = locInit( loc );
   let nodes = [ parseSignalEmit.call( this, loc ) ];

   while( this.peekToken().type === this.COMMA ) {
      this.consumeAny();
      nodes.push( parseSignalEmit.call( this, loc ) );
   }

   if( nodes.length == 1 ) {
      return nodes[ 0 ];
   } else {
      return astutils.J2SCall(
	 loc, hhref( loc, "SEQUENCE" ), null,
	 [ astutils.J2SObjInit( loc, [ locinit ] ) ].concat( nodes ) );
   }
}

/*---------------------------------------------------------------------*/
/*    parseEmit ...                                                    */
/*    -------------------------------------------------------------    */
/*    stmt ::= ...                                                     */
/*       | EMIT emitsig, ...                                           */
/*---------------------------------------------------------------------*/
function parseEmit( token ) {
   return parseEmitSustain.call( this, token, "EMIT" );
}

/*---------------------------------------------------------------------*/
/*    parseSustain ...                                                 */
/*    -------------------------------------------------------------    */
/*    stmt ::= ...                                                     */
/*       | SUSTAIN emitsig, ...                                        */
/*---------------------------------------------------------------------*/
function parseSustain( token ) {
   return parseEmitSustain.call( this, token, "SUSTAIN" );
}

/*---------------------------------------------------------------------*/
/*    parseAwait ...                                                   */
/*    -------------------------------------------------------------    */
/*    stmt ::= ...                                                     */
/*       | AWAIT delay                                                 */
/*---------------------------------------------------------------------*/
function parseAwait( token ) {
   const loc = token.location;
   const { inits, accessors } = parseDelay.call( this, loc, "AWAIT", "apply" );

   return astutils.J2SCall(
      loc, hhref( loc, "AWAIT" ),
      null,
      [ astutils.J2SObjInit( loc, [ locInit( loc ) ].concat( inits ) ) ]
	 .concat( accessors ) );
}

/*---------------------------------------------------------------------*/
/*    parseIf ...                                                      */
/*    -------------------------------------------------------------    */
/*    stmt ::= ...                                                     */
/*       | IF( hhexpr ) block [else stmt]                              */
/*---------------------------------------------------------------------*/
function parseIf( token ) {
   const loc = token.location;
   const inits = locInit( loc );

   this.consumeToken( this.LPAREN );
   const { init, accessors } = parseValueApply.call( this, loc );
   const attrs = astutils.J2SObjInit( loc, [ locInit( loc ), init ] );
   this.consumeToken( this.RPAREN );
   
   const then = parseStmt.call( this, this.peekToken(), false );

   const args = [ attrs ].concat( accessors );
   args.push( then );
   
   if( this.peekToken().type == this.ELSE ) {
      const loce = this.consumeAny().location;
      args.push( parseStmt.call( this, this.peekToken(), false ) );
   }

   return astutils.J2SCall( loc, hhref( loc, "IF" ), null, args );
}

/*---------------------------------------------------------------------*/
/*    parseAbortWeakabort ...                                          */
/*    stmt ::= ...                                                     */
/*       | ABORT( delay ) block                                        */
/*       | WEAKABORT( delay ) block                                    */
/*---------------------------------------------------------------------*/
function parseAbortWeakabort( token, command ) {
   const loc = token.location;
   this.consumeToken( this.LPAREN );
   const { inits, accessors } = parseDelay.call( this, loc, "WEAKABORT", "apply" );
   this.consumeToken( this.RPAREN );
   const stmts = parseHHBlock.call( this );
   
   return astutils.J2SCall(
      loc, hhref( loc, command ), null,
      [ astutils.J2SObjInit( loc, [ locInit( loc ) ].concat( inits ) ) ]
	 .concat( accessors )
	 .concat( stmts ) );
}
   
/*---------------------------------------------------------------------*/
/*    parseAbort ...                                                   */
/*    -------------------------------------------------------------    */
function parseAbort( token ) {
   return parseAbortWeakabort.call( this, token, "ABORT" );
}
   
/*---------------------------------------------------------------------*/
/*    parseWeakabort ...                                               */
/*---------------------------------------------------------------------*/
function parseWeakabort( token ) {
   return parseAbortWeakabort.call( this, token, "WEAKABORT" );
}

/*---------------------------------------------------------------------*/
/*    parseSuspend ...                                                 */
/*    -------------------------------------------------------------    */
/*    stmt ::= ...                                                     */
/*       | SUSPEND( delay ) { stmt }                                   */
/*       | SUSPEND( from delay to delay [emit <Identifier>]) { stmt }  */
/*       | SUSPEND( toggle delay [emit <Identifier>]) { stmt }         */
/*                                                                     */
/*    (MS: I am not sure about the delay arguments. It looks like      */
/*    to me that immediate would be meaning less here.)                */
/*---------------------------------------------------------------------*/
function parseSuspend( token ) {

   function parseEmitwhensuspended( inits ) {
      if( isIdToken( this, this.peekToken(), "emit" ) ) {
	 const loc = this.consumeAny().location
	 const id = this.consumeToken( this.ID );

	 inits.push( 
	    astutils.J2SDataPropertyInit(
	       loc,
	       astutils.J2SString( loc, "emitwhensuspended" ),
	       astutils.J2SString( id.location, id.value ) ) )
      }
   }

   const loc = token.location;

   this.consumeToken( this.LPAREN );
   let delay;
   let inits = [ locInit( loc ) ];
   let accessors = [];
   
   if( isIdToken( this, this.peekToken(), "from" ) ) {
      // SUSPEND FROM delay TO delay [whenemitsuspended] BLOCK
      const { inits: from, accessors: afrom } =
	    parseDelay.call(
	       this, this.consumeAny().location, "SUSPEND", "fromApply" );
      const tot = this.consumeAny();
      if( !isIdToken( this, tot, "to" ) ) {
	 throw error.SyntaxError( "SUSPEND: unexpected token `" + tot.value + "'",
				  tokenLocation( tot ) );
      }

      const { inits: to, accessors: ato } =
	    parseDelay.call( this, tot.location, "SUSPEND", "toApply" );

      parseEmitwhensuspended.call( this, inits );
      
      inits = inits.concat( from );
      inits = inits.concat( to );
      accessors = afrom.concat( ato );
      accessors = [ astutils.J2SArray( loc, afrom ),
		    astutils.J2SArray( loc, ato ) ];
   } else if( isIdToken( this, this.peekToken(), "toggle" ) ) {
      // SUSPEND TOGGLE delay [whenemitsuspended] BLOCK
      const tot = this.consumeAny();
      const { inits: toggle, accessors: atoggle } =
	    parseDelay.call( this, tot.location, "SUSPEND", "toggleApply", "toggleSignal" );
      
      parseEmitwhensuspended.call( this, inits );

      inits = inits.concat( toggle );
      accessors = atoggle;
   } else {
      // SUSPEND delay BLOCK
      const { inits: is, accessors: aexpr } =
	    parseDelay.call( this, loc, "SUSPEND", "apply" );

      inits = inits.concat( is );
      accessors = aexpr;
   }
   this.consumeToken( this.RPAREN );
   const stmts = parseHHBlock.call( this );

   const attrs = astutils.J2SObjInit( loc, inits );
   return astutils.J2SCall(
      loc, hhref( loc, "SUSPEND" ), null,
      [ attrs ].concat( accessors, stmts ) );
}

/*---------------------------------------------------------------------*/
/*    parseLoop ...                                                    */
/*    -------------------------------------------------------------    */
/*    stmt ::= ...                                                     */
/*       | LOOP block                                                  */
/*---------------------------------------------------------------------*/
function parseLoop( token ) {
   const loc = token.location;

   const stmts = parseHHBlock.call( this );
   const attrs = astutils.J2SObjInit( loc, [ locInit( loc ) ] );
   
   return astutils.J2SCall( loc, hhref( loc, "LOOP" ), 
			    null,
			    [ attrs ].concat( stmts ) );
}

/*---------------------------------------------------------------------*/
/*    parseEvery ...                                                   */
/*    -------------------------------------------------------------    */
/*    stmt ::= ...                                                     */
/*       | every ( delay ) block                                       */
/*---------------------------------------------------------------------*/
function parseEvery( token ) {
   const loc = token.location;

   this.consumeToken( this.LPAREN );
   const { inits, accessors } = parseDelay.call( this, loc, "while" );
   this.consumeToken( this.RPAREN );

   const stmts = parseHHBlock.call( this );
   const attrs = astutils.J2SObjInit(
      loc, [ locInit( loc ) ].concat( inits ) );
   
   return astutils.J2SCall( loc, hhref( loc, "EVERY" ), 
			    null,
			    [ attrs ].concat( accessors, stmts ) );
}

/*---------------------------------------------------------------------*/
/*    parseLoopeach ...                                                */
/*    -------------------------------------------------------------    */
/*    stmt ::= ...                                                     */
/*       | do block every ( delay )                                    */
/*---------------------------------------------------------------------*/
function parseLoopeach( token ) {
   const loc = token.location;
   const stmts = parseHHBlock.call( this );

   const tok = this.consumeToken( this.ID );
   
   if( tok.value != "every" ) tokenValueError( tok );
      
   this.consumeToken( this.LPAREN );
   const { inits, accessors } = parseDelay.call( this, loc, "do" );
   this.consumeToken( this.RPAREN );

   const attrs = astutils.J2SObjInit(
      loc, [ locInit( loc ) ].concat( inits ) );
   
   return astutils.J2SCall( loc, hhref( loc, "LOOPEACH" ), 
			    null,
			    [ attrs ].concat( accessors, stmts ) );
}

/*---------------------------------------------------------------------*/
/*    parseExec ...                                                    */
/*    -------------------------------------------------------------    */
/*    stmt ::= ...                                                     */
/*       | exec [ident] block                                          */
/*           [kill block] [suspend block] [resume block]               */
/*---------------------------------------------------------------------*/
function parseExec( token ) {
   const loc = token.location;
   let inits = [ locInit( loc ) ];
   
   if( this.peekToken().type === this.ID ) {
      const id = this.consumeAny();

      // check for reserved exec keywords
      if( "res susp kill".indexOf( id ) >= 0 ) {
	 throw error.SyntaxError( "EXEC: reserved identifier `" + id.value + "'",
				  tokenLocation( id ) );
      }
      
      inits.push( astutils.J2SDataPropertyInit(
	 loc, astutils.J2SString( loc, id.value ),
	 astutils.J2SString( loc, "" ) ) );
   }
      
   const { self, block, accessors } = parseHHThisBlock.call( this );
   inits.push( astutils.J2SDataPropertyInit(
      loc, astutils.J2SString( loc, "apply" ),
      astutils.J2SMethod( loc, "execfun", [], block, self ) ) );

   if( isIdToken( this, this.peekToken(), "kill" ) ) {
      this.consumeAny();
      const { self, block } = this.parseThisBlock();
      inits.push( astutils.J2SDataPropertyInit(
	 loc, astutils.J2SString( loc, "kill" ),
	 astutils.J2SMethod( loc, "execkill", [], block, self ) ) );
   }
   
   if( isIdToken( this, this.peekToken(), "suspend" ) ) {
      this.consumeAny();
      const { self, block } = this.parseThisBlock();
      inits.push( astutils.J2SDataPropertyInit(
	 loc, astutils.J2SString( loc, "susp" ),
	 astutils.J2SMethod( loc, "execsusp", [], block, self ) ) );
   }
   
   if( isIdToken( this, this.peekToken(), "resume" ) ) {
      this.consumeAny();
      const { self, block } = this.parseThisBlock();
      inits.push( astutils.J2SDataPropertyInit(
	 loc, astutils.J2SString( loc, "res" ),
	 astutils.J2SMethod( loc, "execresume", [], block, self ) ) );
   }
   
   const attrs = astutils.J2SObjInit( loc, inits );
   
   return astutils.J2SCall( loc, hhref( loc, "EXEC" ), null,
			    [ attrs ].concat( accessors ) );
}
   
/*---------------------------------------------------------------------*/
/*    parseRun ...                                                     */
/*    -------------------------------------------------------------    */
/*    stmt ::= ...                                                     */
/*       | run hhexpr( sigalias, ... )                                 */
/*    sigalias ::= ident | ident = ident                               */
/*---------------------------------------------------------------------*/
function parseRun( token ) {
   const loc = token.location;
   const next = this.peekToken();
   let inits = [ locInit( loc ) ];
   
   const { expr: call, accessors } = parseHHExpression.call( this );

   if( !(typeof call == "J2SCall" ) ) {
      throw error.SyntaxError( "RUN: bad form", tokenLocation( token ) );
   } else {
      const module = call.fun;
      const args = call.args;
      inits.push( astutils.J2SDataPropertyInit(
	 loc, astutils.J2SString( loc, "module" ), module ) );

      if( typeof args == "pair" ) {
	 args.forEach( a => {
	    if( typeof a == "J2SUnresolvedRef" ) {
	       inits.push( astutils.J2SDataPropertyInit(
		  loc, astutils.J2SString( loc, a.id ),
		  astutils.J2SString( loc, "" ) ) );
	    } else if( (typeof a == "J2SAssig") &&
		       (typeof a.lhs == "J2SUnresolvedRef") &&
		       (typeof a.rhs == "J2SUnresolvedRef") ) {
	       inits.push( astutils.J2SDataPropertyInit(
		  loc, astutils.J2SString( loc, a.lhs.id ),
		  astutils.J2SString( loc, a.rhs.id ) ) );
	    } else {
	       let eloc;
	       
	       try {
		  eloc = {
		     filename: a.loc.cdr.car,
		     pos: a.loc.cdr.cdr.car
		  }
	       } catch( _ ) {
		  eloc = tokenLocation( token );
	       }

	       throw error.SyntaxError( "RUN: bad argument", eloc );
					
	    }
	 } );
      }

      const attrs = astutils.J2SObjInit( loc, inits );
      
      return astutils.J2SCall( loc, hhref( loc, "RUN" ), null,
			       [ attrs ].concat( accessors ) );
   }
}

/*---------------------------------------------------------------------*/
/*    parseLocal ...                                                   */
/*---------------------------------------------------------------------*/
function parseLocal_not_used( token ) {
   const loc = token.location;

   function signal( loc, name, direction ) {
      const id = astutils.J2SDataPropertyInit(
	 loc,
	 astutils.J2SString( loc, "name" ),
	 astutils.J2SString( loc, name ) );
      const attrs = astutils.J2SObjInit( loc, [ id ] );
      
      return astutils.J2SCall( loc, hhref( loc, "SIGNAL" ), null, [ attrs ] );
   }

   function parseSiglist() {

      let lbrace = this.consumeToken( this.LPAREN );
      let args = [];

      while( true ) {
	 if( this.peekToken().type === this.RPAREN ) {
	    this.consumeAny();
	    return args;
	 } else {
	    const t = this.consumeToken( this.ID );
	    
	    args.push( signal( t.location, t.value, "INOUT" ) );

	    if( this.peekToken().type === this.RPAREN ) {
	       this.consumeAny();
	       return args;
	    } else {
	       this.consumeToken( this.COMMA );
	    }
	 }
      }
   }
   
   const attrs = astutils.J2SObjInit( loc, [ locInit( loc ) ] );
   const args = parseSiglist.call( this );
   const stmts = parseHHBlock.call( this );

   return astutils.J2SCall( loc, hhref( loc, "LOCAL" ), 
			    null,
			    [ attrs ].concat( args, stmts ) );
}

/*---------------------------------------------------------------------*/
/*    parseLet ...                                                     */
/*    -------------------------------------------------------------    */
/*    stmt ::= ...                                                     */
/*       | { let id [= val], ; ... }                                   */
/*---------------------------------------------------------------------*/
function parseLet( token, binder ) {
   const loc = token.location;

   function parseDecls() {
      let decls = [];

      while( true ) {
	 const t = this.consumeToken( this.ID );
	 const iloc = t.location;

	 if( this.peekToken().type === this.EGAL ) {
	    this.consumeAny();
	    const { expr, axs: accessors } = parseHHExpression.call( this );
	    const ret = astutils.J2SReturn( loc, expr );
	    const block = astutils.J2SBlock( loc, loc, [ ret ] );
	    const appl = astutils.J2SDataPropertyInit(
	       loc, 
	       astutils.J2SString( loc, "apply" ),
	       astutils.J2SFun( loc, "atomfun", [], block ) );
	    const attrs = astutils.J2SObjInit( loc, [ locInit( loc ), appl ] );
	    const init = astutils.J2SCall( iloc,
					   hhref( loc, "ATOM" ), null,
					   [ attrs ].concat( accessors ) );
	    decls.push(
	       astutils.J2SDeclInit( iloc, t.value, expr, binder ) );
	 } else {
	    decls.push( astutils.J2SDecl( loc, t.value, binder ) );
	 }
	 
	 switch( this.peekToken().type ) {
	    case this.SEMICOLON:
	       this.consumeAny();
	       return decls;
	       
	    case this.COMMA:
	       this.consumeAny();
	       break;
	       
	    default:
	       tokenTypeError( this.consumeAny() );
	 }
      }
   }

   const decls = parseDecls.call( this );
   const stmts = parseHHBlock.call( this, false );
   const attrs = astutils.J2SObjInit( loc, [ locInit( loc ) ] );
   const stmt = stmts.length === 1 ? stmts[ 0 ] : astutils.J2SCall( loc, hhref( loc, "SEQUENCE" ), null, [ attrs ].concat( stmts ) );
   const ret = astutils.J2SReturn( loc, stmt );
   const vdecls = astutils.J2SVarDecls( loc, decls );
   const block = astutils.J2SBlock( loc, loc, [ vdecls, ret ] );
   const fun = astutils.J2SFun( loc, "letfun", [], block );
				
   return astutils.J2SCall( loc, fun, [ astutils.J2SUndefined( loc ) ], [] );
   return 
}

/*---------------------------------------------------------------------*/
/*    parseSignal ...                                                  */
/*    -------------------------------------------------------------    */
/*    stmt ::= ...                                                     */
/*       | { signal id [= val], ; ... }                                */
/*---------------------------------------------------------------------*/
function parseSignal( token ) {
   const loc = token.location;

   function signal( loc, name, direction, init, accessors ) {
      const id = astutils.J2SDataPropertyInit(
	 loc,
	 astutils.J2SString( loc, "name" ),
	 astutils.J2SString( loc, name ) );
      const inits = [ id ];

      if( init ) {
	 const func = astutils.J2SFun(
		  loc, "initfunc", [],
		  astutils.J2SBlock(
		     loc, loc,
		     [ astutils.J2SReturn( loc, init ) ] ) );
	 const initfunc = astutils.J2SDataPropertyInit(
	    loc,
	    astutils.J2SString( loc, "init_func" ),
	    func );

	 inits.push( initfunc );
      }
      
      const attrs = astutils.J2SObjInit( loc, inits );
      return astutils.J2SCall( loc, hhref( loc, "SIGNAL" ), null,
			       [ attrs ].concat( accessors ) );
   }

   function parseSiglist() {
      let args = [];

      while( true ) {
	 const t = this.consumeToken( this.ID );

	 if( this.peekToken().type === this.EGAL ) {
	    this.consumeAny();
	    const { expr, accessors } = parseHHExpression.call( this );
	    args.push( signal( t.location, t.value, "INOUT", expr, accessors ) );
	 } else {
	    args.push( signal( t.location, t.value, "INOUT", false, [] ) );
	 }
	 
	 switch( this.peekToken().type ) {
	    case this.SEMICOLON:
	       this.consumeAny();
	       return args;
	       
	    case this.COMMA:
	       this.consumeAny();
	       break;
	       
	    default:
	       tokenTypeError( this.consumeAny() );
	 }
      }
   }

   const attrs = astutils.J2SObjInit( loc, [ locInit( loc ) ] );
   const args = parseSiglist.call( this );
   const stmts = parseHHBlock.call( this, false );

   return astutils.J2SCall( loc, hhref( loc, "LOCAL" ), 
			    null,
			    [ attrs ].concat( args, stmts ) );
}

/*---------------------------------------------------------------------*/
/*    parseTrap ...                                                    */
/*---------------------------------------------------------------------*/
function parseTrap( token ) {
   const col = this.consumeToken( this.COLUMN );
   const block = parseStmt.call( this, this.peekToken, false );
   const loc = token.location;
   const attrs = astutils.J2SObjInit(
      loc,
      [ astutils.J2SDataPropertyInit(
	 loc,
	 astutils.J2SString( loc, token.value ),
	 astutils.J2SString( loc, token.value ) ),
	locInit( loc ) ] );
   
   return astutils.J2SCall( loc, hhref( loc, "TRAP" ), 
			    null,
			    [ attrs ].concat( [ block ] ) );
}

/*---------------------------------------------------------------------*/
/*    parseStmt ...                                                    */
/*---------------------------------------------------------------------*/
function parseStmt( token, declaration ) {
   const next = this.consumeAny();

   switch( next.type ) {
      case this.ID:
	 switch( next.value ) {
	    case "hop":
	       return parseAtom.call( this, next );
	    case "module":
	       return parseModule.call( this, next, declaration );
/* 	    case "nothing":                                            */
/* 	       return parseNothing.call( this, next );                 */
/* 	    case "pause":                                              */
/* 	       return parsePause.call( this, next );                   */
	    case "halt":
	       return parseHalt.call( this, next );
/* 	    case "sequence":                                           */
/* 	       return parseSequence.call( this, next );                */
	    case "fork":
	       return parseFork.call( this, next );
	    case "emit":
	       return parseEmit.call( this, next );
	    case "sustain":
	       return parseSustain.call( this, next );
/* 	    case "if":                                                 */
/* 	       return parseIf.call( this, next );                      */
	    case "abort":
	       return parseAbort.call( this, next );
	    case "weakabort":
	       return parseWeakabort.call( this, next );
	    case "suspend":
	       return parseSuspend.call( this, next );
	    case "loop":
	       return parseLoop.call( this, next );
	    case "every":
	       return parseEvery.call( this, next );
/* 	    case "loopeach":                                           */
/* 	       return parseLoopeach.call( this, next );                */
/* 	    case "local":                                              */
/* 	       return parseLocal.call( this, next );                   */
	    case "async":
	       return parseExec.call( this, next );
	    case "run":
	       return parseRun.call( this, next );
	       
	    default:
	       if( this.peekToken().type === this.COLUMN ) {
		  return parseTrap.call( this, next );
	       } else {
		  throw tokenValueError( next );
	       }
	 }
	 
      case this.do:
	 return parseLoopeach.call( this, next );
	 
      case this.if:
	 return parseIf.call( this, next );
	 
      case this.break:
	 return parseExit.call( this, next );
	 
      case this.yield:
	 return parsePause.call( this, next );
	 
      case this.await:
	 return parseAwait.call( this, next );
	 
      case this.DOLLAR: {
	    let next = this.peekToken();
	    const expr = this.parseExpression();
	    this.consumeToken( this.RBRACE );
	    return expr;
	 }

      case this.LBRACE:
	 return parseSequence.call( this, next, false );

      default:
	 throw tokenTypeError( this.consumeAny() );
   }
}

/*---------------------------------------------------------------------*/
/*    parseHiphop ...                                                  */
/*---------------------------------------------------------------------*/
function parseHiphop( token, declaration ) {
   const next = this.peekToken();

   if( next.type === this.ID && next.value == "module" ) {
      this.consumeAny();
      const mod = parseModule.call( this, next, declaration );

      if( mod instanceof ast.J2SVarDecls ) {
	 return hhwrapDecl( token, mod );
      } else {
	 return hhwrapExpr( token, mod );
      }
   } else {
      return hhwrapExpr( token, parseStmt.call( this, token, declaration  ) );
   }
}

/*---------------------------------------------------------------------*/
/*    exports                                                          */
/*---------------------------------------------------------------------*/
parser.addPlugin( "hiphop", parseHiphop );

exports.parser = parser;
exports.parse = parser.parse.bind( parser );