/* ============================================================
   INTÉRPRETE DE PYTHON, JAVA Y JAVASCRIPT · AlgoLab

   Módulo importado tal cual desde legacy/cursos/algoritmia.html
   (sección 13 de su script). Es un subsistema cerrado: recibe
   código fuente y devuelve un resultado, sin tocar el DOM ni
   depender de Angular. Se mantiene en JavaScript a propósito,
   con su API declarada en algo-lab.d.ts, para poder actualizarlo
   sin arrastrar 4.000 líneas al chequeo estricto de TypeScript.

     A. Léxico   B. Parser Python   C. Parser Java/JS
     D. Valores  E. Impresión       F. Evaluador
     G. Biblioteca estándar         H. API pública
   ============================================================ */
'use strict';

/* ============================================================
   A. LÉXICO
   ============================================================ */

var PY_KW = ['and','as','assert','break','class','continue','def','del','elif','else','except',
  'False','finally','for','from','global','if','import','in','is','lambda','None','nonlocal',
  'not','or','pass','raise','return','True','try','while','with','yield'];

var C_KW = ['abstract','boolean','break','byte','case','catch','char','class','const','continue',
  'default','do','double','else','enum','extends','final','finally','float','for','function','if',
  'implements','import','instanceof','int','interface','let','long','new','null','package','private',
  'protected','public','return','short','static','super','switch','this','throw','throws','true',
  'false','try','var','void','while','of','const','delete','typeof','in'];

/* Operadores ordenados de más largo a más corto: el léxico prueba en este orden. */
var OPS = ['>>>=','...','===','!==','**=','//=','<<=','>>=','>>>','&&=','||=','??=',
  '**','//','==','!=','<=','>=','&&','||','++','--','+=','-=','*=','/=','%=','&=','|=','^=',
  '->','=>','<<','>>','::','??','?.',
  '+','-','*','/','%','=','<','>','!','&','|','^','~','(',')','[',']','{','}',',',':',';','.','?','@'];

function LexError(msg, line) {
  var e = new Error(msg); e.line = line; e.lex = true; return e;
}

/**
 * Convierte el texto fuente en una lista de tokens.
 * @param {string} src   código escrito por el alumno
 * @param {string} lang  'python' | 'java' | 'javascript'
 */
function lex(src, lang) {
  var py = lang === 'python';
  var toks = [];
  var i = 0, line = 1;
  var n = src.length;
  var indents = [0];
  var atLineStart = true;
  var parenDepth = 0;

  function push(type, value) { toks.push({ t: type, v: value, line: line }); }

  function isIdStart(c) { return /[A-Za-z_$]/.test(c); }
  function isIdPart(c) { return /[A-Za-z0-9_$]/.test(c); }
  function isDigit(c) { return c >= '0' && c <= '9'; }

  while (i < n) {

    /* ---- indentación de Python al principio de cada línea lógica ---- */
    if (py && atLineStart && parenDepth === 0) {
      var col = 0, j = i;
      while (j < n && (src[j] === ' ' || src[j] === '\t')) { col += src[j] === '\t' ? 4 : 1; j++; }
      // línea en blanco o sólo comentario: no cuenta para la indentación
      if (j >= n || src[j] === '\n' || src[j] === '\r' || src[j] === '#') {
        i = j;
        if (i < n && src[i] === '#') { while (i < n && src[i] !== '\n') i++; }
        if (i < n) { if (src[i] === '\r') i++; if (src[i] === '\n') { i++; line++; } }
        continue;
      }
      i = j;
      atLineStart = false;
      if (col > indents[indents.length - 1]) {
        indents.push(col);
        push('INDENT', col);
      } else while (col < indents[indents.length - 1]) {
        indents.pop();
        push('DEDENT', col);
        if (col > indents[indents.length - 1]) throw LexError('La indentación no cuadra con ningún bloque abierto.', line);
      }
      continue;
    }

    var c = src[i];

    /* ---- espacios ---- */
    if (c === ' ' || c === '\t') { i++; continue; }

    /* ---- continuación de línea con \ ---- */
    if (c === '\\' && (src[i + 1] === '\n' || (src[i + 1] === '\r' && src[i + 2] === '\n'))) {
      i++; while (i < n && src[i] !== '\n') i++; i++; line++; continue;
    }

    /* ---- saltos de línea ---- */
    if (c === '\r') { i++; continue; }
    if (c === '\n') {
      i++; line++;
      if (py && parenDepth === 0) {
        if (toks.length && toks[toks.length - 1].t !== 'NEWLINE') push('NEWLINE', '\\n');
        atLineStart = true;
      }
      continue;
    }

    /* ---- comentarios ---- */
    if (c === '#') { while (i < n && src[i] !== '\n') i++; continue; }
    if (!py && c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }

    /* ---- expresión regular literal de JavaScript:  /[a-z]+/gi ----
       Sólo puede serlo si detrás no hay un valor: si lo hay, es una división. */
    if (lang === 'javascript' && c === '/' && src[i + 1] !== '*') {
      var prev = toks.length ? toks[toks.length - 1] : null;
      var esValor = prev && (prev.t === 'NAME' || prev.t === 'NUM' || prev.t === 'STR' || prev.t === 'FSTR' ||
        (prev.t === 'OP' && [')', ']', '}', '++', '--'].indexOf(prev.v) > -1) ||
        (prev.t === 'KW' && ['this', 'true', 'false', 'null', 'super'].indexOf(prev.v) > -1));
      if (!esValor) {
        var j2 = i + 1, cuerpo = '', clase = false, ok = false;
        while (j2 < n) {
          var ch2 = src[j2];
          if (ch2 === '\n') break;
          if (ch2 === '\\') { cuerpo += ch2 + (src[j2 + 1] || ''); j2 += 2; continue; }
          if (ch2 === '[') clase = true;
          else if (ch2 === ']') clase = false;
          else if (ch2 === '/' && !clase) { ok = true; j2++; break; }
          cuerpo += ch2; j2++;
        }
        if (ok && cuerpo.length) {
          var flags = '';
          while (j2 < n && /[gimsuy]/.test(src[j2])) { flags += src[j2]; j2++; }
          i = j2;
          push('REGEX', { body: cuerpo, flags: flags });
          continue;
        }
      }
    }
    if (c === '/' && src[i + 1] === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === '\n') line++; i++; }
      i += 2; continue;
    }

    /* ---- cadenas ---- */
    // prefijos de Python: f"", r"", f'''...'''
    var pref = '';
    if (py && isIdStart(c) && /^[fFrRbB]{1,2}["']/.test(src.slice(i, i + 3))) {
      var k = i;
      while (/[fFrRbB]/.test(src[k])) { pref += src[k].toLowerCase(); k++; }
      i = k; c = src[i];
    }
    if (c === '"' || c === "'" || c === '`') {
      var triple = (c !== '`') && src[i + 1] === c && src[i + 2] === c;
      var quote = c;
      var raw = pref.indexOf('r') > -1;
      var start = line;
      i += triple ? 3 : 1;
      var buf = '';
      var parts = null;               // sólo para f-strings y plantillas
      for (;;) {
        if (i >= n) throw LexError('Falta cerrar la cadena de texto que empieza en la línea ' + start + '.', start);
        var ch = src[i];
        if (ch === '\n') { if (!triple && quote !== '`') throw LexError('Una cadena normal no puede ocupar varias líneas (línea ' + start + ').', start); line++; }
        if (ch === '\\' && !raw) {
          var esc = src[i + 1];
          var map = { n: '\n', t: '\t', r: '\r', '\\': '\\', '"': '"', "'": "'", '0': '\0', b: '\b', '`': '`', '$': '$' };
          if (esc === 'u') {
            var hex = src.substr(i + 2, 4);
            buf += String.fromCharCode(parseInt(hex, 16)); i += 6; continue;
          }
          buf += (map[esc] !== undefined ? map[esc] : esc);
          i += 2; continue;
        }
        if (triple && ch === quote && src[i + 1] === quote && src[i + 2] === quote) { i += 3; break; }
        if (!triple && ch === quote) { i++; break; }
        // interpolación: f"{x}" en Python, `${x}` en JavaScript
        var interp = (pref.indexOf('f') > -1 && ch === '{' && src[i + 1] !== '{')
                  || (quote === '`' && ch === '$' && src[i + 1] === '{');
        if (interp) {
          if (parts === null) parts = [];
          if (buf) parts.push({ lit: buf });
          buf = '';
          i += (quote === '`') ? 2 : 1;
          var depth = 1, expr = '';
          while (i < n && depth > 0) {
            if (src[i] === '{') depth++;
            else if (src[i] === '}') { depth--; if (depth === 0) break; }
            expr += src[i]; i++;
          }
          i++;                                     // consumir la } final
          var fmt = '';
          var colon = -1, d2 = 0;
          for (var q = 0; q < expr.length; q++) {  // separar el formato :.2f
            if (expr[q] === '(' || expr[q] === '[') d2++;
            else if (expr[q] === ')' || expr[q] === ']') d2--;
            else if (expr[q] === ':' && d2 === 0) { colon = q; break; }
          }
          if (colon > -1) { fmt = expr.slice(colon + 1); expr = expr.slice(0, colon); }
          parts.push({ expr: expr, fmt: fmt, line: line });
          continue;
        }
        if (pref.indexOf('f') > -1 && ch === '{' && src[i + 1] === '{') { buf += '{'; i += 2; continue; }
        if (pref.indexOf('f') > -1 && ch === '}' && src[i + 1] === '}') { buf += '}'; i += 2; continue; }
        buf += ch; i++;
      }
      if (parts !== null) { if (buf) parts.push({ lit: buf }); push('FSTR', parts); }
      else if (!py && quote === "'" && !triple && lang === 'java') push('CHAR', buf);
      else push('STR', buf);
      pref = '';
      continue;
    }
    if (pref) throw LexError('Prefijo de cadena sin cadena detrás.', line);

    /* ---- números ---- */
    if (isDigit(c) || (c === '.' && isDigit(src[i + 1]))) {
      var s = '';
      if (c === '0' && (src[i + 1] === 'x' || src[i + 1] === 'X')) {
        i += 2; var h = '';
        while (i < n && /[0-9a-fA-F_]/.test(src[i])) { h += src[i]; i++; }
        push('NUM', { v: parseInt(h.replace(/_/g, ''), 16), float: false });
        continue;
      }
      if (c === '0' && (src[i + 1] === 'b' || src[i + 1] === 'B')) {
        i += 2; var b2 = '';
        while (i < n && /[01_]/.test(src[i])) { b2 += src[i]; i++; }
        push('NUM', { v: parseInt(b2.replace(/_/g, ''), 2), float: false });
        continue;
      }
      var isFloat = false;
      while (i < n && /[0-9_]/.test(src[i])) { s += src[i]; i++; }
      if (src[i] === '.' && isDigit(src[i + 1])) { isFloat = true; s += '.'; i++; while (i < n && /[0-9_]/.test(src[i])) { s += src[i]; i++; } }
      else if (src[i] === '.' && !isIdStart(src[i + 1] || '') && !py) { isFloat = true; s += '.'; i++; }
      if (src[i] === 'e' || src[i] === 'E') {
        var save = i; var ex = src[i]; i++;
        if (src[i] === '+' || src[i] === '-') { ex += src[i]; i++; }
        if (isDigit(src[i])) { isFloat = true; while (i < n && isDigit(src[i])) { ex += src[i]; i++; } s += ex; }
        else i = save;
      }
      if (!py && /[lLdDfF]/.test(src[i] || '')) { if (/[dDfF]/.test(src[i])) isFloat = true; i++; }
      push('NUM', { v: parseFloat(s.replace(/_/g, '')), float: isFloat });
      continue;
    }

    /* ---- identificadores y palabras clave ---- */
    if (isIdStart(c)) {
      var name = '';
      while (i < n && isIdPart(src[i])) { name += src[i]; i++; }
      var kws = py ? PY_KW : C_KW;
      push(kws.indexOf(name) > -1 ? 'KW' : 'NAME', name);
      continue;
    }

    /* ---- operadores ---- */
    /* Operadores que sólo existen en Java / JavaScript. En Python «::» partiría
       en dos una rebanada como a[::-1], y «&&» o «++» no son sintaxis válida. */
    var soloC = py ? { '::': 1, '&&': 1, '||': 1, '++': 1, '--': 1, '=>': 1, '?.': 1, '??': 1, '===': 1, '!==': 1, '>>>': 1 } : {};
    var op = null;
    for (var o = 0; o < OPS.length; o++) {
      if (soloC[OPS[o]]) continue;
      if (src.startsWith(OPS[o], i)) { op = OPS[o]; break; }
    }
    if (op) {
      if (op === '(' || op === '[' || op === '{') parenDepth++;
      if (op === ')' || op === ']' || op === '}') parenDepth = Math.max(0, parenDepth - 1);
      push('OP', op); i += op.length; continue;
    }

    throw LexError('No entiendo el carácter «' + c + '».', line);
  }

  if (py) {
    if (toks.length && toks[toks.length - 1].t !== 'NEWLINE') push('NEWLINE', '\\n');
    while (indents.length > 1) { indents.pop(); push('DEDENT', 0); }
  }
  push('EOF', null);
  return toks;
}

/* ============================================================
   B. ANALIZADOR DE PYTHON
   Bloques por indentación (INDENT / DEDENT del léxico).
   ============================================================ */

function SynError(msg, line) {
  var e = new Error(msg); e.line = line; e.syn = true; return e;
}

function PyParser(toks) {
  this.t = toks; this.i = 0;
}
PyParser.prototype = {
  peek: function (k) { return this.t[this.i + (k || 0)]; },
  get line() { return this.t[this.i] ? this.t[this.i].line : 0; },
  at: function (type, val) {
    var x = this.t[this.i];
    return x.t === type && (val === undefined || x.v === val);
  },
  atAny: function (type, vals) {
    var x = this.t[this.i];
    return x.t === type && vals.indexOf(x.v) > -1;
  },
  next: function () { return this.t[this.i++]; },
  eat: function (type, val) { if (this.at(type, val)) { return this.next(); } return null; },
  expect: function (type, val) {
    if (this.at(type, val)) return this.next();
    var got = this.t[this.i];
    throw SynError('Esperaba «' + (val || type) + '» y encontré «' + (got.v === null ? 'el final del código' : got.v) + '».', got.line);
  },
  skipNewlines: function () { while (this.at('NEWLINE')) this.next(); },

  /* ---------- programa ---------- */
  parseProgram: function () {
    var body = [];
    this.skipNewlines();
    while (!this.at('EOF')) {
      body.push(this.statement());
      this.skipNewlines();
    }
    return { k: 'Block', body: body, line: 1 };
  },

  /* ---------- bloque indentado ---------- */
  block: function () {
    this.expect('OP', ':');
    if (this.at('NEWLINE')) {
      this.skipNewlines();
      if (!this.at('INDENT')) throw SynError('Después de los dos puntos falta un bloque indentado (4 espacios).', this.line);
      this.next();
      var body = [];
      this.skipNewlines();
      while (!this.at('DEDENT') && !this.at('EOF')) {
        body.push(this.statement());
        this.skipNewlines();
      }
      this.eat('DEDENT');
      return { k: 'Block', body: body, line: this.line };
    }
    // forma corta en una línea:  if x: return 1
    var one = [];
    do { one.push(this.simpleStatement()); } while (this.eat('OP', ';') && !this.at('NEWLINE'));
    this.eat('NEWLINE');
    return { k: 'Block', body: one, line: this.line };
  },

  /* ---------- sentencias ---------- */
  statement: function () {
    var ln = this.line;
    if (this.at('KW')) {
      var w = this.peek().v;
      if (w === 'if') return this.ifStmt();
      if (w === 'while') { this.next(); var test = this.expr(); var body = this.block(); return { k: 'While', test: test, body: body, line: ln }; }
      if (w === 'for') return this.forStmt();
      if (w === 'def') return this.funcDef();
      if (w === 'class') return this.classDef();
      if (w === 'try') return this.tryStmt();
      if (w === 'with') return this.withStmt();
    }
    var st = this.simpleStatement();
    while (this.eat('OP', ';')) { if (this.at('NEWLINE') || this.at('EOF')) break; }
    this.eat('NEWLINE');
    return st;
  },

  ifStmt: function () {
    var ln = this.line;
    this.next();                       // if / elif
    var test = this.expr();
    var then = this.block();
    var els = null;
    this.skipNewlines();
    if (this.at('KW', 'elif')) els = this.ifStmt();
    else if (this.at('KW', 'else')) { this.next(); els = this.block(); }
    return { k: 'If', test: test, then: then, els: els, line: ln };
  },

  forStmt: function () {
    var ln = this.line;
    this.next();
    var target = this.targetList();
    this.expect('KW', 'in');
    var iter = this.expr();
    var body = this.block();
    var els = null;
    this.skipNewlines();
    if (this.at('KW', 'else')) { this.next(); els = this.block(); }
    return { k: 'For', target: target, iter: iter, body: body, els: els, line: ln };
  },

  /* Destino de un for o de una comprensión: nombres, no expresiones.
     Hay que parar antes de las comparaciones, porque «in» es una de ellas
     y se lo comería:  for x in datos  →  «x in datos» sería una Cmp. */
  target: function () {
    if (this.at('OP', '*')) { var ln = this.next().line; return { k: 'Star', e: this.target(), line: ln }; }
    if (this.at('OP', '(') || this.at('OP', '[')) {
      var close = this.next().v === '(' ? ')' : ']';
      var items = [];
      while (!this.at('OP', close)) { items.push(this.target()); if (!this.eat('OP', ',')) break; }
      this.expect('OP', close);
      return { k: 'Tuple', items: items, line: this.line };
    }
    return this.postfix();
  },
  /* uno o varios nombres separados por comas:  for i, v in ... */
  targetList: function () {
    var first = this.target();
    if (!this.at('OP', ',')) return first;
    var items = [first];
    while (this.eat('OP', ',')) {
      if (this.at('KW', 'in')) break;
      items.push(this.target());
    }
    return { k: 'Tuple', items: items, line: first.line };
  },

  funcDef: function () {
    var ln = this.line;
    this.next();
    var name = this.expect('NAME').v;
    this.expect('OP', '(');
    var params = this.paramList();
    this.expect('OP', ')');
    if (this.eat('OP', '->')) this.expr();          // anotación de retorno: se ignora
    var body = this.block();
    return { k: 'Func', name: name, params: params, body: body, line: ln };
  },

  paramList: function () {
    var params = [];
    while (!this.at('OP', ')')) {
      var star = 0;
      if (this.eat('OP', '**')) star = 2;
      else if (this.eat('OP', '*')) star = 1;
      if (star === 1 && (this.at('OP', ',') || this.at('OP', ')'))) { this.eat('OP', ','); continue; }
      var nm = this.expect('NAME').v;
      if (this.eat('OP', ':')) this.ternary();       // anotación de tipo: se ignora
      var def = null;
      if (this.eat('OP', '=')) def = this.ternary();
      params.push({ name: nm, def: def, star: star });
      if (!this.eat('OP', ',')) break;
    }
    return params;
  },

  classDef: function () {
    var ln = this.line;
    this.next();
    var name = this.expect('NAME').v;
    var base = null;
    if (this.eat('OP', '(')) {
      if (!this.at('OP', ')')) base = this.expr();
      while (this.eat('OP', ',')) this.expr();
      this.expect('OP', ')');
    }
    var body = this.block();
    return { k: 'Class', name: name, base: base, body: body, line: ln };
  },

  tryStmt: function () {
    var ln = this.line;
    this.next();
    var body = this.block();
    var handlers = [], els = null, fin = null;
    this.skipNewlines();
    while (this.at('KW', 'except')) {
      this.next();
      var type = null, nm = null;
      if (!this.at('OP', ':')) {
        type = this.expr();
        if (this.eat('KW', 'as')) nm = this.expect('NAME').v;
      }
      handlers.push({ type: type, name: nm, body: this.block() });
      this.skipNewlines();
    }
    if (this.at('KW', 'else')) { this.next(); els = this.block(); this.skipNewlines(); }
    if (this.at('KW', 'finally')) { this.next(); fin = this.block(); }
    return { k: 'Try', body: body, handlers: handlers, els: els, fin: fin, line: ln };
  },

  withStmt: function () {
    var ln = this.line;
    this.next();
    var e = this.expr();
    if (this.eat('KW', 'as')) this.expect('NAME');
    var body = this.block();
    return { k: 'Block', body: [{ k: 'ExprStmt', e: e, line: ln }, body], line: ln };
  },

  simpleStatement: function () {
    var ln = this.line;
    if (this.at('KW')) {
      var w = this.peek().v;
      if (w === 'return') {
        this.next();
        var e = (this.at('NEWLINE') || this.at('EOF') || this.at('OP', ';')) ? null : this.exprList();
        return { k: 'Return', e: e, line: ln };
      }
      if (w === 'break') { this.next(); return { k: 'Break', line: ln }; }
      if (w === 'continue') { this.next(); return { k: 'Continue', line: ln }; }
      if (w === 'pass') { this.next(); return { k: 'Pass', line: ln }; }
      if (w === 'raise') {
        this.next();
        var ex = (this.at('NEWLINE') || this.at('EOF')) ? null : this.expr();
        if (this.eat('KW', 'from')) this.expr();
        return { k: 'Raise', e: ex, line: ln };
      }
      if (w === 'global' || w === 'nonlocal') {
        this.next(); var names = [this.expect('NAME').v];
        while (this.eat('OP', ',')) names.push(this.expect('NAME').v);
        return { k: 'Global', kind: w, names: names, line: ln };
      }
      if (w === 'del') {
        this.next(); var ts = [this.expr()];
        while (this.eat('OP', ',')) ts.push(this.expr());
        return { k: 'Del', targets: ts, line: ln };
      }
      if (w === 'assert') {
        this.next(); var t2 = this.expr(); var msg = null;
        if (this.eat('OP', ',')) msg = this.expr();
        return { k: 'Assert', test: t2, msg: msg, line: ln };
      }
      if (w === 'import' || w === 'from') return this.importStmt();
    }
    // expresión, asignación o asignación aumentada
    var target = this.exprList();
    var aug = ['+=', '-=', '*=', '/=', '//=', '%=', '**=', '&=', '|=', '^=', '<<=', '>>='];
    if (this.at('OP') && aug.indexOf(this.peek().v) > -1) {
      var op = this.next().v;
      var val = this.exprList();
      return { k: 'Assign', targets: [target], value: val, op: op.slice(0, -1), line: ln };
    }
    if (this.at('OP', ':') ) {                     // anotación de tipo:  x: int = 3
      this.next(); this.ternary();
      if (this.eat('OP', '=')) return { k: 'Assign', targets: [target], value: this.exprList(), op: null, line: ln };
      return { k: 'Pass', line: ln };
    }
    if (this.at('OP', '=')) {
      var targets = [target];
      while (this.eat('OP', '=')) targets.push(this.exprList());
      var value = targets.pop();
      return { k: 'Assign', targets: targets, value: value, op: null, line: ln };
    }
    return { k: 'ExprStmt', e: target, line: ln };
  },

  importStmt: function () {
    var ln = this.line;
    var from = null, names = [];
    if (this.eat('KW', 'from')) {
      from = this.dottedName();
      this.expect('KW', 'import');
      if (this.eat('OP', '*')) names.push({ name: '*', as: null });
      else do {
        this.eat('OP', '(');
        var nm = this.expect('NAME').v, as = null;
        if (this.eat('KW', 'as')) as = this.expect('NAME').v;
        names.push({ name: nm, as: as });
        this.eat('OP', ')');
      } while (this.eat('OP', ','));
    } else {
      this.expect('KW', 'import');
      do {
        var mod = this.dottedName(), a2 = null;
        if (this.eat('KW', 'as')) a2 = this.expect('NAME').v;
        names.push({ name: mod, as: a2 });
      } while (this.eat('OP', ','));
    }
    return { k: 'Import', from: from, names: names, line: ln };
  },
  dottedName: function () {
    var s = this.expect('NAME').v;
    while (this.at('OP', '.') && this.peek(1).t === 'NAME') { this.next(); s += '.' + this.next().v; }
    return s;
  },

  /* ---------- expresiones ---------- */
  exprList: function () {          // a, b, c  →  tupla
    var first = this.expr();
    if (!this.at('OP', ',')) return first;
    var items = [first];
    while (this.eat('OP', ',')) {
      if (this.at('NEWLINE') || this.at('EOF') || this.at('OP', '=') || this.at('OP', ')') || this.at('OP', ']')) break;
      items.push(this.expr());
    }
    return { k: 'Tuple', items: items, line: first.line };
  },

  expr: function () { return this.ternary(); },

  ternary: function () {
    if (this.at('KW', 'lambda')) return this.lambda();
    var a = this.orExpr();
    if (this.at('KW', 'if')) {
      var ln = this.line;
      this.next();
      var test = this.orExpr();
      this.expect('KW', 'else');
      var b = this.ternary();
      return { k: 'Cond', test: test, a: a, b: b, line: ln };
    }
    return a;
  },

  lambda: function () {
    var ln = this.line;
    this.next();
    var params = [];
    while (!this.at('OP', ':')) {
      var st = 0;
      if (this.eat('OP', '*')) st = 1;
      var nm = this.expect('NAME').v, def = null;
      if (this.eat('OP', '=')) def = this.ternary();
      params.push({ name: nm, def: def, star: st });
      if (!this.eat('OP', ',')) break;
    }
    this.expect('OP', ':');
    var body = this.ternary();
    return { k: 'Lambda', params: params, body: body, line: ln };
  },

  orExpr: function () {
    var l = this.andExpr();
    while (this.at('KW', 'or')) { var ln = this.next().line; l = { k: 'Logic', op: 'or', l: l, r: this.andExpr(), line: ln }; }
    return l;
  },
  andExpr: function () {
    var l = this.notExpr();
    while (this.at('KW', 'and')) { var ln = this.next().line; l = { k: 'Logic', op: 'and', l: l, r: this.notExpr(), line: ln }; }
    return l;
  },
  notExpr: function () {
    if (this.at('KW', 'not')) { var ln = this.next().line; return { k: 'Un', op: 'not', e: this.notExpr(), line: ln }; }
    return this.comparison();
  },
  comparison: function () {
    var first = this.bitOr();
    var ops = [], rest = [];
    for (;;) {
      var op = null;
      if (this.at('OP') && ['<', '>', '<=', '>=', '==', '!='].indexOf(this.peek().v) > -1) op = this.next().v;
      else if (this.at('KW', 'in')) { this.next(); op = 'in'; }
      else if (this.at('KW', 'not') && this.peek(1).t === 'KW' && this.peek(1).v === 'in') { this.next(); this.next(); op = 'not in'; }
      else if (this.at('KW', 'is')) {
        this.next();
        op = (this.at('KW', 'not')) ? (this.next(), 'is not') : 'is';
      }
      if (!op) break;
      ops.push(op); rest.push(this.bitOr());
    }
    if (!ops.length) return first;
    return { k: 'Cmp', ops: ops, operands: [first].concat(rest), line: first.line };
  },
  bitOr: function () { return this.binLevel(['|'], 'bitXor'); },
  bitXor: function () { return this.binLevel(['^'], 'bitAnd'); },
  bitAnd: function () { return this.binLevel(['&'], 'shift'); },
  shift: function () { return this.binLevel(['<<', '>>'], 'additive'); },
  additive: function () { return this.binLevel(['+', '-'], 'multiplicative'); },
  multiplicative: function () { return this.binLevel(['*', '/', '//', '%'], 'unary'); },
  binLevel: function (ops, next) {
    var l = this[next]();
    while (this.at('OP') && ops.indexOf(this.peek().v) > -1) {
      var tk = this.next();
      l = { k: 'Bin', op: tk.v, l: l, r: this[next](), line: tk.line };
    }
    return l;
  },
  unary: function () {
    if (this.at('OP') && ['-', '+', '~'].indexOf(this.peek().v) > -1) {
      var tk = this.next();
      return { k: 'Un', op: tk.v, e: this.unary(), line: tk.line };
    }
    return this.power();
  },
  power: function () {
    var base = this.postfix();
    if (this.at('OP', '**')) { var ln = this.next().line; return { k: 'Bin', op: '**', l: base, r: this.unary(), line: ln }; }
    return base;
  },

  postfix: function () {
    var e = this.atom();
    for (;;) {
      if (this.at('OP', '(')) { e = this.callArgs(e); }
      else if (this.at('OP', '[')) { e = this.subscript(e); }
      else if (this.at('OP', '.')) {
        var ln = this.next().line;
        var nm = this.at('KW') ? this.next().v : this.expect('NAME').v;
        e = { k: 'Attr', obj: e, name: nm, line: ln };
      } else break;
    }
    return e;
  },

  callArgs: function (fn) {
    var ln = this.expect('OP', '(').line;
    var args = [], kwargs = [];
    while (!this.at('OP', ')')) {
      if (this.eat('OP', '**')) { kwargs.push({ name: null, value: this.ternary() }); }
      else if (this.at('OP', '*')) { this.next(); args.push({ k: 'Star', e: this.ternary(), line: ln }); }
      else if (this.at('NAME') && this.peek(1).t === 'OP' && this.peek(1).v === '=' ) {
        var nm = this.next().v; this.next();
        kwargs.push({ name: nm, value: this.ternary() });
      } else {
        var a = this.ternary();
        // comprensión como único argumento:  sum(x for x in datos)
        if (this.at('KW', 'for')) a = this.comprehension(a, 'gen', null);
        args.push(a);
      }
      if (!this.eat('OP', ',')) break;
    }
    this.expect('OP', ')');
    return { k: 'Call', fn: fn, args: args, kwargs: kwargs, line: ln };
  },

  subscript: function (obj) {
    var ln = this.expect('OP', '[').line;
    var a = null, b = null, c = null, isSlice = false;
    if (!this.at('OP', ':')) a = this.exprList();
    if (this.eat('OP', ':')) {
      isSlice = true;
      if (!this.at('OP', ']') && !this.at('OP', ':')) b = this.expr();
      if (this.eat('OP', ':')) { if (!this.at('OP', ']')) c = this.expr(); }
    }
    this.expect('OP', ']');
    return isSlice
      ? { k: 'Slice', obj: obj, a: a, b: b, c: c, line: ln }
      : { k: 'Index', obj: obj, idx: a, line: ln };
  },

  /* comprensión:  [elt for t in it if cond for ...] */
  comprehension: function (elt, kind, val) {
    var ln = this.line;
    var loops = [];
    while (this.at('KW', 'for')) {
      this.next();
      var target = this.targetList();
      this.expect('KW', 'in');
      var iter = this.orExpr();
      var ifs = [];
      while (this.at('KW', 'if')) { this.next(); ifs.push(this.orExpr()); }
      loops.push({ target: target, iter: iter, ifs: ifs });
    }
    return { k: 'Comp', kind: kind, elt: elt, val: val, loops: loops, line: ln };
  },

  atom: function () {
    var tk = this.peek(), ln = tk.line;
    if (tk.t === 'NUM') { this.next(); return { k: 'Num', v: tk.v.v, float: tk.v.float, line: ln }; }
    if (tk.t === 'STR') {
      this.next();
      var s = tk.v;
      while (this.at('STR')) s += this.next().v;      // cadenas contiguas se concatenan
      return { k: 'Str', v: s, line: ln };
    }
    if (tk.t === 'FSTR') {
      this.next();
      var parts = tk.v.map(function (p) {
        if (p.lit !== undefined) return { lit: p.lit };
        var sub = new PyParser(lex(p.expr, 'python'));
        return { node: sub.expr(), fmt: p.fmt };
      });
      return { k: 'FStr', parts: parts, line: ln };
    }
    if (tk.t === 'NAME') { this.next(); return { k: 'Name', v: tk.v, line: ln }; }
    if (tk.t === 'KW') {
      if (tk.v === 'True') { this.next(); return { k: 'Bool', v: true, line: ln }; }
      if (tk.v === 'False') { this.next(); return { k: 'Bool', v: false, line: ln }; }
      if (tk.v === 'None') { this.next(); return { k: 'None', line: ln }; }
      if (tk.v === 'lambda') return this.lambda();
      if (tk.v === 'not') return this.notExpr();
    }
    if (this.at('OP', '(')) {
      this.next();
      if (this.at('OP', ')')) { this.next(); return { k: 'Tuple', items: [], line: ln }; }
      var e = this.expr();
      if (this.at('KW', 'for')) { var comp = this.comprehension(e, 'gen', null); this.expect('OP', ')'); return comp; }
      if (this.at('OP', ',')) {
        var items = [e];
        while (this.eat('OP', ',')) { if (this.at('OP', ')')) break; items.push(this.expr()); }
        this.expect('OP', ')');
        return { k: 'Tuple', items: items, line: ln };
      }
      this.expect('OP', ')');
      return e;
    }
    if (this.at('OP', '[')) {
      this.next();
      if (this.at('OP', ']')) { this.next(); return { k: 'List', items: [], line: ln }; }
      var f = this.expr();
      if (this.at('KW', 'for')) { var c2 = this.comprehension(f, 'list', null); this.expect('OP', ']'); return c2; }
      var its = [f];
      while (this.eat('OP', ',')) { if (this.at('OP', ']')) break; its.push(this.expr()); }
      this.expect('OP', ']');
      return { k: 'List', items: its, line: ln };
    }
    if (this.at('OP', '{')) {
      this.next();
      if (this.at('OP', '}')) { this.next(); return { k: 'Dict', pairs: [], line: ln }; }
      if (this.at('OP', '**')) {                       // {**otro, 'k': v}
        var pr = [];
        do {
          if (this.at('OP', '}')) break;
          if (this.eat('OP', '**')) { pr.push(['**', this.expr()]); continue; }
          var ka = this.expr(); this.expect('OP', ':'); pr.push([ka, this.expr()]);
        } while (this.eat('OP', ','));
        this.expect('OP', '}');
        return { k: 'Dict', pairs: pr, line: ln };
      }
      var k1 = this.expr();
      if (this.eat('OP', ':')) {
        var v1 = this.expr();
        if (this.at('KW', 'for')) { var c3 = this.comprehension(k1, 'dict', v1); this.expect('OP', '}'); return c3; }
        var pairs = [[k1, v1]];
        while (this.eat('OP', ',')) {
          if (this.at('OP', '}')) break;
          if (this.eat('OP', '**')) { pairs.push(['**', this.expr()]); continue; }
          var kk = this.expr(); this.expect('OP', ':'); pairs.push([kk, this.expr()]);
        }
        this.expect('OP', '}');
        return { k: 'Dict', pairs: pairs, line: ln };
      }
      if (this.at('KW', 'for')) { var c4 = this.comprehension(k1, 'set', null); this.expect('OP', '}'); return c4; }
      var sits = [k1];
      while (this.eat('OP', ',')) { if (this.at('OP', '}')) break; sits.push(this.expr()); }
      this.expect('OP', '}');
      return { k: 'Set', items: sits, line: ln };
    }
    throw SynError('No esperaba «' + (tk.v === null ? 'el final del código' : tk.v) + '» aquí.', ln);
  }
};

/* ============================================================
   C. ANALIZADOR DE JAVA Y JAVASCRIPT
   Misma gramática de expresiones; cambian las declaraciones.
   Los tipos de Java se leen y se descartan (el evaluador es
   dinámico), salvo los que cambian la semántica: int/long para
   la división entera, double/float para los decimales y char.
   ============================================================ */

var PRIM = ['int', 'long', 'short', 'byte', 'double', 'float', 'boolean', 'char', 'void', 'var'];
var MODS = ['public', 'private', 'protected', 'static', 'final', 'abstract', 'synchronized', 'native', 'transient', 'volatile', 'default', 'export'];

function CParser(toks, lang) {
  this.t = toks; this.i = 0; this.lang = lang; this.java = lang === 'java';
}
CParser.prototype = {
  peek: function (k) { return this.t[this.i + (k || 0)]; },
  get line() { return this.t[this.i] ? this.t[this.i].line : 0; },
  at: function (type, val) { var x = this.t[this.i]; return x.t === type && (val === undefined || x.v === val); },
  atWord: function (w) { var x = this.t[this.i]; return (x.t === 'KW' || x.t === 'NAME') && x.v === w; },
  next: function () { return this.t[this.i++]; },
  eat: function (type, val) { return this.at(type, val) ? this.next() : null; },
  eatWord: function (w) { return this.atWord(w) ? this.next() : null; },
  expect: function (type, val) {
    if (this.at(type, val)) return this.next();
    var g = this.t[this.i];
    throw SynError('Esperaba «' + (val || type) + '» y encontré «' + (g.v === null ? 'el final del código' : g.v) + '».', g.line);
  },
  name: function () {
    var x = this.t[this.i];
    if (x.t === 'NAME' || x.t === 'KW') { this.i++; return x.v; }
    throw SynError('Esperaba un nombre y encontré «' + x.v + '».', x.line);
  },

  parseProgram: function () {
    var body = [];
    while (!this.at('EOF')) body.push(this.statement());
    return { k: 'Block', body: body, line: 1 };
  },

  block: function () {
    var ln = this.expect('OP', '{').line;
    var body = [];
    while (!this.at('OP', '}') && !this.at('EOF')) body.push(this.statement());
    this.expect('OP', '}');
    return { k: 'Block', body: body, line: ln };
  },

  /* Un cuerpo puede ser un bloque o una sola sentencia:  if (x) return 1; */
  body: function () { return this.at('OP', '{') ? this.block() : { k: 'Block', body: [this.statement()], line: this.line }; },

  skipMods: function () {
    var found = false;
    for (;;) {
      var x = this.t[this.i];
      if ((x.t === 'KW' || x.t === 'NAME') && MODS.indexOf(x.v) > -1) { this.i++; found = true; continue; }
      if (x.t === 'OP' && x.v === '@') { this.i++; this.name(); found = true; continue; }
      break;
    }
    return found;
  },

  /* ---------- sentencias ---------- */
  statement: function () {
    var ln = this.line;
    while (this.eat('OP', ';')) { if (this.at('EOF')) return { k: 'Pass', line: ln }; }
    if (this.at('OP', '{')) return this.block();

    var save = this.i;
    this.skipMods();
    var w = (this.at('KW') || this.at('NAME')) ? this.peek().v : null;

    if (w === 'import' || w === 'package') { while (!this.at('OP', ';') && !this.at('EOF')) this.next(); this.eat('OP', ';'); return { k: 'Pass', line: ln }; }
    if (w === 'class' || w === 'interface' || w === 'enum') return this.classDecl();
    if (w === 'function' && !this.java) return this.jsFunction();
    this.i = save;

    if (this.at('KW')) {
      w = this.peek().v;
      if (w === 'if') {
        this.next(); this.expect('OP', '(');
        var test = this.expr(); this.expect('OP', ')');
        var then = this.body(), els = null;
        if (this.eatWord('else')) els = this.body();
        return { k: 'If', test: test, then: then, els: els, line: ln };
      }
      if (w === 'while') {
        this.next(); this.expect('OP', '(');
        var t2 = this.expr(); this.expect('OP', ')');
        return { k: 'While', test: t2, body: this.body(), line: ln };
      }
      if (w === 'do') {
        this.next();
        var b3 = this.body();
        this.expect('KW', 'while'); this.expect('OP', '(');
        var t3 = this.expr(); this.expect('OP', ')'); this.eat('OP', ';');
        return { k: 'DoWhile', body: b3, test: t3, line: ln };
      }
      if (w === 'for') return this.forStmt();
      if (w === 'switch') return this.switchStmt();
      if (w === 'return') {
        this.next();
        var e = this.at('OP', ';') ? null : this.expr();
        this.eat('OP', ';');
        return { k: 'Return', e: e, line: ln };
      }
      if (w === 'break') { this.next(); if (this.at('NAME')) this.next(); this.eat('OP', ';'); return { k: 'Break', line: ln }; }
      if (w === 'continue') { this.next(); if (this.at('NAME')) this.next(); this.eat('OP', ';'); return { k: 'Continue', line: ln }; }
      if (w === 'throw') { this.next(); var ex = this.expr(); this.eat('OP', ';'); return { k: 'Raise', e: ex, line: ln }; }
      if (w === 'try') return this.tryStmt();
    }

    var decl = this.tryDeclaration();
    if (decl) return decl;

    var st = this.expr();
    this.eat('OP', ';');
    return { k: 'ExprStmt', e: st, line: ln };
  },

  forStmt: function () {
    var ln = this.line;
    this.next(); this.expect('OP', '(');
    // for (T x : coleccion)   ·   for (const x of arr)   ·   for (const k in obj)
    var save = this.i;
    var head = this.tryForEachHead();
    if (head) {
      var obj = this.expr();
      this.expect('OP', ')');
      var b = this.body();
      return head.mode === 'in'
        ? { k: 'ForIn', target: head.target, obj: obj, body: b, line: ln }
        : { k: 'For', target: head.target, iter: obj, body: b, els: null, line: ln };
    }
    this.i = save;
    var init = null;
    if (!this.at('OP', ';')) {
      var d = this.tryDeclaration(true);
      init = d || { k: 'ExprStmt', e: this.exprList(), line: ln };
    }
    this.expect('OP', ';');
    var test = this.at('OP', ';') ? null : this.expr();
    this.expect('OP', ';');
    var upd = this.at('OP', ')') ? null : this.exprList();
    this.expect('OP', ')');
    return { k: 'ForC', init: init, test: test, upd: upd, body: this.body(), line: ln };
  },

  tryForEachHead: function () {
    var save = this.i;
    try {
      this.skipMods();
      if (!this.java) {
        if (this.atWord('let') || this.atWord('const') || this.atWord('var')) this.next();
        var tgt;
        if (this.at('OP', '[')) tgt = this.destructure();
        else tgt = { k: 'Name', v: this.name(), line: this.line };
        if (this.eatWord('of')) return { target: tgt, mode: 'of' };
        if (this.eatWord('in')) return { target: tgt, mode: 'in' };
        this.i = save; return null;
      }
      if (!this.parseTypeSilent()) { this.i = save; return null; }
      var nm = this.name();
      if (this.eat('OP', ':')) return { target: { k: 'Name', v: nm, line: this.line }, mode: 'of' };
      this.i = save; return null;
    } catch (e) { this.i = save; return null; }
  },

  destructure: function () {
    var ln = this.expect('OP', '[').line;
    var items = [];
    while (!this.at('OP', ']')) { items.push({ k: 'Name', v: this.name(), line: ln }); if (!this.eat('OP', ',')) break; }
    this.expect('OP', ']');
    return { k: 'Tuple', items: items, line: ln };
  },

  switchStmt: function () {
    var ln = this.line;
    this.next(); this.expect('OP', '(');
    var disc = this.expr();
    this.expect('OP', ')'); this.expect('OP', '{');
    var cases = [], def = null, cur = null;
    while (!this.at('OP', '}') && !this.at('EOF')) {
      if (this.eatWord('case')) {
        var v = this.expr(); this.expect('OP', ':');
        cur = { tests: [v], body: [] }; cases.push(cur);
        while (this.atWord('case')) { this.next(); cur.tests.push(this.expr()); this.expect('OP', ':'); }
        continue;
      }
      if (this.eatWord('default')) { this.expect('OP', ':'); def = { body: [] }; cur = def; continue; }
      var s = this.statement();
      if (cur) cur.body.push(s);
    }
    this.expect('OP', '}');
    return { k: 'Switch', disc: disc, cases: cases, def: def, line: ln };
  },

  tryStmt: function () {
    var ln = this.line;
    this.next();
    if (this.at('OP', '(')) { this.next(); while (!this.at('OP', ')') && !this.at('EOF')) this.next(); this.next(); }
    var body = this.block();
    var handlers = [], fin = null;
    while (this.atWord('catch')) {
      this.next(); this.expect('OP', '(');
      var type = null, nm = null;
      if (this.java) {
        var save = this.i;
        if (this.parseTypeSilent()) { type = { k: 'Name', v: this.t[save].v, line: ln }; }
        while (this.eat('OP', '|')) this.parseTypeSilent();
        nm = this.name();
      } else { nm = this.name(); }
      this.expect('OP', ')');
      handlers.push({ type: type, name: nm, body: this.block() });
    }
    if (this.eatWord('finally')) fin = this.block();
    return { k: 'Try', body: body, handlers: handlers, els: null, fin: fin, line: ln };
  },

  /* ---------- clases ---------- */
  classDecl: function () {
    var ln = this.line;
    this.next();                                    // class / interface / enum
    var name = this.name();
    this.skipGenerics();
    var base = null;
    if (this.eatWord('extends')) { base = { k: 'Name', v: this.name(), line: ln }; this.skipGenerics(); }
    if (this.eatWord('implements')) { do { this.name(); this.skipGenerics(); } while (this.eat('OP', ',')); }
    this.expect('OP', '{');
    var members = [];
    while (!this.at('OP', '}') && !this.at('EOF')) {
      var m = this.classMember(name);
      if (m) members.push(m);
    }
    this.expect('OP', '}');
    return { k: 'Class', name: name, base: base, members: members, line: ln };
  },

  classMember: function (className) {
    if (this.eat('OP', ';')) return null;
    var ln = this.line;
    var save = this.i;
    var mods = [];
    for (;;) {
      var x = this.t[this.i];
      if ((x.t === 'KW' || x.t === 'NAME') && MODS.indexOf(x.v) > -1) { mods.push(x.v); this.i++; continue; }
      if (x.t === 'OP' && x.v === '@') { this.i++; this.name(); continue; }
      break;
    }
    var isStatic = mods.indexOf('static') > -1;
    if (this.atWord('class')) return this.classDecl();

    if (!this.java) {
      // JavaScript:  metodo(a, b) { ... }   ·   static metodo() { ... }   ·   campo = valor;
      if (this.atWord('constructor')) { this.next(); var cp = this.paramList(); return { kind: 'method', name: 'constructor', params: cp, body: this.block(), stat: false, line: ln }; }
      var jn = this.name();
      if (this.at('OP', '(')) { var jp = this.paramList(); return { kind: 'method', name: jn, params: jp, body: this.block(), stat: isStatic, line: ln }; }
      var jv = this.eat('OP', '=') ? this.expr() : null;
      this.eat('OP', ';');
      return { kind: 'field', name: jn, init: jv, stat: isStatic, line: ln };
    }

    // Java: constructor  ·  método  ·  campo
    if (this.at('NAME', className) && this.peek(1).t === 'OP' && this.peek(1).v === '(') {
      this.next();
      var params = this.paramList();
      if (this.eatWord('throws')) { do { this.name(); } while (this.eat('OP', ',')); }
      return { kind: 'method', name: 'constructor', params: params, body: this.block(), stat: false, line: ln };
    }
    var ty = this.parseTypeSilent();
    if (!ty) { this.i = save; this.next(); return null; }
    var nm = this.name();
    if (this.at('OP', '(')) {
      var ps = this.paramList();
      if (this.eatWord('throws')) { do { this.name(); } while (this.eat('OP', ',')); }
      if (this.at('OP', ';')) { this.next(); return null; }               // método abstracto
      return { kind: 'method', name: nm, params: ps, body: this.block(), stat: isStatic, line: ln, rtype: ty };
    }
    var init = this.eat('OP', '=') ? this.expr() : null;
    var out = [{ kind: 'field', name: nm, init: init, stat: isStatic, line: ln, type: ty }];
    while (this.eat('OP', ',')) {
      var n2 = this.name();
      var i2 = this.eat('OP', '=') ? this.expr() : null;
      out.push({ kind: 'field', name: n2, init: i2, stat: isStatic, line: ln, type: ty });
    }
    this.eat('OP', ';');
    return out.length === 1 ? out[0] : { kind: 'fields', list: out, line: ln };
  },

  jsFunction: function () {
    var ln = this.line;
    this.next();
    this.eat('OP', '*');
    var name = this.name();
    var params = this.paramList();
    return { k: 'Func', name: name, params: params, body: this.block(), line: ln };
  },

  paramList: function () {
    this.expect('OP', '(');
    var ps = [];
    while (!this.at('OP', ')')) {
      this.skipMods();
      var star = 0;
      if (this.eat('OP', '...')) star = 1;
      // En Java el tipo es obligatorio en un método pero opcional en una lambda:
      // se intenta leer y, si detrás no hay un nombre, se da marcha atrás.
      if (this.java) {
        var save = this.i;
        if (this.parseTypeSilent()) {
          if (this.eat('OP', '...')) star = 1;
          if (!(this.at('NAME') || this.at('KW'))) this.i = save;
        } else this.i = save;
      }
      var nm = this.name();
      var def = this.eat('OP', '=') ? this.assign() : null;
      ps.push({ name: nm, def: def, star: star });
      if (!this.eat('OP', ',')) break;
    }
    this.expect('OP', ')');
    return ps;
  },

  /* ---------- tipos de Java ---------- */
  skipGenerics: function () {
    if (!this.at('OP', '<')) return false;
    var save = this.i, depth = 0;
    while (!this.at('EOF')) {
      var x = this.t[this.i];
      if (x.t === 'OP' && (x.v === '<')) { depth++; this.i++; continue; }
      if (x.t === 'OP' && (x.v === '>')) { depth--; this.i++; if (depth === 0) return true; continue; }
      if (x.t === 'OP' && x.v === '>>') { depth -= 2; this.i++; if (depth <= 0) return true; continue; }
      var ok = (x.t === 'NAME') || (x.t === 'KW' && (PRIM.indexOf(x.v) > -1 || x.v === 'extends' || x.v === 'super'))
            || (x.t === 'OP' && (x.v === ',' || x.v === '?' || x.v === '[' || x.v === ']' || x.v === '.'));
      if (!ok) { this.i = save; return false; }
      this.i++;
    }
    this.i = save; return false;
  },

  /** Intenta leer un tipo Java. Devuelve {base, dims} o null (sin consumir). */
  parseTypeSilent: function () {
    var save = this.i;
    var x = this.t[this.i];
    var base;
    if (x.t === 'KW' && PRIM.indexOf(x.v) > -1) { base = x.v; this.i++; }
    else if (x.t === 'NAME' && /^[A-Za-z_]/.test(x.v)) {
      base = x.v; this.i++;
      while (this.at('OP', '.') && this.peek(1).t === 'NAME' && /^[A-Z]/.test(this.peek(1).v)) { this.i++; base = this.name(); }
      if (this.at('OP', '<') && !this.skipGenerics()) { this.i = save; return null; }
    } else return null;
    var dims = 0;
    while (this.at('OP', '[') && this.peek(1).t === 'OP' && this.peek(1).v === ']') { this.i += 2; dims++; }
    return { base: base, dims: dims };
  },

  /** Declaración de variable. Devuelve el nodo o null si no lo era. */
  tryDeclaration: function (noSemi) {
    var save = this.i;
    var ln = this.line;
    this.skipMods();
    var type = null;
    if (this.java) {
      type = this.parseTypeSilent();
      if (!type) { this.i = save; return null; }
      if (type.base === 'var') type = { base: 'var', dims: 0 };
    } else {
      if (!(this.atWord('let') || this.atWord('const') || this.atWord('var'))) { this.i = save; return null; }
      this.next();
      type = { base: 'var', dims: 0 };
    }
    var decls = [];
    for (;;) {
      var target;
      if (!this.java && this.at('OP', '[')) target = this.destructure();
      else if (!this.java && this.at('OP', '{')) { this.i = save; return null; }
      else {
        if (!(this.at('NAME') || this.at('KW'))) { this.i = save; return null; }
        if (this.at('KW') && PRIM.indexOf(this.peek().v) > -1) { this.i = save; return null; }
        target = { k: 'Name', v: this.name(), line: ln };
      }
      var extra = 0;
      while (this.at('OP', '[') && this.peek(1).t === 'OP' && this.peek(1).v === ']') { this.i += 2; extra++; }
      var init = null;
      if (this.eat('OP', '=')) init = this.arrayInitOr(type, extra);
      else if (!this.at('OP', ',') && !this.at('OP', ';') && !(noSemi && this.at('OP', ';'))) { this.i = save; return null; }
      decls.push({ target: target, init: init, dims: (type.dims || 0) + extra });
      if (!this.eat('OP', ',')) break;
    }
    if (!noSemi) this.eat('OP', ';');
    return { k: 'Decl', decls: decls, type: type, line: ln };
  },

  /* int[] a = {1,2,3};  →  literal de array sin new */
  arrayInitOr: function (type, extra) {
    if (this.java && this.at('OP', '{') && ((type.dims || 0) + extra) > 0) return this.javaArrayLiteral();
    return this.assign();
  },
  javaArrayLiteral: function () {
    var ln = this.expect('OP', '{').line;
    var items = [];
    while (!this.at('OP', '}')) {
      items.push(this.at('OP', '{') ? this.javaArrayLiteral() : this.assign());
      if (!this.eat('OP', ',')) break;
    }
    this.expect('OP', '}');
    return { k: 'List', items: items, line: ln };
  },

  /* ---------- expresiones ---------- */
  exprList: function () {
    var e = this.expr();
    while (this.at('OP', ',')) { this.next(); e = { k: 'Seq', l: e, r: this.expr(), line: e.line }; }
    return e;
  },
  expr: function () { return this.assign(); },

  assign: function () {
    var lambda = this.tryLambda();
    if (lambda) return lambda;
    var l = this.ternary();
    var AS = ['=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>=', '>>>=', '**=', '&&=', '||=', '??='];
    if (this.at('OP') && AS.indexOf(this.peek().v) > -1) {
      var op = this.next().v;
      var r = this.assign();
      return { k: 'Assign', targets: [l], value: r, op: op === '=' ? null : op.slice(0, -1), line: l.line };
    }
    return l;
  },

  /** (a, b) -> ...   ·   x => ...   ·   () => { ... } */
  tryLambda: function () {
    var save = this.i;
    var arrow = this.java ? '->' : '=>';
    if (this.at('NAME') && this.peek(1).t === 'OP' && (this.peek(1).v === arrow || this.peek(1).v === '=>' || this.peek(1).v === '->')) {
      var p = [{ name: this.name(), def: null, star: 0 }];
      var ln = this.next().line;
      return this.lambdaBody(p, ln);
    }
    if (this.at('OP', '(')) {
      var depth = 0, j = this.i;
      while (j < this.t.length) {
        var x = this.t[j];
        if (x.t === 'OP' && x.v === '(') depth++;
        else if (x.t === 'OP' && x.v === ')') { depth--; if (depth === 0) { j++; break; } }
        else if (x.t === 'EOF') break;
        j++;
      }
      var after = this.t[j];
      if (after && after.t === 'OP' && (after.v === '->' || after.v === '=>')) {
        var ps;
        try { ps = this.paramList(); } catch (e) { this.i = save; return null; }
        var ln2 = this.next().line;
        return this.lambdaBody(ps, ln2);
      }
    }
    return null;
  },
  lambdaBody: function (params, ln) {
    if (this.at('OP', '{')) return { k: 'Lambda', params: params, body: this.block(), block: true, line: ln };
    return { k: 'Lambda', params: params, body: this.assign(), block: false, line: ln };
  },

  ternary: function () {
    var c = this.nullish();
    if (this.at('OP', '?')) {
      var ln = this.next().line;
      var a = this.assign();
      this.expect('OP', ':');
      var b = this.assign();
      return { k: 'Cond', test: c, a: a, b: b, line: ln };
    }
    return c;
  },
  nullish: function () {
    var l = this.or();
    while (this.at('OP', '??')) { var ln = this.next().line; l = { k: 'Logic', op: '??', l: l, r: this.or(), line: ln }; }
    return l;
  },
  or: function () {
    var l = this.and();
    while (this.at('OP', '||')) { var ln = this.next().line; l = { k: 'Logic', op: 'or', l: l, r: this.and(), line: ln }; }
    return l;
  },
  and: function () {
    var l = this.bitOr();
    while (this.at('OP', '&&')) { var ln = this.next().line; l = { k: 'Logic', op: 'and', l: l, r: this.bitOr(), line: ln }; }
    return l;
  },
  bitOr: function () { return this.lvl(['|'], 'bitXor'); },
  bitXor: function () { return this.lvl(['^'], 'bitAnd'); },
  bitAnd: function () { return this.lvl(['&'], 'equality'); },
  equality: function () { return this.lvl(['==', '!=', '===', '!=='], 'relational'); },
  relational: function () {
    var l = this.shift();
    for (;;) {
      if (this.at('OP') && ['<', '>', '<=', '>='].indexOf(this.peek().v) > -1) {
        var tk = this.next();
        l = { k: 'Bin', op: tk.v, l: l, r: this.shift(), line: tk.line };
      } else if (this.atWord('instanceof')) {
        var ln = this.next().line;
        var ty = this.name(); this.skipGenerics();
        l = { k: 'InstanceOf', e: l, type: ty, line: ln };
      } else if (!this.java && this.atWord('in') ) {
        var ln2 = this.next().line;
        l = { k: 'Bin', op: 'in', l: l, r: this.shift(), line: ln2 };
      } else break;
    }
    return l;
  },
  shift: function () { return this.lvl(['<<', '>>', '>>>'], 'additive'); },
  additive: function () { return this.lvl(['+', '-'], 'multiplicative'); },
  multiplicative: function () { return this.lvl(['*', '/', '%'], 'expo'); },
  expo: function () {
    var l = this.unary();
    if (this.at('OP', '**')) { var ln = this.next().line; return { k: 'Bin', op: '**', l: l, r: this.expo(), line: ln }; }
    return l;
  },
  lvl: function (ops, next) {
    var l = this[next]();
    while (this.at('OP') && ops.indexOf(this.peek().v) > -1) {
      var tk = this.next();
      l = { k: 'Bin', op: tk.v === '===' ? '==' : tk.v === '!==' ? '!=' : tk.v, l: l, r: this[next](), line: tk.line };
    }
    return l;
  },
  unary: function () {
    var tk = this.peek();
    if (tk.t === 'OP' && ['!', '-', '+', '~'].indexOf(tk.v) > -1) {
      this.next();
      return { k: 'Un', op: tk.v === '!' ? 'not' : tk.v, e: this.unary(), line: tk.line };
    }
    if (tk.t === 'OP' && (tk.v === '++' || tk.v === '--')) {
      this.next();
      return { k: 'Update', op: tk.v, e: this.unary(), prefix: true, line: tk.line };
    }
    if (!this.java && (this.atWord('typeof') || this.atWord('delete'))) {
      var w = this.next();
      return { k: 'Un', op: w.v, e: this.unary(), line: w.line };
    }
    if (this.atWord('new')) return this.newExpr();
    // conversión de tipo de Java:  (int) x
    if (this.java && this.at('OP', '(') && this.peek(1).t === 'KW' && PRIM.indexOf(this.peek(1).v) > -1
        && this.peek(2).t === 'OP' && this.peek(2).v === ')') {
      var ln = this.next().line;
      var ty = this.next().v; this.next();
      return { k: 'Cast', type: ty, e: this.unary(), line: ln };
    }
    return this.postfix();
  },

  newExpr: function () {
    var ln = this.next().line;
    var cls = this.name();
    while (this.at('OP', '.') && this.peek(1).t === 'NAME') { this.next(); cls = this.name(); }
    this.skipGenerics();
    if (this.at('OP', '[')) {
      var dims = [], empty = 0;
      while (this.at('OP', '[')) {
        this.next();
        if (this.at('OP', ']')) { this.next(); empty++; }
        else { dims.push(this.expr()); this.expect('OP', ']'); }
      }
      var init = null;
      if (this.at('OP', '{')) init = this.javaArrayLiteral();
      return { k: 'NewArr', base: cls, dims: dims, extra: empty, init: init, line: ln };
    }
    var args = [];
    if (this.at('OP', '(')) args = this.callArgs();
    if (this.at('OP', '{')) this.block();                 // clase anónima: se ignora el cuerpo
    return this.tail({ k: 'New', cls: cls, args: args, line: ln });
  },

  callArgs: function () {
    this.expect('OP', '(');
    var args = [];
    while (!this.at('OP', ')')) {
      if (this.eat('OP', '...')) args.push({ k: 'Star', e: this.assign(), line: this.line });
      else args.push(this.assign());
      if (!this.eat('OP', ',')) break;
    }
    this.expect('OP', ')');
    return args;
  },

  postfix: function () { return this.tail(this.atom()); },

  tail: function (e) {
    for (;;) {
      if (this.at('OP', '(')) { var ln = this.line; e = { k: 'Call', fn: e, args: this.callArgs(), kwargs: [], line: ln }; }
      else if (this.at('OP', '[')) {
        var ln2 = this.next().line;
        var idx = this.expr();
        this.expect('OP', ']');
        e = { k: 'Index', obj: e, idx: idx, line: ln2 };
      } else if (this.at('OP', '.') || this.at('OP', '?.')) {
        var opt = this.peek().v === '?.';
        var ln3 = this.next().line;
        if (this.at('KW', 'class')) { this.next(); e = { k: 'Str', v: String(e.v), line: ln3 }; continue; }
        e = { k: 'Attr', obj: e, name: this.name(), opt: opt, line: ln3 };
      } else if (this.at('OP', '++') || this.at('OP', '--')) {
        var tk = this.next();
        e = { k: 'Update', op: tk.v, e: e, prefix: false, line: tk.line };
      } else if (this.at('OP', '::')) {
        var ln4 = this.next().line;
        var m = this.name();
        e = { k: 'Attr', obj: e, name: m, line: ln4 };
      } else break;
    }
    return e;
  },

  atom: function () {
    var tk = this.peek(), ln = tk.line;
    if (tk.t === 'NUM') { this.next(); return { k: 'Num', v: tk.v.v, float: tk.v.float, line: ln }; }
    if (tk.t === 'STR') { this.next(); return { k: 'Str', v: tk.v, line: ln }; }
    if (tk.t === 'CHAR') { this.next(); return { k: 'Chr', v: tk.v, line: ln }; }
    if (tk.t === 'REGEX') { this.next(); return { k: 'Regex', body: tk.v.body, flags: tk.v.flags, line: ln }; }
    if (tk.t === 'FSTR') {
      this.next();
      var self = this;
      var parts = tk.v.map(function (p) {
        if (p.lit !== undefined) return { lit: p.lit };
        var sub = new CParser(lex(p.expr, self.lang), self.lang);
        return { node: sub.expr(), fmt: p.fmt };
      });
      return { k: 'FStr', parts: parts, line: ln };
    }
    if (tk.t === 'KW') {
      if (tk.v === 'true') { this.next(); return { k: 'Bool', v: true, line: ln }; }
      if (tk.v === 'false') { this.next(); return { k: 'Bool', v: false, line: ln }; }
      if (tk.v === 'null') { this.next(); return { k: 'None', line: ln }; }
      if (tk.v === 'this') { this.next(); return { k: 'Name', v: 'this', line: ln }; }
      if (tk.v === 'super') { this.next(); return { k: 'Name', v: 'super', line: ln }; }
      if (tk.v === 'new') return this.newExpr();
      if (tk.v === 'function') {
        this.next(); this.eat('OP', '*');
        var nm = this.at('NAME') ? this.name() : null;
        var ps = this.paramList();
        return { k: 'Lambda', params: ps, body: this.block(), block: true, name: nm, line: ln };
      }
      if (tk.v === 'class' && !this.java) return this.classDecl();
      if (PRIM.indexOf(tk.v) > -1) { this.next(); return { k: 'Name', v: tk.v, line: ln }; }
    }
    if (tk.t === 'NAME') {
      if (tk.v === 'undefined') { this.next(); return { k: 'None', line: ln }; }
      this.next();
      return { k: 'Name', v: tk.v, line: ln };
    }
    if (this.at('OP', '(')) {
      this.next();
      var e = this.exprList();
      this.expect('OP', ')');
      return e;
    }
    if (this.at('OP', '[')) {
      this.next();
      var items = [];
      while (!this.at('OP', ']')) {
        if (this.eat('OP', '...')) items.push({ k: 'Star', e: this.assign(), line: ln });
        else items.push(this.assign());
        if (!this.eat('OP', ',')) break;
      }
      this.expect('OP', ']');
      return { k: 'List', items: items, line: ln };
    }
    if (this.at('OP', '{') && !this.java) {
      this.next();
      var pairs = [];
      while (!this.at('OP', '}')) {
        if (this.eat('OP', '...')) { pairs.push(['**', this.assign()]); if (!this.eat('OP', ',')) break; continue; }
        var key;
        if (this.at('STR')) key = { k: 'Str', v: this.next().v, line: ln };
        else if (this.at('NUM')) key = { k: 'Str', v: String(this.next().v.v), line: ln };
        else if (this.at('OP', '[')) { this.next(); key = this.assign(); this.expect('OP', ']'); }
        else key = { k: 'Str', v: this.name(), line: ln };
        if (this.eat('OP', ':')) pairs.push([key, this.assign()]);
        else if (this.at('OP', '(')) { var ps2 = this.paramList(); pairs.push([key, { k: 'Lambda', params: ps2, body: this.block(), block: true, line: ln }]); }
        else pairs.push([key, { k: 'Name', v: key.v, line: ln }]);
        if (!this.eat('OP', ',')) break;
      }
      this.expect('OP', '}');
      return { k: 'ObjLit', pairs: pairs, line: ln };
    }
    throw SynError('No esperaba «' + (tk.v === null ? 'el final del código' : tk.v) + '» aquí.', ln);
  }
};

/* ============================================================
   D. VALORES EN TIEMPO DE EJECUCIÓN
   ------------------------------------------------------------
   entero          → number de JavaScript
   decimal         → Flo (para distinguir 5 de 5.0 y la división
                     entera de Java)
   char de Java    → Chr
   texto           → string
   lista / array   → Array
   tupla           → Tup
   dict / map      → HMap        conjunto → HSet
   pila/cola/heap  → Coll
   objeto, clase   → Obj, Cls
   ============================================================ */

function Flo(v) { this.v = v; }
function Chr(c) { this.c = c; }
function Tup(a) { this.a = a; }
function Range(start, stop, step) { this.start = start; this.stop = stop; this.step = step; }
function Coll(kind, a, cmp) { this.kind = kind; this.a = a || []; this.cmp = cmp || null; }
function Cls(name, base) { this.name = name; this.base = base; this.methods = {}; this.statics = {}; this.fieldInits = []; }
function Obj(cls) { this.cls = cls; this.f = Object.create(null); }
function Fun(name, params, body, scope, isExpr) {
  this.name = name; this.params = params; this.body = body; this.scope = scope; this.isExpr = isExpr;
}
function Bound(self, fn) { this.self = self; this.fn = fn; }
function Native(name, fn, arity) { this.name = name; this.fn = fn; this.arity = arity; }
function Mod(name, members) { this.name = name; this.m = members; }
function Rx(body, flags) { this.body = body; this.flags = flags; this.re = new RegExp(body, flags); }

function HMap(sorted) { this.m = new Map(); this.sorted = !!sorted; this.obj = false; }
function HSet(sorted) { this.m = new Map(); this.sorted = !!sorted; }

var idSeq = 0;
function identity(v) {
  if (v.__id === undefined) { try { Object.defineProperty(v, '__id', { value: ++idSeq, enumerable: false }); } catch (e) { v.__id = ++idSeq; } }
  return v.__id;
}

/** Clave canónica de un valor para usarlo dentro de un diccionario o conjunto. */
function keyOf(v) {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'number') return 'n:' + v;
  if (v instanceof Flo) return 'n:' + v.v;
  if (typeof v === 'string') return 's:' + v;
  if (v instanceof Chr) return 'c:' + v.c;
  if (typeof v === 'boolean') return 'b:' + v;
  if (v instanceof Tup) return 't:[' + v.a.map(keyOf).join('') + ']';
  if (Array.isArray(v)) return 'a:[' + v.map(keyOf).join('') + ']';
  return 'o:' + identity(v);
}

HMap.prototype.get = function (k) { var e = this.m.get(keyOf(k)); return e ? e.v : undefined; };
HMap.prototype.has = function (k) { return this.m.has(keyOf(k)); };
HMap.prototype.set = function (k, v) { var s = keyOf(k); var e = this.m.get(s); if (e) e.v = v; else this.m.set(s, { k: k, v: v }); return this; };
HMap.prototype.del = function (k) { return this.m.delete(keyOf(k)); };
HMap.prototype.entries = function () {
  var out = [];
  this.m.forEach(function (e) { out.push(e); });
  if (this.sorted) out.sort(function (a, b) { return cmpValues(a.k, b.k); });
  return out;
};
HMap.prototype.keys = function () { return this.entries().map(function (e) { return e.k; }); };
HMap.prototype.values = function () { return this.entries().map(function (e) { return e.v; }); };

HSet.prototype.has = function (k) { return this.m.has(keyOf(k)); };
HSet.prototype.add = function (k) { var s = keyOf(k); if (!this.m.has(s)) { this.m.set(s, k); return true; } return false; };
HSet.prototype.del = function (k) { return this.m.delete(keyOf(k)); };
HSet.prototype.items = function () {
  var out = [];
  this.m.forEach(function (v) { out.push(v); });
  if (this.sorted) out.sort(cmpValues);
  return out;
};

/* ---------- errores del programa del alumno ---------- */
function RtError(name, msg, line) {
  var e = new Error(msg);
  e.rt = true; e.name = name; e.line = line;
  return e;
}
function Thrown(value, name, msg) { this.value = value; this.name = name; this.msg = msg; }

/* ---------- utilidades de tipo ---------- */
function isNum(v) { return typeof v === 'number' || v instanceof Flo; }
function num(v) {
  if (typeof v === 'number') return v;
  if (v instanceof Flo) return v.v;
  if (v instanceof Chr) return v.c.charCodeAt(0);
  if (typeof v === 'boolean') return v ? 1 : 0;
  return NaN;
}
function isInt(v) { return typeof v === 'number'; }
function mkNum(v, float) { return float ? new Flo(v) : v; }
function isStr(v) { return typeof v === 'string'; }
function isSeq(v) { return Array.isArray(v) || v instanceof Tup || typeof v === 'string' || v instanceof Coll; }

function typeName(v, lang) {
  if (v === null || v === undefined) return lang === 'python' ? 'NoneType' : lang === 'java' ? 'null' : 'undefined';
  if (typeof v === 'boolean') return lang === 'python' ? 'bool' : 'boolean';
  if (typeof v === 'number') return lang === 'python' ? 'int' : 'int';
  if (v instanceof Flo) return lang === 'python' ? 'float' : 'double';
  if (typeof v === 'string') return lang === 'python' ? 'str' : 'String';
  if (v instanceof Chr) return 'char';
  if (Array.isArray(v)) return lang === 'python' ? 'list' : lang === 'java' ? 'array' : 'Array';
  if (v instanceof Tup) return 'tuple';
  if (v instanceof HMap) return lang === 'python' ? 'dict' : lang === 'java' ? 'Map' : 'Object';
  if (v instanceof HSet) return lang === 'python' ? 'set' : 'Set';
  if (v instanceof Coll) return v.kind;
  if (v instanceof Range) return 'range';
  if (v instanceof Obj) return v.cls.name;
  if (v instanceof Cls) return lang === 'python' ? 'type' : 'class';
  if (v instanceof Fun || v instanceof Native || v instanceof Bound) return 'function';
  if (v instanceof Mod) return 'module';
  return 'object';
}

/* ---------- verdad / falsedad ---------- */
function truthy(v, lang) {
  if (v === null || v === undefined) return false;
  if (typeof v === 'boolean') return v;
  if (lang === 'java') {
    if (typeof v === 'number' || v instanceof Flo) return num(v) !== 0;
    return true;
  }
  if (typeof v === 'number') return v !== 0;
  if (v instanceof Flo) return v.v !== 0;
  if (typeof v === 'string') return v.length > 0;
  if (lang === 'javascript') return !(typeof v === 'number' && isNaN(v));
  if (Array.isArray(v)) return v.length > 0;
  if (v instanceof Tup) return v.a.length > 0;
  if (v instanceof HMap) return v.m.size > 0;
  if (v instanceof HSet) return v.m.size > 0;
  if (v instanceof Coll) return v.a.length > 0;
  return true;
}

/* ---------- igualdad y orden ---------- */
function eqValues(a, b) {
  if (a === b) return true;
  if (a === null || a === undefined) return b === null || b === undefined;
  if (b === null || b === undefined) return false;
  if (isNum(a) && isNum(b)) return num(a) === num(b);
  if (a instanceof Chr && b instanceof Chr) return a.c === b.c;
  if (a instanceof Chr && isNum(b)) return num(a) === num(b);
  if (isNum(a) && b instanceof Chr) return num(a) === num(b);
  if (typeof a === 'string' && typeof b === 'string') return a === b;
  if (typeof a === 'boolean' || typeof b === 'boolean') return a === b;
  var la = Array.isArray(a) ? a : a instanceof Tup ? a.a : a instanceof Coll ? a.a : null;
  var lb = Array.isArray(b) ? b : b instanceof Tup ? b.a : b instanceof Coll ? b.a : null;
  if (la && lb) {
    if (la.length !== lb.length) return false;
    for (var i = 0; i < la.length; i++) if (!eqValues(la[i], lb[i])) return false;
    return true;
  }
  if (a instanceof HMap && b instanceof HMap) {
    if (a.m.size !== b.m.size) return false;
    var ok = true;
    a.m.forEach(function (e, k) { if (!ok) return; if (!b.m.has(k) || !eqValues(e.v, b.m.get(k).v)) ok = false; });
    return ok;
  }
  if (a instanceof HSet && b instanceof HSet) {
    if (a.m.size !== b.m.size) return false;
    var ok2 = true;
    a.m.forEach(function (v, k) { if (!b.m.has(k)) ok2 = false; });
    return ok2;
  }
  return false;
}

function cmpValues(a, b) {
  if (isNum(a) && isNum(b)) { var x = num(a), y = num(b); return x < y ? -1 : x > y ? 1 : 0; }
  if (a instanceof Chr || b instanceof Chr) {
    if ((a instanceof Chr || typeof a === 'string') && (b instanceof Chr || typeof b === 'string')) {
      var s1 = a instanceof Chr ? a.c : a, s2 = b instanceof Chr ? b.c : b;
      return s1 < s2 ? -1 : s1 > s2 ? 1 : 0;
    }
    return num(a) - num(b);
  }
  if (typeof a === 'string' && typeof b === 'string') return a < b ? -1 : a > b ? 1 : 0;
  if (typeof a === 'boolean' && typeof b === 'boolean') return (a ? 1 : 0) - (b ? 1 : 0);
  var la = Array.isArray(a) ? a : a instanceof Tup ? a.a : null;
  var lb = Array.isArray(b) ? b : b instanceof Tup ? b.a : null;
  if (la && lb) {
    for (var i = 0; i < Math.min(la.length, lb.length); i++) {
      var c = cmpValues(la[i], lb[i]);
      if (c !== 0) return c;
    }
    return la.length - lb.length;
  }
  return 0;
}

/* ============================================================
   E. FORMATO DE IMPRESIÓN
   Cada lenguaje escribe los valores a su manera.
   ============================================================ */

function fmtNumber(v) {
  if (v instanceof Flo) {
    var x = v.v;
    if (!isFinite(x)) return x > 0 ? 'inf' : (x < 0 ? '-inf' : 'nan');
    if (Number.isInteger(x) && Math.abs(x) < 1e16) return x.toFixed(1);
    return String(x);
  }
  if (!isFinite(v)) return v > 0 ? 'inf' : (v < 0 ? '-inf' : 'nan');
  return String(v);
}

/** Cómo se ve un valor dentro de una lista (repr de Python). */
function pyRepr(v) {
  if (v === null || v === undefined) return 'None';
  if (typeof v === 'boolean') return v ? 'True' : 'False';
  if (typeof v === 'string') return "'" + v.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n') + "'";
  if (v instanceof Chr) return "'" + v.c + "'";
  return pyStr(v, true);
}
function pyStr(v, inner) {
  if (v === null || v === undefined) return 'None';
  if (typeof v === 'boolean') return v ? 'True' : 'False';
  if (isNum(v)) return fmtNumber(v);
  if (typeof v === 'string') return inner ? pyRepr(v) : v;
  if (v instanceof Chr) return v.c;
  if (Array.isArray(v)) return '[' + v.map(pyRepr).join(', ') + ']';
  if (v instanceof Tup) return '(' + v.a.map(pyRepr).join(', ') + (v.a.length === 1 ? ',' : '') + ')';
  if (v instanceof HMap) return '{' + v.entries().map(function (e) { return pyRepr(e.k) + ': ' + pyRepr(e.v); }).join(', ') + '}';
  if (v instanceof HSet) return v.m.size === 0 ? 'set()' : '{' + v.items().map(pyRepr).join(', ') + '}';
  if (v instanceof Coll) {
    if (v.kind === 'deque') return 'deque([' + v.a.map(pyRepr).join(', ') + '])';
    return '[' + v.a.map(pyRepr).join(', ') + ']';
  }
  if (v instanceof Range) return 'range(' + v.start + ', ' + v.stop + (v.step !== 1 ? ', ' + v.step : '') + ')';
  if (v instanceof Obj) {
    if (v.cls.methods['__str__'] || v.cls.methods['__repr__']) return '<' + v.cls.name + '>';
    var ps = [];
    for (var k in v.f) ps.push(k + '=' + pyRepr(v.f[k]));
    return '<' + v.cls.name + ' ' + ps.join(' ') + '>';
  }
  if (v instanceof Cls) return "<class '" + v.name + "'>";
  if (v instanceof Fun) return '<function ' + (v.name || '<lambda>') + '>';
  if (v instanceof Native || v instanceof Bound) return '<built-in function>';
  if (v instanceof Mod) return "<module '" + v.name + "'>";
  return String(v);
}

function javaStr(v) {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (v instanceof Flo) {
    var x = v.v;
    if (!isFinite(x)) return x > 0 ? 'Infinity' : (x < 0 ? '-Infinity' : 'NaN');
    if (Number.isInteger(x) && Math.abs(x) < 1e7) return x.toFixed(1);
    return String(x);
  }
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string') return v;
  if (v instanceof Chr) return v.c;
  if (Array.isArray(v)) return '[' + v.map(javaStr).join(', ') + ']';
  if (v instanceof Tup) return '[' + v.a.map(javaStr).join(', ') + ']';
  if (v instanceof HMap) return '{' + v.entries().map(function (e) { return javaStr(e.k) + '=' + javaStr(e.v); }).join(', ') + '}';
  if (v instanceof HSet) return '[' + v.items().map(javaStr).join(', ') + ']';
  if (v instanceof Coll) return '[' + v.a.map(javaStr).join(', ') + ']';
  if (v instanceof Obj) {
    if (v.cls.methods['toString']) return '<' + v.cls.name + '>';
    var ps = [];
    for (var k in v.f) ps.push(k + '=' + javaStr(v.f[k]));
    return v.cls.name + '{' + ps.join(', ') + '}';
  }
  if (v instanceof Cls) return 'class ' + v.name;
  return String(v);
}

function jsStr(v, inner) {
  if (v === null) return 'null';
  if (v === undefined) return 'undefined';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (isNum(v)) { var x = num(v); return isFinite(x) ? String(x) : (isNaN(x) ? 'NaN' : (x > 0 ? 'Infinity' : '-Infinity')); }
  if (typeof v === 'string') return inner ? "'" + v.replace(/'/g, "\\'") + "'" : v;
  if (v instanceof Chr) return inner ? "'" + v.c + "'" : v.c;
  if (Array.isArray(v)) return v.length === 0 ? '[]' : '[ ' + v.map(function (x) { return jsStr(x, true); }).join(', ') + ' ]';
  if (v instanceof Tup) return '[ ' + v.a.map(function (x) { return jsStr(x, true); }).join(', ') + ' ]';
  if (v instanceof HMap) {
    if (v.obj) {
      var es = v.entries();
      return es.length === 0 ? '{}' : '{ ' + es.map(function (e) { return e.k + ': ' + jsStr(e.v, true); }).join(', ') + ' }';
    }
    return 'Map(' + v.m.size + ') { ' + v.entries().map(function (e) { return jsStr(e.k, true) + ' => ' + jsStr(e.v, true); }).join(', ') + ' }';
  }
  if (v instanceof HSet) return 'Set(' + v.m.size + ') { ' + v.items().map(function (x) { return jsStr(x, true); }).join(', ') + ' }';
  if (v instanceof Coll) return '[ ' + v.a.map(function (x) { return jsStr(x, true); }).join(', ') + ' ]';
  if (v instanceof Obj) {
    var ps = [];
    for (var k in v.f) ps.push(k + ': ' + jsStr(v.f[k], true));
    return (v.cls.name !== 'Object' ? v.cls.name + ' ' : '') + '{ ' + ps.join(', ') + ' }';
  }
  if (v instanceof Fun) return '[Function: ' + (v.name || 'anonymous') + ']';
  if (v instanceof Native || v instanceof Bound) return '[Function]';
  if (v instanceof Cls) return '[class ' + v.name + ']';
  return String(v);
}

function display(v, lang) {
  return lang === 'python' ? pyStr(v, false) : lang === 'java' ? javaStr(v) : jsStr(v, false);
}
function displayInner(v, lang) {
  return lang === 'python' ? pyRepr(v) : lang === 'java' ? javaStr(v) : jsStr(v, true);
}

/** Aplica un formato tipo :.2f  ·  :>8  ·  :,  (f-strings y printf) */
function applyFormat(v, fmt, lang) {
  if (!fmt) return display(v, lang);
  var m = /^([<>^]?)(0?)(\d*)(,?)(?:\.(\d+))?([dfsexXbo%]?)$/.exec(fmt);
  if (!m) return display(v, lang);
  var align = m[1], zero = m[2], width = m[3] ? parseInt(m[3], 10) : 0, comma = m[4], prec = m[5], type = m[6];
  var s;
  if (type === 'x') s = (num(v) >>> 0).toString(16);
  else if (type === 'X') s = (num(v) >>> 0).toString(16).toUpperCase();
  else if (type === 'b') s = (num(v) >>> 0).toString(2);
  else if (type === 'o') s = (num(v) >>> 0).toString(8);
  else if (type === 'f' || (prec !== undefined && isNum(v))) s = num(v).toFixed(prec === undefined ? 6 : parseInt(prec, 10));
  else if (type === 'd') s = String(Math.trunc(num(v)));
  else if (type === '%') s = (num(v) * 100).toFixed(prec === undefined ? 6 : parseInt(prec, 10)) + '%';
  else if (type === 'e') s = num(v).toExponential(prec === undefined ? 6 : parseInt(prec, 10));
  else s = display(v, lang);
  if (comma) {
    var neg = s[0] === '-'; if (neg) s = s.slice(1);
    var dot = s.indexOf('.'); var ip = dot > -1 ? s.slice(0, dot) : s; var rest = dot > -1 ? s.slice(dot) : '';
    s = (neg ? '-' : '') + ip.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + rest;
  }
  while (s.length < width) {
    if (align === '>' || (!align && zero) || (!align && isNum(v))) s = (zero ? '0' : ' ') + s;
    else if (align === '^') s = (s.length % 2 ? ' ' + s : s + ' ');
    else s = s + ' ';
  }
  return s;
}

/** printf / String.format de Java y % de Python */
function sprintf(fmt, args, lang) {
  var i = 0;
  return String(fmt).replace(/%(-?)(\d*)(?:\.(\d+))?([dsfnb%])/g, function (all, left, w, p, t) {
    if (t === '%') return '%';
    if (t === 'n') return '\n';
    var v = args[i++];
    var s;
    if (t === 'd') s = String(Math.trunc(num(v)));
    else if (t === 'f') s = num(v).toFixed(p === undefined ? 6 : parseInt(p, 10));
    else if (t === 'b') s = truthy(v, lang) ? 'true' : 'false';
    else s = display(v, lang);
    var width = w ? parseInt(w, 10) : 0;
    while (s.length < width) s = left ? s + ' ' : ' ' + s;
    return s;
  });
}

/* ============================================================
   F. EVALUADOR
   Recorre el árbol. Cada paso incrementa un contador: si se pasa
   del límite, se corta con un aviso de posible bucle infinito.
   ============================================================ */

var BREAK = { sig: 'break' };
var CONTINUE = { sig: 'continue' };
function ReturnSig(v) { this.v = v; }

function Scope(parent) { this.v = Object.create(parent ? null : null); this.p = parent || null; }
Scope.prototype.lookup = function (n) {
  var s = this;
  while (s) { if (n in s.v) return s; s = s.p; }
  return null;
};
Scope.prototype.get = function (n) { var s = this.lookup(n); return s ? s.v[n] : undefined; };
Scope.prototype.has = function (n) { return !!this.lookup(n); };
Scope.prototype.declare = function (n, v) { this.v[n] = v; };
Scope.prototype.set = function (n, v) {
  var s = this.lookup(n);
  (s || this).v[n] = v;
};

function Interp(lang, opts) {
  opts = opts || {};
  this.lang = lang;
  this.py = lang === 'python';
  this.out = '';
  this.lines = 0;
  this.steps = 0;
  this.limit = opts.limit || 6000000;
  this.maxOut = opts.maxOut || 200000;
  this.t0 = Date.now();
  this.maxMs = opts.maxMs || 6000;
  this.globals = new Scope(null);
  this.depth = 0;
  installGlobals(this);
}

Interp.prototype.write = function (s) {
  if (this.out.length > this.maxOut) {
    throw RtError('SalidaDemasiadoGrande', 'Tu programa ha escrito demasiado texto (más de ' + this.maxOut + ' caracteres). ¿Hay un print dentro de un bucle que no termina?', 0);
  }
  this.out += s;
};
Interp.prototype.tick = function (line) {
  if (++this.steps > this.limit) {
    throw RtError('LimiteDePasos',
      'Tu programa ha ejecutado más de ' + this.limit.toLocaleString('es') + ' operaciones y se ha detenido.\n' +
      'Casi siempre significa un bucle que nunca termina: revisa que la variable del while cambie dentro del bucle.', line);
  }
  if ((this.steps & 8191) === 0 && Date.now() - this.t0 > this.maxMs) {
    throw RtError('TiempoAgotado', 'Tu programa lleva más de ' + (this.maxMs / 1000) + ' segundos ejecutándose y se ha detenido.', line);
  }
};

/* ---------- errores con nombre propio de cada lenguaje ---------- */
Interp.prototype.err = function (kind, msg, line) {
  var names = {
    type:  { python: 'TypeError',      java: 'TypeError',                          javascript: 'TypeError' },
    value: { python: 'ValueError',     java: 'IllegalArgumentException',           javascript: 'RangeError' },
    index: { python: 'IndexError',     java: 'ArrayIndexOutOfBoundsException',     javascript: 'RangeError' },
    key:   { python: 'KeyError',       java: 'NoSuchElementException',             javascript: 'ReferenceError' },
    name:  { python: 'NameError',      java: 'CompileError',                       javascript: 'ReferenceError' },
    attr:  { python: 'AttributeError', java: 'NoSuchMethodError',                  javascript: 'TypeError' },
    zero:  { python: 'ZeroDivisionError', java: 'ArithmeticException',             javascript: 'RangeError' },
    rec:   { python: 'RecursionError', java: 'StackOverflowError',                 javascript: 'RangeError' },
    nul:   { python: 'AttributeError', java: 'NullPointerException',               javascript: 'TypeError' }
  };
  return RtError((names[kind] || names.type)[this.lang], msg, line);
};

/* ---------- ejecución de un programa completo ---------- */
Interp.prototype.run = function (ast) {
  var self = this;
  // 1ª pasada: registrar funciones y clases (permite llamarlas antes de definirlas)
  this.hoist(ast.body, this.globals);
  var loose = [];
  ast.body.forEach(function (st) {
    if (st.k === 'Func' || st.k === 'Class') return;
    loose.push(st);
  });
  if (this.lang === 'java') {
    // Java: se ejecuta el main de la clase principal
    if (loose.length) this.execBlock({ k: 'Block', body: loose }, this.globals);
    var mainCls = null, all = [];
    ast.body.forEach(function (st) { if (st.k === 'Class') { var c = self.globals.get(st.name); if (c) all.push(c); } });
    for (var i = 0; i < all.length; i++) if (all[i].statics['main']) { if (all[i].name === 'Main' || !mainCls) mainCls = all[i]; }
    if (mainCls) this.callValue(mainCls.statics['main'], [[]], 0);
    else if (!loose.length) throw RtError('SinMain', 'No encuentro ningún método «public static void main(String[] args)». Es por donde empieza a ejecutarse un programa de Java.', 1);
  } else {
    this.execBlock({ k: 'Block', body: loose }, this.globals);
    if (this.lang === 'javascript') {
      var m = this.globals.get('main');
      if (m instanceof Fun && !loose.length) this.callValue(m, [], 0);
    }
  }
  return this.out;
};

/** Declara de antemano funciones y clases del nivel superior. */
Interp.prototype.hoist = function (body, scope) {
  var self = this;
  body.forEach(function (st) {
    if (st.k === 'Func') scope.declare(st.name, new Fun(st.name, st.params, st.body, scope, false));
    else if (st.k === 'Class') self.defineClass(st, scope);
  });
  // En Java los métodos estáticos se pueden llamar por su nombre a secas.
  if (this.lang === 'java') {
    body.forEach(function (st) {
      if (st.k !== 'Class') return;
      var c = scope.get(st.name);
      if (!c) return;
      for (var m in c.statics) if (!scope.has(m)) scope.declare(m, c.statics[m]);
    });
  }
};

/* ---------- sentencias ---------- */
Interp.prototype.execBlock = function (block, scope) {
  var body = block.body;
  for (var i = 0; i < body.length; i++) this.exec(body[i], scope);
};

Interp.prototype.exec = function (n, sc) {
  this.tick(n.line);
  switch (n.k) {
    case 'Block': return this.execBlock(n, sc);
    case 'Pass': return;
    case 'ExprStmt': this.evl(n.e, sc); return;

    case 'Decl': {
      for (var i = 0; i < n.decls.length; i++) {
        var d = n.decls[i];
        var v = d.init === null ? this.defaultFor(n.type, d.dims) : this.evl(d.init, sc);
        v = this.coerceDecl(v, n.type, d.dims);
        if (d.target.k === 'Tuple') this.assignTo(d.target, v, sc, true);
        else sc.declare(d.target.v, v);
      }
      return;
    }

    case 'Assign': {
      var val = this.evl(n.value, sc);
      for (var t = 0; t < n.targets.length; t++) {
        var tg = n.targets[t];
        if (n.op) {
          var cur = this.evl(tg, sc);
          val = this.binop(n.op, cur, val, n.line);
        }
        this.assignTo(tg, val, sc, false);
      }
      return;
    }

    case 'If':
      if (truthy(this.evl(n.test, sc), this.lang)) this.exec(n.then, this.child(sc));
      else if (n.els) this.exec(n.els, this.child(sc));
      return;

    case 'While': {
      var guard = 0;
      while (truthy(this.evl(n.test, sc), this.lang)) {
        this.tick(n.line);
        try { this.exec(n.body, this.child(sc)); }
        catch (e) { if (e === BREAK) return; if (e !== CONTINUE) throw e; }
      }
      return;
    }

    case 'DoWhile': {
      do {
        this.tick(n.line);
        try { this.exec(n.body, this.child(sc)); }
        catch (e) { if (e === BREAK) return; if (e !== CONTINUE) throw e; }
      } while (truthy(this.evl(n.test, sc), this.lang));
      return;
    }

    case 'ForC': {
      var s2 = this.child(sc);
      if (n.init) this.exec(n.init, s2);
      while (n.test === null || truthy(this.evl(n.test, s2), this.lang)) {
        this.tick(n.line);
        try { this.exec(n.body, this.child(s2)); }
        catch (e) { if (e === BREAK) return; if (e !== CONTINUE) throw e; }
        if (n.upd) this.evl(n.upd, s2);
      }
      return;
    }

    case 'For': {
      var it = this.iterOf(this.evl(n.iter, sc), n.line);
      var broke = false, r;
      while (!(r = it.next()).done) {
        this.tick(n.line);
        var s3 = this.child(sc);
        this.assignTo(n.target, r.value, s3, true);
        try { this.exec(n.body, s3); }
        catch (e) { if (e === BREAK) { broke = true; break; } if (e !== CONTINUE) throw e; }
      }
      if (n.els && !broke) this.exec(n.els, this.child(sc));
      return;
    }

    case 'ForIn': {
      var o = this.evl(n.obj, sc);
      var keys = o instanceof HMap ? o.keys() : Array.isArray(o) ? o.map(function (_, i) { return i; }) : [];
      for (var q = 0; q < keys.length; q++) {
        this.tick(n.line);
        var s4 = this.child(sc);
        this.assignTo(n.target, keys[q], s4, true);
        try { this.exec(n.body, s4); }
        catch (e) { if (e === BREAK) break; if (e !== CONTINUE) throw e; }
      }
      return;
    }

    case 'Switch': {
      var d = this.evl(n.disc, sc);
      var s5 = this.child(sc);
      var start = -1;
      for (var c = 0; c < n.cases.length; c++) {
        for (var j = 0; j < n.cases[c].tests.length; j++) {
          if (eqValues(d, this.evl(n.cases[c].tests[j], s5))) { start = c; break; }
        }
        if (start > -1) break;
      }
      try {
        if (start > -1) for (var c2 = start; c2 < n.cases.length; c2++) n.cases[c2].body.forEach(function (st) { this.exec(st, s5); }, this);
        else if (n.def) n.def.body.forEach(function (st) { this.exec(st, s5); }, this);
      } catch (e) { if (e !== BREAK) throw e; }
      return;
    }

    case 'Break': throw BREAK;
    case 'Continue': throw CONTINUE;
    case 'Return': throw new ReturnSig(n.e ? this.evl(n.e, sc) : null);

    case 'Func': {
      var f = new Fun(n.name, n.params, n.body, sc, false);
      sc.declare(n.name, f);
      return;
    }

    case 'Class': this.defineClass(n, sc); return;

    case 'Raise': {
      var v = n.e ? this.evl(n.e, sc) : null;
      throw this.makeThrow(v, n.line);
    }

    case 'Try': {
      try {
        this.exec(n.body, this.child(sc));
        if (n.els) this.exec(n.els, this.child(sc));
      } catch (e) {
        if (e === BREAK || e === CONTINUE || e instanceof ReturnSig) { if (n.fin) this.exec(n.fin, this.child(sc)); throw e; }
        var name = e && (e.name || (e.value && e.value.cls && e.value.cls.name)) || 'Error';
        var handled = false;
        for (var h = 0; h < n.handlers.length; h++) {
          var hd = n.handlers[h];
          if (this.handlerMatches(hd, e, name, sc)) {
            var s6 = this.child(sc);
            if (hd.name) s6.declare(hd.name, e.value !== undefined ? e.value : (e.message || String(e)));
            try { this.exec(hd.body, s6); } finally { }
            handled = true; break;
          }
        }
        if (n.fin) this.exec(n.fin, this.child(sc));
        if (!handled) throw e;
        return;
      }
      if (n.fin) this.exec(n.fin, this.child(sc));
      return;
    }

    case 'Global': {
      var self = this;
      n.names.forEach(function (nm) {
        var home;
        if (n.kind === 'nonlocal') {
          // «nonlocal» apunta a la variable de la función de fuera, no a una global
          home = sc.p ? sc.p.lookup(nm) : null;
          if (!home) throw self.err('name', 'nonlocal «' + nm + '»: no existe esa variable en ninguna función que envuelva a ésta.', n.line);
        } else {
          home = self.globals;
          if (!home.has(nm)) home.declare(nm, null);
        }
        if (sc === home) return;
        Object.defineProperty(sc.v, nm, {
          configurable: true, enumerable: true,
          get: function () { return home.v[nm]; },
          set: function (x) { home.v[nm] = x; }
        });
      });
      return;
    }

    case 'Del': {
      for (var k = 0; k < n.targets.length; k++) {
        var tt = n.targets[k];
        if (tt.k === 'Name') { var s7 = sc.lookup(tt.v); if (s7) delete s7.v[tt.v]; }
        else if (tt.k === 'Index') {
          var ob = this.evl(tt.obj, sc), ix = this.evl(tt.idx, sc);
          if (ob instanceof HMap) { if (!ob.del(ix)) throw this.err('key', 'La clave ' + displayInner(ix, this.lang) + ' no está en el diccionario.', n.line); }
          else if (Array.isArray(ob)) ob.splice(this.normIndex(ix, ob.length, n.line), 1);
        }
      }
      return;
    }

    case 'Assert': {
      if (!truthy(this.evl(n.test, sc), this.lang)) {
        var m = n.msg ? display(this.evl(n.msg, sc), this.lang) : 'la condición es falsa';
        throw RtError('AssertionError', 'Falló un assert: ' + m, n.line);
      }
      return;
    }

    case 'Import': this.doImport(n, sc); return;

    default: this.evl(n, sc);
  }
};

Interp.prototype.child = function (sc) { return this.py ? sc : new Scope(sc); };

Interp.prototype.handlerMatches = function (hd, e, name, sc) {
  if (!hd.type) return true;
  var names = [];
  var collect = function (t) {
    if (t.k === 'Name') names.push(t.v);
    else if (t.k === 'Tuple') t.items.forEach(collect);
    else if (t.k === 'Attr') names.push(t.name);
  };
  collect(hd.type);
  for (var i = 0; i < names.length; i++) {
    var nm = names[i];
    if (nm === 'Exception' || nm === 'BaseException' || nm === 'Error' || nm === 'RuntimeException' || nm === 'Throwable') return true;
    if (nm === name) return true;
    if (e.value instanceof Obj) {
      var c = e.value.cls;
      while (c) { if (c.name === nm) return true; c = c.base; }
    }
  }
  return false;
};

Interp.prototype.makeThrow = function (v, line) {
  if (v instanceof Obj) {
    var e = RtError(v.cls.name, v.f.message !== undefined ? display(v.f.message, this.lang) : v.cls.name, line);
    e.value = v; e.user = true;
    return e;
  }
  var msg = v === null ? '' : display(v, this.lang);
  var e2 = RtError('Exception', msg, line);
  e2.value = v; e2.user = true;
  return e2;
};

/* ---------- valores por defecto y conversión de tipos de Java ---------- */
Interp.prototype.defaultFor = function (type, dims) {
  if (!type || this.lang !== 'java') return null;
  if (dims > 0) return null;
  switch (type.base) {
    case 'int': case 'long': case 'short': case 'byte': return 0;
    case 'double': case 'float': return new Flo(0);
    case 'boolean': return false;
    case 'char': return new Chr('\0');
    default: return null;
  }
};
Interp.prototype.coerceDecl = function (v, type, dims) {
  if (this.lang !== 'java' || !type || dims > 0) return v;
  if ((type.base === 'double' || type.base === 'float') && typeof v === 'number') return new Flo(v);
  if ((type.base === 'int' || type.base === 'long' || type.base === 'short' || type.base === 'byte')) {
    if (v instanceof Flo) return Math.trunc(v.v);
    if (v instanceof Chr) return v.c.charCodeAt(0);
  }
  if (type.base === 'char' && typeof v === 'number') return new Chr(String.fromCharCode(v));
  return v;
};

/* ---------- asignación ---------- */
Interp.prototype.assignTo = function (t, v, sc, declare) {
  switch (t.k) {
    case 'Name':
      if (declare) { sc.declare(t.v, v); return; }
      if (!sc.has(t.v) && this.lang === 'java') {
        var self0 = sc.get('this');
        if (self0 instanceof Obj && t.v in self0.f) { self0.f[t.v] = v; return; }
      }
      sc.set(t.v, v);
      return;
    case 'Tuple': case 'List': {
      var items = t.items;
      var arr = this.toArray(v, t.line);
      var star = items.findIndex(function (x) { return x.k === 'Star'; });
      if (star === -1) {
        if (arr.length !== items.length) {
          throw this.err('value', 'Estás repartiendo ' + arr.length + ' valores entre ' + items.length + ' nombres.', t.line);
        }
        for (var i = 0; i < items.length; i++) this.assignTo(items[i], arr[i], sc, declare);
      } else {
        var after = items.length - star - 1;
        for (var a = 0; a < star; a++) this.assignTo(items[a], arr[a], sc, declare);
        this.assignTo(items[star].e, arr.slice(star, arr.length - after), sc, declare);
        for (var b = 0; b < after; b++) this.assignTo(items[star + 1 + b], arr[arr.length - after + b], sc, declare);
      }
      return;
    }
    case 'Index': {
      var obj = this.evl(t.obj, sc);
      var idx = this.evl(t.idx, sc);
      this.setIndex(obj, idx, v, t.line);
      return;
    }
    case 'Slice': {
      var o2 = this.evl(t.obj, sc);
      if (!Array.isArray(o2)) throw this.err('type', 'Sólo se puede asignar a un trozo de una lista.', t.line);
      var r = this.sliceRange(o2.length, t, sc);
      var vals = this.toArray(v, t.line);
      o2.splice.apply(o2, [r.start, r.count].concat(vals));
      return;
    }
    case 'Attr': {
      var target = this.evl(t.obj, sc);
      if (target instanceof Obj) { target.f[t.name] = v; return; }
      if (target instanceof Cls) { target.statics[t.name] = v; return; }
      if (target instanceof HMap) { target.set(t.name, v); return; }
      if (target === null || target === undefined) throw this.err('nul', 'Intentas guardar «' + t.name + '» dentro de algo que vale ' + (this.py ? 'None' : this.lang === 'java' ? 'null' : 'null/undefined') + '.', t.line);
      throw this.err('attr', 'No puedo asignar el atributo «' + t.name + '» a un valor de tipo ' + typeName(target, this.lang) + '.', t.line);
    }
    default:
      throw this.err('type', 'Esto no se puede poner a la izquierda de un «=».', t.line);
  }
};

Interp.prototype.setIndex = function (obj, idx, v, line) {
  if (Array.isArray(obj)) { obj[this.normIndex(idx, obj.length, line)] = v; return; }
  if (obj instanceof Coll) { obj.a[this.normIndex(idx, obj.a.length, line)] = v; return; }
  if (obj instanceof HMap) { obj.set(this.py || !obj.obj ? idx : display(idx, this.lang), v); return; }
  if (typeof obj === 'string') throw this.err('type', 'Las cadenas de texto no se pueden modificar por posición: hay que construir una nueva.', line);
  if (obj instanceof Obj) { obj.f[display(idx, this.lang)] = v; return; }
  if (obj === null || obj === undefined) throw this.err('nul', 'Intentas escribir dentro de algo que no existe (vale ' + (this.py ? 'None' : 'null') + ').', line);
  throw this.err('type', 'No se puede indexar un valor de tipo ' + typeName(obj, this.lang) + '.', line);
};

Interp.prototype.normIndex = function (idx, len, line) {
  var i = num(idx);
  if (!isFinite(i)) throw this.err('type', 'El índice tiene que ser un número entero.', line);
  i = Math.trunc(i);
  if (this.py && i < 0) i += len;
  if (i < 0 || i >= len) {
    throw this.err('index', this.py
      ? 'Índice fuera de rango: pediste la posición ' + num(idx) + ' de una secuencia de ' + len + ' elemento(s). Las posiciones válidas van de 0 a ' + (len - 1) + (len ? ' (y de -1 a -' + len + ' contando desde el final)' : '') + '.'
      : 'Índice fuera de rango: pediste la posición ' + i + ' y el tamaño es ' + len + '. Las posiciones válidas van de 0 a ' + (len - 1) + '.', line);
  }
  return i;
};

/* ---------- expresiones ---------- */
Interp.prototype.evl = function (n, sc) {
  this.tick(n.line);
  switch (n.k) {
    case 'Num': return mkNum(n.v, n.float && this.lang !== 'javascript');
    case 'Str': return n.v;
    case 'Chr': return new Chr(n.v);
    case 'Regex':
      try { return new Rx(n.body, n.flags); }
      catch (e) { throw this.err('value', 'Esa expresión regular no es válida: ' + e.message, n.line); }
    case 'Bool': return n.v;
    case 'None': return null;

    case 'Name': {
      var s = sc.lookup(n.v);
      if (s) return s.v[n.v];
      // En Java, dentro de un método el nombre de un campo se puede usar a secas.
      if (this.lang === 'java') {
        var self0 = sc.get('this');
        if (self0 instanceof Obj && n.v in self0.f) return self0.f[n.v];
        var c0 = sc.get('__cls__');
        if (c0) { var sv = this.findStatic(c0, n.v); if (sv !== undefined) return sv; }
      }
      if (n.v === 'super') {
        var slf = sc.get(this.py ? 'self' : 'this');
        var cc = sc.get('__cls__');
        if (slf && cc && cc.base) return { __isSuper: true, __super: cc.base, __self: slf };
        throw this.err('name', '«super» sólo se puede usar dentro de un método de una clase que hereda de otra.', n.line);
      }
      if (n.v === 'this' || n.v === 'self') throw this.err('name', '«' + n.v + '» sólo existe dentro de un método de una clase.', n.line);
      throw this.err('name', 'No conozco ningún nombre «' + n.v + '». ¿Lo has escrito distinto al declararlo, o lo usas antes de crearlo?', n.line);
    }

    case 'FStr': {
      var out = '';
      for (var i = 0; i < n.parts.length; i++) {
        var p = n.parts[i];
        if (p.lit !== undefined) out += p.lit;
        else out += applyFormat(this.evl(p.node, sc), p.fmt, this.lang);
      }
      return out;
    }

    case 'List': {
      var arr = [];
      for (var a = 0; a < n.items.length; a++) {
        var it = n.items[a];
        if (it.k === 'Star') arr = arr.concat(this.toArray(this.evl(it.e, sc), n.line));
        else arr.push(this.evl(it, sc));
      }
      return arr;
    }
    case 'Tuple': {
      var ta = [];
      for (var b = 0; b < n.items.length; b++) {
        var t2 = n.items[b];
        if (t2.k === 'Star') ta = ta.concat(this.toArray(this.evl(t2.e, sc), n.line));
        else ta.push(this.evl(t2, sc));
      }
      return new Tup(ta);
    }
    case 'Set': {
      var st = new HSet();
      for (var c = 0; c < n.items.length; c++) st.add(this.evl(n.items[c], sc));
      return st;
    }
    case 'Dict': case 'ObjLit': {
      var mp = new HMap();
      if (n.k === 'ObjLit') mp.obj = true;
      var pairs = n.pairs;
      for (var d = 0; d < pairs.length; d++) {
        if (pairs[d][0] === '**') {
          var other = this.evl(pairs[d][1], sc);
          if (other instanceof HMap) other.entries().forEach(function (e) { mp.set(e.k, e.v); });
          continue;
        }
        mp.set(this.evl(pairs[d][0], sc), this.evl(pairs[d][1], sc));
      }
      return mp;
    }

    case 'Bin': return this.binop(n.op, this.evl(n.l, sc), this.evl(n.r, sc), n.line);

    case 'Cmp': {
      var prev = this.evl(n.operands[0], sc);
      for (var e2 = 0; e2 < n.ops.length; e2++) {
        var right = this.evl(n.operands[e2 + 1], sc);
        if (!this.compare(n.ops[e2], prev, right, n.line)) return false;
        prev = right;
      }
      return true;
    }

    case 'Logic': {
      var L = this.evl(n.l, sc);
      if (n.op === '??') return (L === null || L === undefined) ? this.evl(n.r, sc) : L;
      if (n.op === 'and') return truthy(L, this.lang) ? this.evl(n.r, sc) : (this.lang === 'java' ? false : L);
      return truthy(L, this.lang) ? (this.lang === 'java' ? true : L) : this.evl(n.r, sc);
    }

    case 'Un': {
      var v = this.evl(n.e, sc);
      if (n.op === 'not') return !truthy(v, this.lang);
      if (n.op === 'typeof') return typeof v === 'string' ? 'string' : isNum(v) ? 'number' : typeof v === 'boolean' ? 'boolean' : (v === null || v === undefined) ? 'undefined' : (v instanceof Fun || v instanceof Native) ? 'function' : 'object';
      if (n.op === 'delete') return true;
      if (!isNum(v) && !(v instanceof Chr)) throw this.err('type', 'El operador «' + n.op + '» necesita un número, y le has dado ' + typeName(v, this.lang) + '.', n.line);
      if (n.op === '-') return mkNum(-num(v), v instanceof Flo);
      if (n.op === '+') return v;
      if (n.op === '~') return ~num(v);
      return v;
    }

    case 'Cond': return truthy(this.evl(n.test, sc), this.lang) ? this.evl(n.a, sc) : this.evl(n.b, sc);

    case 'Cast': {
      var cv = this.evl(n.e, sc);
      if (n.type === 'int' || n.type === 'long' || n.type === 'short' || n.type === 'byte') return Math.trunc(num(cv));
      if (n.type === 'double' || n.type === 'float') return new Flo(num(cv));
      if (n.type === 'char') return new Chr(String.fromCharCode(num(cv)));
      return cv;
    }

    case 'InstanceOf': {
      var iv = this.evl(n.e, sc);
      var tn = n.type;
      if (iv instanceof Obj) { var cc = iv.cls; while (cc) { if (cc.name === tn) return true; cc = cc.base; } return false; }
      return typeName(iv, this.lang) === tn
        || (tn === 'String' && typeof iv === 'string')
        || (tn === 'Integer' && typeof iv === 'number')
        || (tn === 'List' && (Array.isArray(iv) || (iv instanceof Coll && iv.kind === 'list')));
    }

    case 'Update': {
      var old = this.evl(n.e, sc);
      var nv = this.binop(n.op === '++' ? '+' : '-', old, 1, n.line);
      this.assignTo(n.e, nv, sc, false);
      return n.prefix ? nv : old;
    }

    case 'Assign': { this.exec(n, sc); return this.evl(n.targets[0], sc); }
    case 'Seq': { this.evl(n.l, sc); return this.evl(n.r, sc); }

    case 'Index': {
      var obj = this.evl(n.obj, sc);
      var idx = this.evl(n.idx, sc);
      return this.getIndex(obj, idx, n.line);
    }

    case 'Slice': {
      var so = this.evl(n.obj, sc);
      return this.doSlice(so, n, sc);
    }

    case 'Attr': {
      var target = this.evl(n.obj, sc);
      if (n.opt && (target === null || target === undefined)) return null;
      return this.getMember(target, n.name, n.line, n.obj);
    }

    case 'Call': return this.evalCall(n, sc);

    case 'New': {
      var cls = sc.get(n.cls);
      var args = this.evalArgs(n.args, sc);
      if (cls instanceof Cls) return this.construct(cls, args, n.line);
      var b = builtinConstructor(this, n.cls, args, n.line);
      if (b !== undefined) return b;
      throw this.err('name', 'No conozco la clase «' + n.cls + '».', n.line);
    }

    case 'NewArr': {
      var dims = n.dims.map(function (d) { return Math.trunc(num(this.evl(d, sc))); }, this);
      if (n.init) return this.evl(n.init, sc);
      var fill = this.defaultFor({ base: n.base }, 0);
      var build = function (k) {
        if (k >= dims.length) return fill;
        var len = dims[k];
        if (len < 0) throw this.err('value', 'No se puede crear un array de tamaño negativo.', n.line);
        var out = new Array(len);
        for (var i = 0; i < len; i++) out[i] = build.call(this, k + 1);
        return out;
      };
      return build.call(this, 0);
    }

    case 'Lambda': {
      var f = new Fun(n.name || null, n.params, n.body, sc, !n.block && !this.py ? true : (this.py ? true : false));
      if (this.py) f.isExpr = true;
      else f.isExpr = !n.block;
      if (n.name) sc.declare(n.name, f);
      return f;
    }

    case 'Func': { var fn = new Fun(n.name, n.params, n.body, sc, false); sc.declare(n.name, fn); return fn; }
    case 'Class': { this.defineClass(n, sc); return sc.get(n.name); }

    case 'Comp': return this.comprehension(n, sc);

    case 'Star': return this.evl(n.e, sc);

    default:
      throw RtError('Interno', 'No sé evaluar un nodo de tipo ' + n.k + '.', n.line);
  }
};

/* ---------- índices y rebanadas ---------- */
Interp.prototype.getIndex = function (obj, idx, line) {
  if (typeof obj === 'string') {
    var i = this.normIndex(idx, obj.length, line);
    return this.lang === 'java' ? new Chr(obj[i]) : obj[i];
  }
  if (Array.isArray(obj)) return obj[this.normIndex(idx, obj.length, line)];
  if (obj instanceof Coll) return obj.a[this.normIndex(idx, obj.a.length, line)];
  if (obj instanceof Tup) return obj.a[this.normIndex(idx, obj.a.length, line)];
  if (obj instanceof HMap) {
    var key = idx;
    if (!obj.has(key)) {
      if (obj.counter) return 0;                                   // Counter: lo que no está vale 0
      if (obj.factory !== undefined && obj.factory !== null) {      // defaultdict: se crea al vuelo
        obj.set(key, this.callValue(obj.factory, [], line));
        return obj.get(key);
      }
      if (this.lang === 'javascript') return undefined;
      throw this.err('key', 'La clave ' + displayInner(idx, this.lang) + ' no está en el diccionario. Comprueba antes con «' + (this.py ? 'if clave in dic' : 'map.containsKey(clave)') + '» o usa get() con valor por defecto.', line);
    }
    return obj.get(key);
  }
  if (obj instanceof Obj) return obj.f[display(idx, this.lang)];
  if (obj === null || obj === undefined) throw this.err('nul', 'Intentas acceder por índice a algo que vale ' + (this.py ? 'None' : 'null') + '.', line);
  throw this.err('type', 'Un valor de tipo ' + typeName(obj, this.lang) + ' no se puede indexar con [].', line);
};

Interp.prototype.sliceRange = function (len, n, sc) {
  var step = n.c ? Math.trunc(num(this.evl(n.c, sc))) : 1;
  if (step === 0) throw this.err('value', 'El paso de una rebanada no puede ser 0.', n.line);
  var a = n.a === null ? (step > 0 ? 0 : len - 1) : Math.trunc(num(this.evl(n.a, sc)));
  var b = n.b === null ? (step > 0 ? len : -len - 1) : Math.trunc(num(this.evl(n.b, sc)));
  if (a < 0) a += len; if (b < 0 && n.b !== null) b += len;
  if (step > 0) { a = Math.max(0, Math.min(a, len)); b = Math.max(0, Math.min(b, len)); }
  else { a = Math.max(-1, Math.min(a, len - 1)); b = Math.max(-1, Math.min(b, len - 1)); }
  return { start: a, stop: b, step: step, count: Math.max(0, b - a) };
};

Interp.prototype.doSlice = function (o, n, sc) {
  var isStr = typeof o === 'string';
  var arr = isStr ? o : Array.isArray(o) ? o : o instanceof Tup ? o.a : o instanceof Coll ? o.a : null;
  if (arr === null) throw this.err('type', 'Sólo se pueden rebanar cadenas, listas y tuplas.', n.line);
  var r = this.sliceRange(arr.length, n, sc);
  var out = [];
  if (r.step > 0) for (var i = r.start; i < r.stop; i += r.step) out.push(arr[i]);
  else for (var j = r.start; j > r.stop; j += r.step) out.push(arr[j]);
  if (isStr) return out.join('');
  if (o instanceof Tup) return new Tup(out);
  return out;
};

/* ---------- operadores binarios ---------- */
Interp.prototype.binop = function (op, a, b, line) {
  var lang = this.lang;

  if (op === 'in') {                                  //  'x' in obj  (JavaScript)
    if (b instanceof HMap) return b.has(a);
    if (Array.isArray(b)) return num(a) >= 0 && num(a) < b.length;
    return false;
  }

  if (op === '+') {
    if (typeof a === 'string' || typeof b === 'string') {
      if (this.py && !(typeof a === 'string' && typeof b === 'string')) {
        throw this.err('type', 'En Python no se puede sumar texto y ' + typeName(typeof a === 'string' ? b : a, lang) +
          '. Convierte el número con str(...) o usa una f-string: f"total {n}".', line);
      }
      return display(a, lang) + display(b, lang);
    }
    if (a instanceof Chr && b instanceof Chr) return num(a) + num(b);
    if (Array.isArray(a) && Array.isArray(b)) return a.concat(b);
    if (a instanceof Tup && b instanceof Tup) return new Tup(a.a.concat(b.a));
    if (a instanceof HSet && b instanceof HSet) throw this.err('type', 'Los conjuntos no se suman con +. Usa union() o el operador |.', line);
    if (!isNum(a) && !(a instanceof Chr)) return this.badOp(op, a, b, line);
    if (!isNum(b) && !(b instanceof Chr)) return this.badOp(op, a, b, line);
    return mkNum(num(a) + num(b), (a instanceof Flo || b instanceof Flo) && lang !== 'javascript');
  }

  if (op === '*') {
    if (this.py && typeof a === 'string' && isInt(b)) return b > 0 ? a.repeat(b) : '';
    if (this.py && isInt(a) && typeof b === 'string') return a > 0 ? b.repeat(a) : '';
    if (this.py && Array.isArray(a) && isInt(b)) { var o = []; for (var i = 0; i < b; i++) o = o.concat(a); return o; }
    if (this.py && isInt(a) && Array.isArray(b)) { var o2 = []; for (var j = 0; j < a; j++) o2 = o2.concat(b); return o2; }
    if (typeof a === 'string' && lang === 'javascript') return NaN;
  }

  if (op === '%' && this.py && typeof a === 'string') {   // "%d de %d" % (hechos, total)
    return sprintf(a, b instanceof Tup ? b.a : [b], lang);
  }

  if (['-', '*', '/', '//', '%', '**', '&', '|', '^', '<<', '>>', '>>>'].indexOf(op) > -1) {
    if (a instanceof HSet && b instanceof HSet) return setOp(op, a, b, this, line);
    if (!isNum(a) && !(a instanceof Chr) && typeof a !== 'boolean') return this.badOp(op, a, b, line);
    if (!isNum(b) && !(b instanceof Chr) && typeof b !== 'boolean') return this.badOp(op, a, b, line);
    var x = num(a), y = num(b);
    var flo = (a instanceof Flo || b instanceof Flo) && lang !== 'javascript';
    switch (op) {
      case '-': return mkNum(x - y, flo);
      case '*': return mkNum(x * y, flo);
      case '/':
        if (y === 0) {
          if (lang === 'javascript') return x === 0 ? NaN : (x > 0 ? Infinity : -Infinity);
          if (this.py) throw this.err('zero', 'División entre cero. Comprueba el divisor antes de dividir.', line);
          if (!flo) throw this.err('zero', 'División entera entre cero (/ by zero).', line);
          return new Flo(x === 0 ? NaN : (x > 0 ? Infinity : -Infinity));
        }
        if (this.py) return new Flo(x / y);                   // en Python «/» siempre da decimal
        if (lang === 'javascript') return x / y;
        return flo ? new Flo(x / y) : Math.trunc(x / y);      // en Java int/int es división entera
      case '//':
        if (y === 0) throw this.err('zero', 'División entera entre cero.', line);
        return mkNum(Math.floor(x / y), flo);
      case '%':
        if (y === 0) throw this.err('zero', 'Resto de una división entre cero.', line);
        if (this.py) return mkNum(((x % y) + y) % y, flo);    // en Python el resto tiene el signo del divisor
        return mkNum(x % y, flo);
      case '**': return mkNum(Math.pow(x, y), flo || (this.py && y < 0));
      case '&': return x & y;
      case '|': return x | y;
      case '^': return x ^ y;
      case '<<': return x << y;
      case '>>': return x >> y;
      case '>>>': return x >>> y;
    }
  }

  if (['==', '!=', '<', '>', '<=', '>='].indexOf(op) > -1) return this.compare(op, a, b, line);
  throw this.err('type', 'No sé aplicar el operador «' + op + '».', line);
};

Interp.prototype.badOp = function (op, a, b, line) {
  throw this.err('type', 'No se puede hacer «' + typeName(a, this.lang) + ' ' + op + ' ' + typeName(b, this.lang) + '».' +
    (typeof a === 'string' || typeof b === 'string' ? ' Si son números escritos como texto, conviértelos primero (' +
      (this.py ? 'int(x)' : this.lang === 'java' ? 'Integer.parseInt(x)' : 'Number(x)') + ').' : ''), line);
};

Interp.prototype.compare = function (op, a, b, line) {
  switch (op) {
    case '==': return eqValues(a, b) || (this.lang !== 'python' && a instanceof Obj && a === b);
    case '!=': return !this.compare('==', a, b, line);
    case 'is': return a === b || (a === null && b === null) || (isNum(a) && isNum(b) && num(a) === num(b) && typeof a === typeof b);
    case 'is not': return !this.compare('is', a, b, line);
    case 'in': return this.contains(b, a, line);
    case 'not in': return !this.contains(b, a, line);
  }
  var comparable = (isNum(a) || a instanceof Chr) && (isNum(b) || b instanceof Chr);
  if (!comparable) {
    var bothStr = typeof a === 'string' && typeof b === 'string';
    var bothSeq = (Array.isArray(a) || a instanceof Tup) && (Array.isArray(b) || b instanceof Tup);
    var chrStr = (a instanceof Chr || typeof a === 'string') && (b instanceof Chr || typeof b === 'string');
    if (!bothStr && !bothSeq && !chrStr) {
      throw this.err('type', 'No se pueden comparar con «' + op + '» un ' + typeName(a, this.lang) + ' y un ' + typeName(b, this.lang) + '.', line);
    }
  }
  var c = cmpValues(a, b);
  switch (op) {
    case '<': return c < 0;
    case '>': return c > 0;
    case '<=': return c <= 0;
    case '>=': return c >= 0;
  }
  return false;
};

Interp.prototype.contains = function (cont, item, line) {
  if (typeof cont === 'string') {
    var s = item instanceof Chr ? item.c : item;
    if (typeof s !== 'string') throw this.err('type', 'Para buscar dentro de un texto con «in», lo que buscas también tiene que ser texto.', line);
    return cont.indexOf(s) > -1;
  }
  if (Array.isArray(cont)) { for (var i = 0; i < cont.length; i++) if (eqValues(cont[i], item)) return true; return false; }
  if (cont instanceof Tup) { for (var j = 0; j < cont.a.length; j++) if (eqValues(cont.a[j], item)) return true; return false; }
  if (cont instanceof Coll) { for (var k = 0; k < cont.a.length; k++) if (eqValues(cont.a[k], item)) return true; return false; }
  if (cont instanceof HSet) return cont.has(item);
  if (cont instanceof HMap) return cont.has(item);
  if (cont instanceof Range) { var v = num(item); return v >= cont.start && v < cont.stop && (v - cont.start) % cont.step === 0; }
  throw this.err('type', 'No se puede usar «in» sobre un valor de tipo ' + typeName(cont, this.lang) + '.', line);
};

/* ---------- iteración ---------- */
Interp.prototype.iterOf = function (v, line) {
  var lang = this.lang;
  if (v instanceof Range) {
    var i = v.start, stop = v.stop, step = v.step;
    return { next: function () {
      if (step > 0 ? i >= stop : i <= stop) return { done: true };
      var out = i; i += step; return { done: false, value: out };
    } };
  }
  var arr = null;
  if (Array.isArray(v)) arr = v;
  else if (v instanceof Tup) arr = v.a;
  else if (v instanceof Coll) arr = v.a;
  else if (v instanceof HSet) arr = v.items();
  else if (v instanceof HMap) arr = v.keys();
  else if (typeof v === 'string') arr = v.split('').map(function (c) { return lang === 'java' ? new Chr(c) : c; });
  if (arr === null) {
    if (v === null || v === undefined) throw this.err('nul', 'Intentas recorrer algo que vale ' + (this.py ? 'None' : 'null') + '. ¿Se te olvidó devolver la lista con return?', line);
    throw this.err('type', 'Un valor de tipo ' + typeName(v, this.lang) + ' no se puede recorrer con un bucle for.', line);
  }
  var k = 0, snapshot = arr;
  return { next: function () { return k < snapshot.length ? { done: false, value: snapshot[k++] } : { done: true }; } };
};

Interp.prototype.toArray = function (v, line) {
  if (Array.isArray(v)) return v;
  if (v instanceof Tup) return v.a.slice();
  if (v instanceof Coll) return v.a.slice();
  if (v instanceof HSet) return v.items();
  if (v instanceof HMap) return v.keys();
  if (typeof v === 'string') { var lang = this.lang; return v.split('').map(function (c) { return lang === 'java' ? new Chr(c) : c; }); }
  if (v instanceof Range) { var out = []; var it = this.iterOf(v, line), r; while (!(r = it.next()).done) out.push(r.value); return out; }
  throw this.err('type', 'Esperaba algo recorrible (lista, texto, conjunto…) y he recibido ' + typeName(v, this.lang) + '.', line);
};

/* ---------- comprensiones ---------- */
Interp.prototype.comprehension = function (n, sc) {
  var self = this;
  var out = n.kind === 'set' ? new HSet() : n.kind === 'dict' ? new HMap() : [];
  var loops = n.loops;
  function step(k, scope) {
    if (k === loops.length) {
      self.tick(n.line);
      if (n.kind === 'dict') out.set(self.evl(n.elt, scope), self.evl(n.val, scope));
      else if (n.kind === 'set') out.add(self.evl(n.elt, scope));
      else out.push(self.evl(n.elt, scope));
      return;
    }
    var lp = loops[k];
    var it = self.iterOf(self.evl(lp.iter, scope), n.line), r;
    while (!(r = it.next()).done) {
      var s2 = new Scope(scope);
      self.assignTo(lp.target, r.value, s2, true);
      var ok = true;
      for (var i = 0; i < lp.ifs.length; i++) if (!truthy(self.evl(lp.ifs[i], s2), self.lang)) { ok = false; break; }
      if (ok) step(k + 1, s2);
    }
  }
  step(0, sc);
  return out;
};

/* ---------- llamadas ---------- */
Interp.prototype.evalArgs = function (args, sc) {
  var out = [];
  for (var i = 0; i < args.length; i++) {
    if (args[i].k === 'Star') out = out.concat(this.toArray(this.evl(args[i].e, sc), args[i].line));
    else out.push(this.evl(args[i], sc));
  }
  return out;
};

Interp.prototype.evalCall = function (n, sc) {
  var fnNode = n.fn, self = this;
  var thisArg = null, callee;

  if (fnNode.k === 'Attr') {
    var target = this.evl(fnNode.obj, sc);
    if (fnNode.opt && (target === null || target === undefined)) return null;
    callee = this.getMember(target, fnNode.name, n.line, fnNode.obj, true);
    thisArg = target;
  } else {
    callee = this.evl(fnNode, sc);
  }

  var args = this.evalArgs(n.args, sc);
  var kw = null;
  if (n.kwargs && n.kwargs.length) {
    kw = {};
    n.kwargs.forEach(function (k) {
      if (k.name === null) { var m = self.evl(k.value, sc); if (m instanceof HMap) m.entries().forEach(function (e) { kw[display(e.k, self.lang)] = e.v; }); }
      else kw[k.name] = self.evl(k.value, sc);
    });
  }
  return this.callValue(callee, args, n.line, kw, thisArg, fnNode);
};

Interp.prototype.callValue = function (callee, args, line, kw, thisArg, fnNode) {
  if (callee instanceof Bound) { thisArg = callee.self; callee = callee.fn; }

  if (callee && callee.__isSuper) {                       // super(...) / super()
    if (this.py) return callee;
    var sup = this.findMethod(callee.__super, 'constructor');
    if (sup) this.callValue(this.bindMethod(callee.__self, sup), args, line);
    return null;
  }

  if (callee instanceof Native) return callee.fn(args, line, kw);

  if (callee instanceof Cls) return this.construct(callee, args, line);

  if (!(callee instanceof Fun)) {
    var what = fnNode && fnNode.k === 'Name' ? '«' + fnNode.v + '»' : fnNode && fnNode.k === 'Attr' ? '«' + fnNode.name + '»' : 'eso';
    if (callee === undefined || callee === null) {
      throw this.err('attr', 'No existe la función ' + what + ', o vale ' + (this.py ? 'None' : 'null') + '. Comprueba el nombre y que esté definida.', line);
    }
    throw this.err('type', what + ' no es una función: es un valor de tipo ' + typeName(callee, this.lang) + '. ¿Sobran los paréntesis?', line);
  }

  if (++this.depth > 900) {
    this.depth--;
    throw this.err('rec', 'Demasiadas llamadas anidadas (más de 900). Casi siempre es una recursión sin caso base: comprueba que la función deje de llamarse a sí misma en algún momento.', line);
  }

  var scope = new Scope(callee.scope);
  if (callee.self !== undefined) {
    // En Python «self» es el primer parámetro declarado: se pasa como argumento.
    if (this.py) args = [callee.self].concat(args);
    else scope.declare('this', callee.self);
  } else if (thisArg !== null && thisArg !== undefined && !this.py) scope.declare('this', thisArg);
  if (callee.cls) scope.declare('__cls__', callee.cls);

  var ps = callee.params;
  var pi = 0;
  for (var i = 0; i < ps.length; i++) {
    var p = ps[i];
    if (p.star === 1) { scope.declare(p.name, args.slice(pi)); pi = args.length; continue; }
    if (p.star === 2) {
      var rest = new HMap();
      if (kw) for (var k in kw) if (!ps.some(function (q) { return q.name === k; })) rest.set(k, kw[k]);
      scope.declare(p.name, rest); continue;
    }
    var v;
    if (kw && Object.prototype.hasOwnProperty.call(kw, p.name)) v = kw[p.name];
    else if (pi < args.length) v = args[pi++];
    else if (p.def !== null && p.def !== undefined) v = this.evl(p.def, callee.scope);
    else if (this.lang === 'javascript') v = null;
    else {
      this.depth--;
      throw this.err('type', 'A la función «' + (callee.name || 'anónima') + '» le falta el argumento «' + p.name + '». Espera ' +
        ps.filter(function (q) { return q.def === null && !q.star; }).length + ' y le has pasado ' + args.length + '.', line);
    }
    scope.declare(p.name, v);
  }
  if (pi < args.length && this.lang !== 'javascript' && !ps.some(function (q) { return q.star; })) {
    this.depth--;
    throw this.err('type', 'La función «' + (callee.name || 'anónima') + '» recibe ' + ps.length + ' argumento(s) y le has pasado ' + args.length + '.', line);
  }

  try {
    if (callee.isExpr) return this.evl(callee.body, scope);
    this.exec(callee.body, scope);
    return this.lang === 'javascript' ? undefined : null;
  } catch (e) {
    if (e instanceof ReturnSig) return e.v;
    throw e;
  } finally {
    this.depth--;
  }
};

/* ---------- clases y objetos ---------- */
Interp.prototype.defineClass = function (n, sc) {
  var cls = new Cls(n.name, null);
  if (n.base) {
    var b = this.evl(n.base, sc);
    if (b instanceof Cls) cls.base = b;
  }
  sc.declare(n.name, cls);
  var self = this;

  if (n.members) {                              // Java / JavaScript
    n.members.forEach(function (m) {
      var list = m.kind === 'fields' ? m.list : [m];
      list.forEach(function (mm) {
        if (mm.k === 'Class') { self.defineClass(mm, sc); return; }
        if (mm.kind === 'method') {
          var f = new Fun(mm.name, mm.params, mm.body, sc, false);
          f.cls = cls;
          if (mm.stat) cls.statics[mm.name] = f; else cls.methods[mm.name] = f;
        } else if (mm.kind === 'field') {
          if (mm.stat) cls.statics[mm.name] = mm.init ? self.evl(mm.init, sc) : self.defaultFor(mm.type, mm.type ? mm.type.dims : 0);
          else cls.fieldInits.push(mm);
        }
      });
    });
    return cls;
  }

  // Python: se ejecuta el cuerpo de la clase en un ámbito propio
  var body = new Scope(sc);
  this.exec(n.body, body);
  for (var k in body.v) {
    var v = body.v[k];
    if (v instanceof Fun) { v.cls = cls; cls.methods[k] = v; }
    else cls.statics[k] = v;
  }
  return cls;
};

Interp.prototype.findMethod = function (cls, name) {
  var c = cls;
  while (c) { if (c.methods[name]) return { fn: c.methods[name], cls: c }; c = c.base; }
  return null;
};
Interp.prototype.findStatic = function (cls, name) {
  var c = cls;
  while (c) { if (Object.prototype.hasOwnProperty.call(c.statics, name)) return c.statics[name]; c = c.base; }
  return undefined;
};

Interp.prototype.construct = function (cls, args, line) {
  var o = new Obj(cls);
  var chain = [], c = cls;
  while (c) { chain.unshift(c); c = c.base; }
  var self = this;
  chain.forEach(function (cc) {
    cc.fieldInits.forEach(function (f) {
      o.f[f.name] = f.init ? self.evl(f.init, cls.scope || self.globals) : self.defaultFor(f.type, f.type ? f.type.dims : 0);
    });
  });
  var ctorName = this.py ? '__init__' : 'constructor';
  var found = this.findMethod(cls, ctorName);
  if (found) {
    var bound = Object.create(Fun.prototype);
    for (var k in found.fn) bound[k] = found.fn[k];
    bound.self = o; bound.cls = found.cls;
    this.callValue(bound, args, line);
  } else if (args.length && !this.py) {
    // constructor implícito: asigna los argumentos a los campos declarados, en orden
    var names = [];
    chain.forEach(function (cc) { cc.fieldInits.forEach(function (f) { names.push(f.name); }); });
    for (var i = 0; i < args.length && i < names.length; i++) o.f[names[i]] = args[i];
  }
  return o;
};

Interp.prototype.bindMethod = function (obj, found) {
  var bound = Object.create(Fun.prototype);
  for (var k in found.fn) bound[k] = found.fn[k];
  bound.name = found.fn.name; bound.params = found.fn.params; bound.body = found.fn.body;
  bound.scope = found.fn.scope; bound.isExpr = found.fn.isExpr;
  bound.self = obj; bound.cls = found.cls;
  return bound;
};

/* ---------- import (sólo módulos simulados) ---------- */
Interp.prototype.doImport = function (n, sc) {
  var self = this;
  if (n.from) {
    var mod = MODULES[n.from];
    n.names.forEach(function (nm) {
      if (nm.name === '*') { if (mod) for (var k in mod) sc.declare(k, mod[k](self)); return; }
      if (mod && mod[nm.name]) sc.declare(nm.as || nm.name, mod[nm.name](self));
      else if (!sc.has(nm.as || nm.name)) sc.declare(nm.as || nm.name, null);
    });
    return;
  }
  n.names.forEach(function (nm) {
    var mod = MODULES[nm.name];
    if (!mod) { sc.declare(nm.as || nm.name.split('.')[0], new Mod(nm.name, {})); return; }
    var members = {};
    for (var k in mod) members[k] = mod[k](self);
    sc.declare(nm.as || nm.name, new Mod(nm.name, members));
  });
};

/* ============================================================
   G. BIBLIOTECA ESTÁNDAR
   Lo que cada lenguaje trae "de fábrica": funciones globales y
   métodos de cada tipo. El despachador getMember decide qué
   tabla mirar según el lenguaje y el tipo del valor.
   ============================================================ */

function nat(name, fn) { return new Native(name, fn); }

/* ---------- montículo binario (heapq de Python, PriorityQueue de Java) ---------- */
function heapCmp(cmp, interp, line) {
  return cmp ? function (a, b) { return num(interp.callValue(cmp, [a, b], line)); } : cmpValues;
}
function siftUp(a, i, c) {
  while (i > 0) {
    var p = (i - 1) >> 1;
    if (c(a[i], a[p]) < 0) { var t = a[i]; a[i] = a[p]; a[p] = t; i = p; } else break;
  }
}
function siftDown(a, i, c) {
  var n = a.length;
  for (;;) {
    var l = 2 * i + 1, r = l + 1, m = i;
    if (l < n && c(a[l], a[m]) < 0) m = l;
    if (r < n && c(a[r], a[m]) < 0) m = r;
    if (m === i) return;
    var t = a[i]; a[i] = a[m]; a[m] = t; i = m;
  }
}
function heapPush(a, v, c) { a.push(v); siftUp(a, a.length - 1, c); }
function heapPop(a, c) {
  var top = a[0], last = a.pop();
  if (a.length) { a[0] = last; siftDown(a, 0, c); }
  return top;
}
function heapify(a, c) { for (var i = (a.length >> 1) - 1; i >= 0; i--) siftDown(a, i, c); }

/* ---------- operaciones de conjuntos ---------- */
function setOp(op, a, b, I, line) {
  var out = new HSet();
  if (op === '|') { a.items().forEach(function (x) { out.add(x); }); b.items().forEach(function (x) { out.add(x); }); return out; }
  if (op === '&') { a.items().forEach(function (x) { if (b.has(x)) out.add(x); }); return out; }
  if (op === '-') { a.items().forEach(function (x) { if (!b.has(x)) out.add(x); }); return out; }
  if (op === '^') {
    a.items().forEach(function (x) { if (!b.has(x)) out.add(x); });
    b.items().forEach(function (x) { if (!a.has(x)) out.add(x); });
    return out;
  }
  throw I.err('type', 'Los conjuntos no admiten el operador «' + op + '».', line);
}

/* ---------- helpers compartidos ---------- */
function asStr(v) { return v instanceof Chr ? v.c : typeof v === 'string' ? v : null; }
function chrOrStr(I, c) { return I.lang === 'java' ? new Chr(c) : c; }
function listOf(I, v, line) { return I.toArray(v, line); }

function sortArray(I, arr, key, cmp, reverse, line) {
  var dec = arr.map(function (v, i) { return { v: v, i: i, k: key ? I.callValue(key, [v], line) : v }; });
  dec.sort(function (a, b) {
    var c = cmp ? num(I.callValue(cmp, [a.v, b.v], line)) : cmpValues(a.k, b.k);
    if (c === 0) return a.i - b.i;
    return c;
  });
  var out = dec.map(function (d) { return d.v; });
  if (reverse) out.reverse();
  return out;
}

/* ============================================================
   Métodos de los tipos incorporados
   ============================================================ */
Interp.prototype.getMember = function (t, name, line, node, forCall) {
  var I = this, lang = this.lang;

  /* --- objetos de clases del alumno --- */
  if (t instanceof Obj) {
    if (name in t.f) {
      var fv = t.f[name];
      if (fv instanceof Fun && fv.self === undefined) { var b = Object.create(Fun.prototype); for (var q in fv) b[q] = fv[q]; b.self = t; return b; }
      return fv;
    }
    var m = this.findMethod(t.cls, name);
    if (m) return this.bindMethod(t, m);
    var st = this.findStatic(t.cls, name);
    if (st !== undefined) return st;
    if (forCall) throw this.err('attr', 'La clase «' + t.cls.name + '» no tiene ningún método llamado «' + name + '».', line);
    if (lang === 'javascript') return undefined;
    throw this.err('attr', 'El objeto de tipo «' + t.cls.name + '» no tiene ningún atributo «' + name + '». Los que tiene son: ' + (Object.keys(t.f).join(', ') || '(ninguno todavía)') + '.', line);
  }

  if (t instanceof Cls) {
    var s2 = this.findStatic(t, name);
    if (s2 !== undefined) return s2;
    var m2 = this.findMethod(t, name);
    if (m2) return m2.fn;
    throw this.err('attr', 'La clase «' + t.name + '» no tiene «' + name + '».', line);
  }

  if (t instanceof Mod) {
    if (name in t.m) return t.m[name];
    throw this.err('attr', 'El módulo «' + t.name + '» no tiene «' + name + '».', line);
  }

  /* --- super() / super.metodo() --- */
  if (t && t.__super) {
    var found = this.findMethod(t.__super, name);
    if (found) return this.bindMethod(t.__self, found);
    throw this.err('attr', 'La clase padre no tiene «' + name + '».', line);
  }

  if (t === null || t === undefined) {
    throw this.err('nul', 'Intentas usar «' + name + '» sobre algo que vale ' + (this.py ? 'None' : lang === 'java' ? 'null' : 'null/undefined') +
      '. Casi siempre significa que una función no devolvió nada (¿falta un return?) o que no inicializaste la variable.', line);
  }

  if (t instanceof Rx) {
    if (name === 'test') return nat('test', function (a) { return new RegExp(t.body, t.flags.replace('g', '')).test(display(a[0], lang)); });
    if (name === 'exec') return nat('exec', function (a) { var m = new RegExp(t.body, t.flags.replace('g', '')).exec(display(a[0], lang)); return m ? Array.prototype.slice.call(m) : null; });
    if (name === 'source') return t.body;
    if (name === 'flags') return t.flags;
    if (name === 'toString') return nat('toString', function () { return '/' + t.body + '/' + t.flags; });
    return undefined;
  }

  var r;
  if (typeof t === 'string' || t instanceof Chr) { r = strMember(I, t, name, line); if (r !== undefined) return r; }
  if (Array.isArray(t)) { r = arrMember(I, t, name, line); if (r !== undefined) return r; }
  if (t instanceof Coll) { r = collMember(I, t, name, line); if (r !== undefined) return r; }
  if (t instanceof HMap) { r = mapMember(I, t, name, line); if (r !== undefined) return r; }
  if (t instanceof HSet) { r = setMember(I, t, name, line); if (r !== undefined) return r; }
  if (t instanceof Tup) { r = arrMember(I, t.a, name, line); if (r !== undefined) return r; }
  if (isNum(t)) { r = numMember(I, t, name, line); if (r !== undefined) return r; }
  if (t instanceof Fun || t instanceof Native || t instanceof Bound) {
    if (name === 'call' || name === 'apply') return nat(name, function (a, ln) { return I.callValue(t, name === 'call' ? a.slice(1) : I.toArray(a[1] || [], ln), ln); });
    if (name === 'name') return t.name || '';
  }

  if (lang === 'javascript') return undefined;
  throw this.err('attr', 'Un valor de tipo ' + typeName(t, lang) + ' no tiene «' + name + '».', line);
};

/* ---------- cadenas ---------- */
function strMember(I, t, name, line) {
  var lang = I.lang;
  var s = t instanceof Chr ? t.c : t;
  var A = function (a, i, d) { return a.length > i ? a[i] : d; };

  if (t instanceof Chr) {
    if (name === 'compareTo') return nat(name, function (a) { return s.charCodeAt(0) - num(a[0]); });
    if (name === 'equals') return nat(name, function (a) { return eqValues(t, a[0]); });
    if (name === 'charValue') return nat(name, function () { return t; });
    if (name === 'toString') return nat(name, function () { return s; });
    return undefined;
  }

  if (lang === 'python') switch (name) {
    case 'upper': return nat(name, function () { return s.toUpperCase(); });
    case 'lower': return nat(name, function () { return s.toLowerCase(); });
    case 'strip': return nat(name, function (a) { return a.length ? trimChars(s, a[0], 3) : s.trim(); });
    case 'lstrip': return nat(name, function (a) { return a.length ? trimChars(s, a[0], 1) : s.replace(/^\s+/, ''); });
    case 'rstrip': return nat(name, function (a) { return a.length ? trimChars(s, a[0], 2) : s.replace(/\s+$/, ''); });
    case 'split': return nat(name, function (a) {
      if (!a.length || a[0] === null) return s.split(/\s+/).filter(function (x) { return x.length; });
      var parts = s.split(String(a[0]));
      if (a.length > 1) { var lim = num(a[1]); var head = parts.slice(0, lim); head.push(parts.slice(lim).join(String(a[0]))); return head; }
      return parts;
    });
    case 'rsplit': return nat(name, function (a) { return s.split(a.length ? String(a[0]) : /\s+/); });
    case 'splitlines': return nat(name, function () { return s.split('\n'); });
    case 'join': return nat(name, function (a, ln) { return I.toArray(a[0], ln).map(function (x) {
      if (typeof x !== 'string') throw I.err('type', 'join() sólo une textos; ha encontrado un ' + typeName(x, lang) + '. Convierte con str(...) o usa map(str, ...).', ln);
      return x; }).join(s); });
    case 'replace': return nat(name, function (a) { return s.split(String(asStr(a[0]))).join(String(asStr(a[1]))); });
    case 'find': return nat(name, function (a) { return s.indexOf(asStr(a[0]), a.length > 1 ? num(a[1]) : 0); });
    case 'rfind': return nat(name, function (a) { return s.lastIndexOf(asStr(a[0])); });
    case 'index': return nat(name, function (a, ln) { var i = s.indexOf(asStr(a[0])); if (i < 0) throw I.err('value', 'index(): «' + asStr(a[0]) + '» no está en el texto. Usa find(), que devuelve -1 en vez de fallar.', ln); return i; });
    case 'count': return nat(name, function (a) { var sub = asStr(a[0]); if (!sub) return s.length + 1; return s.split(sub).length - 1; });
    case 'startswith': return nat(name, function (a) { var p = a[0]; if (p instanceof Tup) return p.a.some(function (x) { return s.startsWith(x); }); return s.startsWith(asStr(p), a.length > 1 ? num(a[1]) : 0); });
    case 'endswith': return nat(name, function (a) { var p = a[0]; if (p instanceof Tup) return p.a.some(function (x) { return s.endsWith(x); }); return s.endsWith(asStr(p)); });
    case 'isalpha': return nat(name, function () { return s.length > 0 && /^[A-Za-zÀ-ÿñÑ]+$/.test(s); });
    case 'isdigit': case 'isnumeric': return nat(name, function () { return s.length > 0 && /^[0-9]+$/.test(s); });
    case 'isalnum': return nat(name, function () { return s.length > 0 && /^[A-Za-z0-9À-ÿñÑ]+$/.test(s); });
    case 'isspace': return nat(name, function () { return s.length > 0 && /^\s+$/.test(s); });
    case 'isupper': return nat(name, function () { return /[A-Za-z]/.test(s) && s === s.toUpperCase(); });
    case 'islower': return nat(name, function () { return /[A-Za-z]/.test(s) && s === s.toLowerCase(); });
    case 'title': return nat(name, function () { return s.replace(/\w\S*/g, function (w) { return w[0].toUpperCase() + w.slice(1).toLowerCase(); }); });
    case 'capitalize': return nat(name, function () { return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase(); });
    case 'swapcase': return nat(name, function () { return s.replace(/[a-zA-ZÀ-ÿ]/g, function (c) { return c === c.toLowerCase() ? c.toUpperCase() : c.toLowerCase(); }); });
    case 'zfill': return nat(name, function (a) { return s.padStart(num(a[0]), '0'); });
    case 'ljust': return nat(name, function (a) { return s.padEnd(num(a[0]), a.length > 1 ? asStr(a[1]) : ' '); });
    case 'rjust': return nat(name, function (a) { return s.padStart(num(a[0]), a.length > 1 ? asStr(a[1]) : ' '); });
    case 'center': return nat(name, function (a) { var w = num(a[0]); var total = w - s.length; if (total <= 0) return s; var l = Math.floor(total / 2); return ' '.repeat(l) + s + ' '.repeat(total - l); });
    case 'removeprefix': return nat(name, function (a) { return s.startsWith(asStr(a[0])) ? s.slice(asStr(a[0]).length) : s; });
    case 'removesuffix': return nat(name, function (a) { return s.endsWith(asStr(a[0])) ? s.slice(0, -asStr(a[0]).length) : s; });
    case 'format': return nat(name, function (a) { var i = 0; return s.replace(/\{([^}]*)\}/g, function (all, sp) { var c = sp.indexOf(':'); var f = c > -1 ? sp.slice(c + 1) : ''; return applyFormat(a[i++], f, lang); }); });
    case 'encode': return nat(name, function () { return s; });
    case 'casefold': return nat(name, function () { return s.toLowerCase(); });
  }

  if (lang === 'java') switch (name) {
    case 'length': return nat(name, function () { return s.length; });
    case 'charAt': return nat(name, function (a, ln) { return new Chr(s[I.normIndex(a[0], s.length, ln)]); });
    case 'substring': return nat(name, function (a, ln) {
      var b = Math.trunc(num(a[0])), e = a.length > 1 ? Math.trunc(num(a[1])) : s.length;
      if (b < 0 || e > s.length || b > e) throw I.err('index', 'substring(' + b + ', ' + e + ') se sale del texto, que tiene ' + s.length + ' caracteres.', ln);
      return s.slice(b, e);
    });
    case 'indexOf': return nat(name, function (a) { return s.indexOf(asStr(a[0]), a.length > 1 ? num(a[1]) : 0); });
    case 'lastIndexOf': return nat(name, function (a) { return s.lastIndexOf(asStr(a[0])); });
    case 'equals': return nat(name, function (a) { return typeof a[0] === 'string' && s === a[0]; });
    case 'equalsIgnoreCase': return nat(name, function (a) { return typeof a[0] === 'string' && s.toLowerCase() === a[0].toLowerCase(); });
    case 'compareTo': return nat(name, function (a) { var o = asStr(a[0]); return s < o ? -1 : s > o ? 1 : 0; });
    case 'compareToIgnoreCase': return nat(name, function (a) { var o = asStr(a[0]).toLowerCase(), x = s.toLowerCase(); return x < o ? -1 : x > o ? 1 : 0; });
    case 'toCharArray': return nat(name, function () { return s.split('').map(function (c) { return new Chr(c); }); });
    case 'split': return nat(name, function (a) { var sep = asStr(a[0]); return s.split(sep === ' ' ? /\s+/ : new RegExp(sep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).filter(function (x, i, arr) { return !(x === '' && i === arr.length - 1); }); });
    case 'toLowerCase': return nat(name, function () { return s.toLowerCase(); });
    case 'toUpperCase': return nat(name, function () { return s.toUpperCase(); });
    case 'trim': case 'strip': return nat(name, function () { return s.trim(); });
    case 'contains': return nat(name, function (a) { return s.indexOf(asStr(a[0])) > -1; });
    case 'replace': return nat(name, function (a) { return s.split(asStr(a[0])).join(asStr(a[1])); });
    case 'replaceAll': return nat(name, function (a) { return s.replace(new RegExp(asStr(a[0]), 'g'), asStr(a[1])); });
    case 'startsWith': return nat(name, function (a) { return s.startsWith(asStr(a[0])); });
    case 'endsWith': return nat(name, function (a) { return s.endsWith(asStr(a[0])); });
    case 'isEmpty': return nat(name, function () { return s.length === 0; });
    case 'isBlank': return nat(name, function () { return s.trim().length === 0; });
    case 'concat': return nat(name, function (a) { return s + asStr(a[0]); });
    case 'repeat': return nat(name, function (a) { return s.repeat(num(a[0])); });
    case 'matches': return nat(name, function (a) { return new RegExp('^(' + asStr(a[0]) + ')$').test(s); });
    case 'hashCode': return nat(name, function () { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; });
    case 'toString': return nat(name, function () { return s; });
    case 'chars': return nat(name, function () { return s.split('').map(function (c) { return c.charCodeAt(0); }); });
  }

  if (lang === 'javascript') switch (name) {
    case 'length': return s.length;
    case 'charAt': return nat(name, function (a) { return s.charAt(num(a[0])); });
    case 'charCodeAt': return nat(name, function (a) { return s.charCodeAt(a.length ? num(a[0]) : 0); });
    case 'codePointAt': return nat(name, function (a) { return s.codePointAt(a.length ? num(a[0]) : 0); });
    case 'at': return nat(name, function (a) { return s.at(num(a[0])); });
    case 'indexOf': return nat(name, function (a) { return s.indexOf(asStr(a[0]), a.length > 1 ? num(a[1]) : 0); });
    case 'lastIndexOf': return nat(name, function (a) { return s.lastIndexOf(asStr(a[0])); });
    case 'slice': return nat(name, function (a) { return a.length > 1 ? s.slice(num(a[0]), num(a[1])) : s.slice(a.length ? num(a[0]) : 0); });
    case 'substring': return nat(name, function (a) { return a.length > 1 ? s.substring(num(a[0]), num(a[1])) : s.substring(num(a[0])); });
    case 'split': return nat(name, function (a) { return a.length ? s.split(a[0] instanceof Rx ? a[0].re : asStr(a[0])) : [s]; });
    case 'match': return nat(name, function (a) { var m = s.match(a[0] instanceof Rx ? a[0].re : asStr(a[0])); return m ? Array.prototype.slice.call(m) : null; });
    case 'search': return nat(name, function (a) { return s.search(a[0] instanceof Rx ? a[0].re : asStr(a[0])); });
    case 'toUpperCase': return nat(name, function () { return s.toUpperCase(); });
    case 'toLowerCase': return nat(name, function () { return s.toLowerCase(); });
    case 'trim': return nat(name, function () { return s.trim(); });
    case 'trimStart': return nat(name, function () { return s.replace(/^\s+/, ''); });
    case 'trimEnd': return nat(name, function () { return s.replace(/\s+$/, ''); });
    case 'includes': return nat(name, function (a) { return s.indexOf(asStr(a[0])) > -1; });
    case 'startsWith': return nat(name, function (a) { return s.startsWith(asStr(a[0])); });
    case 'endsWith': return nat(name, function (a) { return s.endsWith(asStr(a[0])); });
    case 'replace': case 'replaceAll': return nat(name, function (a, ln) {
      var busca = a[0] instanceof Rx ? (name === 'replaceAll' && a[0].flags.indexOf('g') < 0 ? new RegExp(a[0].body, a[0].flags + 'g') : a[0].re) : asStr(a[0]);
      var pone = (a[1] instanceof Fun || a[1] instanceof Native || a[1] instanceof Bound)
        ? function () { var args = Array.prototype.slice.call(arguments); return display(I.callValue(a[1], args.slice(0, -2), ln), lang); }
        : asStr(a[1]);
      return (name === 'replaceAll' && typeof busca === 'string') ? s.split(busca).join(pone) : s.replace(busca, pone);
    });
    case 'repeat': return nat(name, function (a) { return s.repeat(num(a[0])); });
    case 'padStart': return nat(name, function (a) { return s.padStart(num(a[0]), a.length > 1 ? asStr(a[1]) : ' '); });
    case 'padEnd': return nat(name, function (a) { return s.padEnd(num(a[0]), a.length > 1 ? asStr(a[1]) : ' '); });
    case 'concat': return nat(name, function (a) { return s + a.map(function (x) { return display(x, lang); }).join(''); });
    case 'toString': return nat(name, function () { return s; });
    case 'localeCompare': return nat(name, function (a) { var o = asStr(a[0]); return s < o ? -1 : s > o ? 1 : 0; });
  }
  return undefined;
}
function trimChars(s, chars, mode) {
  var set = String(chars);
  var a = 0, b = s.length;
  if (mode & 1) while (a < b && set.indexOf(s[a]) > -1) a++;
  if (mode & 2) while (b > a && set.indexOf(s[b - 1]) > -1) b--;
  return s.slice(a, b);
}

/* ---------- números ---------- */
function numMember(I, t, name, line) {
  if (I.lang === 'java') {
    if (name === 'compareTo') return nat(name, function (a) { return num(t) - num(a[0]); });
    if (name === 'equals') return nat(name, function (a) { return eqValues(t, a[0]); });
    if (name === 'intValue') return nat(name, function () { return Math.trunc(num(t)); });
    if (name === 'doubleValue') return nat(name, function () { return new Flo(num(t)); });
    if (name === 'toString') return nat(name, function () { return javaStr(t); });
  }
  if (I.lang === 'javascript') {
    if (name === 'toFixed') return nat(name, function (a) { return num(t).toFixed(a.length ? num(a[0]) : 0); });
    if (name === 'toString') return nat(name, function (a) { return a.length ? num(t).toString(num(a[0])) : String(num(t)); });
  }
  return undefined;
}

/* ---------- listas y arrays ---------- */
function arrMember(I, t, name, line) {
  var lang = I.lang;
  if (lang === 'java') switch (name) {
    case 'length': return t.length;
    case 'clone': return nat(name, function () { return t.slice(); });
    case 'toString': return nat(name, function () { return javaStr(t); });
    // permitimos también los métodos de List sobre arrays sencillos
    case 'size': return nat(name, function () { return t.length; });
    case 'get': return nat(name, function (a, ln) { return t[I.normIndex(a[0], t.length, ln)]; });
  }
  if (lang === 'python') switch (name) {
    case 'append': return nat(name, function (a, ln) { if (!a.length) throw I.err('type', 'append() necesita exactamente un valor.', ln); t.push(a[0]); return null; });
    case 'extend': return nat(name, function (a, ln) { I.toArray(a[0], ln).forEach(function (x) { t.push(x); }); return null; });
    case 'insert': return nat(name, function (a) { var i = Math.trunc(num(a[0])); if (i < 0) i += t.length; t.splice(Math.max(0, Math.min(i, t.length)), 0, a[1]); return null; });
    case 'pop': return nat(name, function (a, ln) {
      if (!t.length) throw I.err('index', 'pop() de una lista vacía. Comprueba antes con «if lista:».', ln);
      var i = a.length ? I.normIndex(a[0], t.length, ln) : t.length - 1;
      return t.splice(i, 1)[0];
    });
    case 'remove': return nat(name, function (a, ln) {
      for (var i = 0; i < t.length; i++) if (eqValues(t[i], a[0])) { t.splice(i, 1); return null; }
      throw I.err('value', 'remove(): el valor ' + displayInner(a[0], lang) + ' no está en la lista.', ln);
    });
    case 'index': return nat(name, function (a, ln) {
      for (var i = a.length > 1 ? num(a[1]) : 0; i < t.length; i++) if (eqValues(t[i], a[0])) return i;
      throw I.err('value', 'index(): el valor ' + displayInner(a[0], lang) + ' no está en la lista.', ln);
    });
    case 'count': return nat(name, function (a) { var c = 0; t.forEach(function (x) { if (eqValues(x, a[0])) c++; }); return c; });
    case 'sort': return nat(name, function (a, ln, kw) {
      var res = sortArray(I, t, kw && kw.key, null, kw && truthy(kw.reverse, lang), ln);
      t.length = 0; res.forEach(function (x) { t.push(x); }); return null;
    });
    case 'reverse': return nat(name, function () { t.reverse(); return null; });
    case 'clear': return nat(name, function () { t.length = 0; return null; });
    case 'copy': return nat(name, function () { return t.slice(); });
  }
  if (lang === 'javascript') switch (name) {
    case 'length': return t.length;
    case 'push': return nat(name, function (a) { a.forEach(function (x) { t.push(x); }); return t.length; });
    case 'pop': return nat(name, function () { return t.length ? t.pop() : undefined; });
    case 'shift': return nat(name, function () { return t.length ? t.shift() : undefined; });
    case 'unshift': return nat(name, function (a) { t.unshift.apply(t, a); return t.length; });
    case 'slice': return nat(name, function (a) { return a.length > 1 ? t.slice(num(a[0]), num(a[1])) : t.slice(a.length ? num(a[0]) : 0); });
    case 'splice': return nat(name, function (a) { return t.splice.apply(t, [num(a[0]), a.length > 1 ? num(a[1]) : t.length].concat(a.slice(2))); });
    case 'concat': return nat(name, function (a, ln) { var o = t.slice(); a.forEach(function (x) { o = o.concat(Array.isArray(x) ? x : [x]); }); return o; });
    case 'join': return nat(name, function (a) { return t.map(function (x) { return x === null || x === undefined ? '' : display(x, lang); }).join(a.length ? display(a[0], lang) : ','); });
    case 'indexOf': return nat(name, function (a) { for (var i = 0; i < t.length; i++) if (eqValues(t[i], a[0])) return i; return -1; });
    case 'lastIndexOf': return nat(name, function (a) { for (var i = t.length - 1; i >= 0; i--) if (eqValues(t[i], a[0])) return i; return -1; });
    case 'includes': return nat(name, function (a) { return t.some(function (x) { return eqValues(x, a[0]); }); });
    case 'find': return nat(name, function (a, ln) { for (var i = 0; i < t.length; i++) if (truthy(I.callValue(a[0], [t[i], i, t], ln), lang)) return t[i]; return undefined; });
    case 'findIndex': return nat(name, function (a, ln) { for (var i = 0; i < t.length; i++) if (truthy(I.callValue(a[0], [t[i], i, t], ln), lang)) return i; return -1; });
    case 'filter': return nat(name, function (a, ln) { var o = []; t.forEach(function (x, i) { if (truthy(I.callValue(a[0], [x, i, t], ln), lang)) o.push(x); }); return o; });
    case 'map': return nat(name, function (a, ln) { return t.map(function (x, i) { return I.callValue(a[0], [x, i, t], ln); }); });
    case 'reduce': return nat(name, function (a, ln) {
      var acc, start = 0;
      if (a.length > 1) acc = a[1]; else { if (!t.length) throw I.err('type', 'reduce() de un array vacío y sin valor inicial.', ln); acc = t[0]; start = 1; }
      for (var i = start; i < t.length; i++) acc = I.callValue(a[0], [acc, t[i], i, t], ln);
      return acc;
    });
    case 'forEach': return nat(name, function (a, ln) { t.forEach(function (x, i) { I.callValue(a[0], [x, i, t], ln); }); return undefined; });
    case 'some': return nat(name, function (a, ln) { return t.some(function (x, i) { return truthy(I.callValue(a[0], [x, i, t], ln), lang); }); });
    case 'every': return nat(name, function (a, ln) { return t.every(function (x, i) { return truthy(I.callValue(a[0], [x, i, t], ln), lang); }); });
    case 'sort': return nat(name, function (a, ln) { var r = sortArray(I, t, null, a[0] || null, false, ln); t.length = 0; r.forEach(function (x) { t.push(x); }); return t; });
    case 'reverse': return nat(name, function () { t.reverse(); return t; });
    case 'fill': return nat(name, function (a) { var b = a.length > 1 ? num(a[1]) : 0, e = a.length > 2 ? num(a[2]) : t.length; for (var i = b; i < e; i++) t[i] = a[0]; return t; });
    case 'flat': return nat(name, function (a) { var d = a.length ? num(a[0]) : 1; var f = function (arr, k) { return arr.reduce(function (o, x) { return o.concat(Array.isArray(x) && k > 0 ? f(x, k - 1) : [x]); }, []); }; return f(t, d); });
    case 'at': return nat(name, function (a) { var i = num(a[0]); if (i < 0) i += t.length; return t[i]; });
    case 'toString': return nat(name, function () { return t.map(function (x) { return display(x, lang); }).join(','); });
  }
  return undefined;
}

/* ---------- pilas, colas, listas de Java y deques de Python ---------- */
function collMember(I, t, name, line) {
  var lang = I.lang, a = t.a;
  var empty = function (ln) { throw I.err('index', 'Has intentado sacar un elemento de una estructura vacía. Comprueba antes el tamaño.', ln); };

  if (t.kind === 'sb') switch (name) {                    // StringBuilder
    case 'append': return nat(name, function (arg) { t.s += display(arg[0], lang); return t; });
    case 'toString': return nat(name, function () { return t.s; });
    case 'length': return nat(name, function () { return t.s.length; });
    case 'charAt': return nat(name, function (arg, ln) { return new Chr(t.s[I.normIndex(arg[0], t.s.length, ln)]); });
    case 'reverse': return nat(name, function () { t.s = t.s.split('').reverse().join(''); return t; });
    case 'insert': return nat(name, function (arg) { var i = num(arg[0]); t.s = t.s.slice(0, i) + display(arg[1], lang) + t.s.slice(i); return t; });
    case 'deleteCharAt': return nat(name, function (arg, ln) { var i = I.normIndex(arg[0], t.s.length, ln); t.s = t.s.slice(0, i) + t.s.slice(i + 1); return t; });
    case 'setCharAt': return nat(name, function (arg, ln) { var i = I.normIndex(arg[0], t.s.length, ln); t.s = t.s.slice(0, i) + asStr(arg[1]) + t.s.slice(i + 1); return t; });
    case 'setLength': return nat(name, function (arg) { var n = num(arg[0]); t.s = t.s.length > n ? t.s.slice(0, n) : t.s.padEnd(n, '\0'); return null; });
    case 'indexOf': return nat(name, function (arg) { return t.s.indexOf(asStr(arg[0])); });
    case 'isEmpty': return nat(name, function () { return t.s.length === 0; });
  }

  if (t.kind === 'pq') switch (name) {
    case 'offer': case 'add': return nat(name, function (arg, ln) { heapPush(a, arg[0], heapCmp(t.cmp, I, ln)); return true; });
    case 'poll': case 'remove': return nat(name, function (arg, ln) { return a.length ? heapPop(a, heapCmp(t.cmp, I, ln)) : (lang === 'java' && name === 'remove' ? empty(ln) : null); });
    case 'peek': case 'element': return nat(name, function () { return a.length ? a[0] : null; });
    case 'size': return nat(name, function () { return a.length; });
    case 'isEmpty': return nat(name, function () { return a.length === 0; });
    case 'contains': return nat(name, function (arg) { return a.some(function (x) { return eqValues(x, arg[0]); }); });
    case 'clear': return nat(name, function () { a.length = 0; return null; });
    case 'toString': return nat(name, function () { return javaStr(a); });
  }

  if (lang === 'python' && t.kind === 'deque') switch (name) {   // collections.deque
    case 'append': return nat(name, function (arg) { a.push(arg[0]); return null; });
    case 'appendleft': return nat(name, function (arg) { a.unshift(arg[0]); return null; });
    case 'pop': return nat(name, function (arg, ln) { return a.length ? a.pop() : empty(ln); });
    case 'popleft': return nat(name, function (arg, ln) { return a.length ? a.shift() : empty(ln); });
    case 'extend': return nat(name, function (arg, ln) { I.toArray(arg[0], ln).forEach(function (x) { a.push(x); }); return null; });
    case 'extendleft': return nat(name, function (arg, ln) { I.toArray(arg[0], ln).forEach(function (x) { a.unshift(x); }); return null; });
    case 'clear': return nat(name, function () { a.length = 0; return null; });
    case 'count': return nat(name, function (arg) { return a.filter(function (x) { return eqValues(x, arg[0]); }).length; });
    case 'rotate': return nat(name, function (arg) { var k = arg.length ? num(arg[0]) : 1; for (var i = 0; i < k; i++) a.unshift(a.pop()); return null; });
    case 'remove': return nat(name, function (arg, ln) { for (var i = 0; i < a.length; i++) if (eqValues(a[i], arg[0])) { a.splice(i, 1); return null; } throw I.err('value', 'remove(): no está en la deque.', ln); });
    case 'index': return nat(name, function (arg, ln) { for (var i = 0; i < a.length; i++) if (eqValues(a[i], arg[0])) return i; throw I.err('value', 'index(): no está en la deque.', ln); });
    case 'reverse': return nat(name, function () { a.reverse(); return null; });
    case 'copy': return nat(name, function () { return new Coll('deque', a.slice()); });
  }

  // Java: List, Stack, Deque, Queue
  switch (name) {
    case 'add': return nat(name, function (arg) {
      if (t.kind === 'deque') { a.push(arg[0]); return true; }
      if (arg.length > 1) { a.splice(Math.trunc(num(arg[0])), 0, arg[1]); return null; }
      a.push(arg[0]); return true;
    });
    case 'addLast': case 'offerLast': case 'offer': return nat(name, function (arg) { a.push(arg[0]); return true; });
    case 'addFirst': case 'offerFirst': return nat(name, function (arg) { a.unshift(arg[0]); return true; });
    case 'push': return nat(name, function (arg) { if (t.kind === 'deque') a.unshift(arg[0]); else a.push(arg[0]); return arg[0]; });
    case 'pop': return nat(name, function (arg, ln) { if (!a.length) return empty(ln); return t.kind === 'deque' ? a.shift() : a.pop(); });
    case 'peek': return nat(name, function () { if (!a.length) return t.kind === 'stack' ? null : null; return t.kind === 'stack' ? a[a.length - 1] : a[0]; });
    case 'peekFirst': case 'element': case 'getFirst': return nat(name, function (arg, ln) { return a.length ? a[0] : (name === 'getFirst' ? empty(ln) : null); });
    case 'peekLast': case 'getLast': return nat(name, function (arg, ln) { return a.length ? a[a.length - 1] : (name === 'getLast' ? empty(ln) : null); });
    case 'poll': case 'pollFirst': case 'removeFirst': return nat(name, function (arg, ln) { return a.length ? a.shift() : (name === 'removeFirst' ? empty(ln) : null); });
    case 'pollLast': case 'removeLast': return nat(name, function (arg, ln) { return a.length ? a.pop() : (name === 'removeLast' ? empty(ln) : null); });
    case 'get': return nat(name, function (arg, ln) { return a[I.normIndex(arg[0], a.length, ln)]; });
    case 'set': return nat(name, function (arg, ln) { var i = I.normIndex(arg[0], a.length, ln); var old = a[i]; a[i] = arg[1]; return old; });
    case 'size': return nat(name, function () { return a.length; });
    case 'isEmpty': case 'empty': return nat(name, function () { return a.length === 0; });
    case 'contains': return nat(name, function (arg) { return a.some(function (x) { return eqValues(x, arg[0]); }); });
    case 'indexOf': return nat(name, function (arg) { for (var i = 0; i < a.length; i++) if (eqValues(a[i], arg[0])) return i; return -1; });
    case 'lastIndexOf': return nat(name, function (arg) { for (var i = a.length - 1; i >= 0; i--) if (eqValues(a[i], arg[0])) return i; return -1; });
    case 'remove': return nat(name, function (arg, ln) {
      if (!arg.length) { if (!a.length) return empty(ln); return t.kind === 'deque' ? a.shift() : a.pop(); }
      if (typeof arg[0] === 'number') return a.splice(I.normIndex(arg[0], a.length, ln), 1)[0];
      for (var i = 0; i < a.length; i++) if (eqValues(a[i], arg[0])) { a.splice(i, 1); return true; }
      return false;
    });
    case 'clear': return nat(name, function () { a.length = 0; return null; });
    case 'addAll': return nat(name, function (arg, ln) { I.toArray(arg[arg.length - 1], ln).forEach(function (x) { a.push(x); }); return true; });
    case 'sort': return nat(name, function (arg, ln) { var r = sortArray(I, a, null, arg[0] || null, false, ln); a.length = 0; r.forEach(function (x) { a.push(x); }); return null; });
    case 'subList': return nat(name, function (arg) { return new Coll('list', a.slice(num(arg[0]), num(arg[1]))); });
    case 'toArray': return nat(name, function () { return a.slice(); });
    case 'forEach': return nat(name, function (arg, ln) { a.slice().forEach(function (x) { I.callValue(arg[0], [x], ln); }); return null; });
    case 'iterator': return nat(name, function () { return a.slice(); });
    case 'toString': return nat(name, function () { return javaStr(a); });
    case 'search': return nat(name, function (arg) { for (var i = a.length - 1, d = 1; i >= 0; i--, d++) if (eqValues(a[i], arg[0])) return d; return -1; });
    case 'length': return a.length;
  }
  return undefined;
}

/* ---------- diccionarios ---------- */
function mapMember(I, t, name, line) {
  var lang = I.lang;
  if (lang === 'python') switch (name) {
    case 'get': return nat(name, function (a) { return t.has(a[0]) ? t.get(a[0]) : (a.length > 1 ? a[1] : null); });
    case 'keys': return nat(name, function () { return t.keys(); });
    case 'values': return nat(name, function () { return t.values(); });
    case 'items': return nat(name, function () { return t.entries().map(function (e) { return new Tup([e.k, e.v]); }); });
    case 'pop': return nat(name, function (a, ln) {
      if (t.has(a[0])) { var v = t.get(a[0]); t.del(a[0]); return v; }
      if (a.length > 1) return a[1];
      throw I.err('key', 'pop(): la clave ' + displayInner(a[0], lang) + ' no está en el diccionario.', ln);
    });
    case 'popitem': return nat(name, function (a, ln) { var es = t.entries(); if (!es.length) throw I.err('key', 'popitem() de un diccionario vacío.', ln); var last = es[es.length - 1]; t.del(last.k); return new Tup([last.k, last.v]); });
    case 'setdefault': return nat(name, function (a) { if (!t.has(a[0])) t.set(a[0], a.length > 1 ? a[1] : null); return t.get(a[0]); });
    case 'update': return nat(name, function (a, ln) {
      if (a[0] instanceof HMap) a[0].entries().forEach(function (e) { t.set(e.k, e.v); });
      else if (Array.isArray(a[0])) a[0].forEach(function (p) { var q = I.toArray(p, ln); t.set(q[0], q[1]); });
      return null;
    });
    case 'clear': return nat(name, function () { t.m.clear(); return null; });
    case 'copy': return nat(name, function () { var o = new HMap(); t.entries().forEach(function (e) { o.set(e.k, e.v); }); return o; });
  }
  if (lang === 'java') switch (name) {
    case 'put': return nat(name, function (a) { var old = t.has(a[0]) ? t.get(a[0]) : null; t.set(a[0], a[1]); return old; });
    case 'get': return nat(name, function (a) { return t.has(a[0]) ? t.get(a[0]) : null; });
    case 'getOrDefault': return nat(name, function (a) { return t.has(a[0]) ? t.get(a[0]) : a[1]; });
    case 'containsKey': return nat(name, function (a) { return t.has(a[0]); });
    case 'containsValue': return nat(name, function (a) { return t.values().some(function (v) { return eqValues(v, a[0]); }); });
    case 'remove': return nat(name, function (a) { var v = t.has(a[0]) ? t.get(a[0]) : null; t.del(a[0]); return v; });
    case 'size': return nat(name, function () { return t.m.size; });
    case 'isEmpty': return nat(name, function () { return t.m.size === 0; });
    case 'keySet': return nat(name, function () { var s = new HSet(t.sorted); t.keys().forEach(function (k) { s.add(k); }); return s; });
    case 'values': return nat(name, function () { return new Coll('list', t.values()); });
    case 'entrySet': return nat(name, function () { return t.entries().map(function (e) { var o = new HMap(); o.set('__entry', true); o.set('key', e.k); o.set('value', e.v); o.__entry = e; return o; }); });
    case 'putIfAbsent': return nat(name, function (a) { if (!t.has(a[0])) { t.set(a[0], a[1]); return null; } return t.get(a[0]); });
    case 'merge': return nat(name, function (a, ln) { var nv = t.has(a[0]) ? I.callValue(a[2], [t.get(a[0]), a[1]], ln) : a[1]; t.set(a[0], nv); return nv; });
    case 'computeIfAbsent': return nat(name, function (a, ln) { if (!t.has(a[0])) t.set(a[0], I.callValue(a[1], [a[0]], ln)); return t.get(a[0]); });
    case 'compute': return nat(name, function (a, ln) { var nv = I.callValue(a[1], [a[0], t.has(a[0]) ? t.get(a[0]) : null], ln); t.set(a[0], nv); return nv; });
    case 'forEach': return nat(name, function (a, ln) { t.entries().forEach(function (e) { I.callValue(a[0], [e.k, e.v], ln); }); return null; });
    case 'clear': return nat(name, function () { t.m.clear(); return null; });
    case 'firstKey': return nat(name, function () { var k = t.keys(); return k.length ? k[0] : null; });
    case 'lastKey': return nat(name, function () { var k = t.keys(); return k.length ? k[k.length - 1] : null; });
    case 'toString': return nat(name, function () { return javaStr(t); });
    case 'getKey': return t.__entry ? nat(name, function () { return t.__entry.k; }) : undefined;
    case 'getValue': return t.__entry ? nat(name, function () { return t.__entry.v; }) : undefined;
  }
  if (lang === 'javascript') {
    if (t.obj) {                                       // objeto literal: acceso por propiedad
      if (t.has(name)) return t.get(name);
      if (name === 'hasOwnProperty') return nat(name, function (a) { return t.has(display(a[0], lang)); });
      if (name === 'toString') return nat(name, function () { return '[object Object]'; });
      return undefined;
    }
    switch (name) {                                    // Map
      case 'get': return nat(name, function (a) { return t.has(a[0]) ? t.get(a[0]) : undefined; });
      case 'set': return nat(name, function (a) { t.set(a[0], a[1]); return t; });
      case 'has': return nat(name, function (a) { return t.has(a[0]); });
      case 'delete': return nat(name, function (a) { return t.del(a[0]); });
      case 'size': return t.m.size;
      case 'keys': return nat(name, function () { return t.keys(); });
      case 'values': return nat(name, function () { return t.values(); });
      case 'entries': return nat(name, function () { return t.entries().map(function (e) { return [e.k, e.v]; }); });
      case 'forEach': return nat(name, function (a, ln) { t.entries().forEach(function (e) { I.callValue(a[0], [e.v, e.k, t], ln); }); return undefined; });
      case 'clear': return nat(name, function () { t.m.clear(); return undefined; });
    }
  }
  return undefined;
}

/* ---------- conjuntos ---------- */
function setMember(I, t, name, line) {
  var lang = I.lang;
  var other = function (x, ln) { var s = new HSet(); I.toArray(x, ln).forEach(function (y) { s.add(y); }); return s; };
  if (lang === 'python') switch (name) {
    case 'add': return nat(name, function (a) { t.add(a[0]); return null; });
    case 'remove': return nat(name, function (a, ln) { if (!t.del(a[0])) throw I.err('key', 'remove(): ' + displayInner(a[0], lang) + ' no está en el conjunto. Usa discard() si puede no estar.', ln); return null; });
    case 'discard': return nat(name, function (a) { t.del(a[0]); return null; });
    case 'pop': return nat(name, function (a, ln) { var it = t.items(); if (!it.length) throw I.err('key', 'pop() de un conjunto vacío.', ln); t.del(it[0]); return it[0]; });
    case 'union': return nat(name, function (a, ln) { return setOp('|', t, other(a[0], ln), I, ln); });
    case 'intersection': return nat(name, function (a, ln) { return setOp('&', t, other(a[0], ln), I, ln); });
    case 'difference': return nat(name, function (a, ln) { return setOp('-', t, other(a[0], ln), I, ln); });
    case 'symmetric_difference': return nat(name, function (a, ln) { return setOp('^', t, other(a[0], ln), I, ln); });
    case 'issubset': return nat(name, function (a, ln) { var o = other(a[0], ln); return t.items().every(function (x) { return o.has(x); }); });
    case 'issuperset': return nat(name, function (a, ln) { var o = other(a[0], ln); return o.items().every(function (x) { return t.has(x); }); });
    case 'isdisjoint': return nat(name, function (a, ln) { var o = other(a[0], ln); return !t.items().some(function (x) { return o.has(x); }); });
    case 'update': return nat(name, function (a, ln) { I.toArray(a[0], ln).forEach(function (x) { t.add(x); }); return null; });
    case 'clear': return nat(name, function () { t.m.clear(); return null; });
    case 'copy': return nat(name, function () { var s = new HSet(); t.items().forEach(function (x) { s.add(x); }); return s; });
  }
  if (lang === 'java') switch (name) {
    case 'add': return nat(name, function (a) { return t.add(a[0]); });
    case 'remove': return nat(name, function (a) { return t.del(a[0]); });
    case 'contains': return nat(name, function (a) { return t.has(a[0]); });
    case 'size': return nat(name, function () { return t.m.size; });
    case 'isEmpty': return nat(name, function () { return t.m.size === 0; });
    case 'clear': return nat(name, function () { t.m.clear(); return null; });
    case 'addAll': return nat(name, function (a, ln) { I.toArray(a[0], ln).forEach(function (x) { t.add(x); }); return true; });
    case 'retainAll': return nat(name, function (a, ln) { var o = other(a[0], ln); t.items().forEach(function (x) { if (!o.has(x)) t.del(x); }); return true; });
    case 'removeAll': return nat(name, function (a, ln) { I.toArray(a[0], ln).forEach(function (x) { t.del(x); }); return true; });
    case 'containsAll': return nat(name, function (a, ln) { return I.toArray(a[0], ln).every(function (x) { return t.has(x); }); });
    case 'forEach': return nat(name, function (a, ln) { t.items().forEach(function (x) { I.callValue(a[0], [x], ln); }); return null; });
    case 'first': return nat(name, function () { var i = t.items(); return i.length ? i[0] : null; });
    case 'last': return nat(name, function () { var i = t.items(); return i.length ? i[i.length - 1] : null; });
    case 'toString': return nat(name, function () { return javaStr(t); });
    case 'stream': return nat(name, function () { return new Coll('list', t.items()); });
  }
  if (lang === 'javascript') switch (name) {
    case 'add': return nat(name, function (a) { t.add(a[0]); return t; });
    case 'delete': return nat(name, function (a) { return t.del(a[0]); });
    case 'has': return nat(name, function (a) { return t.has(a[0]); });
    case 'size': return t.m.size;
    case 'clear': return nat(name, function () { t.m.clear(); return undefined; });
    case 'forEach': return nat(name, function (a, ln) { t.items().forEach(function (x) { I.callValue(a[0], [x, x, t], ln); }); return undefined; });
    case 'values': case 'keys': return nat(name, function () { return t.items(); });
  }
  return undefined;
}

/* ============================================================
   Funciones y objetos globales de cada lenguaje
   ============================================================ */

function excClass(name) {
  var c = new Cls(name, null);
  c.fieldInits = [{ name: 'message', init: null, type: null }];
  c.__exc = true;
  return c;
}

var PY_EXC = ['Exception', 'ValueError', 'TypeError', 'KeyError', 'IndexError', 'ZeroDivisionError',
  'AttributeError', 'RuntimeError', 'StopIteration', 'NotImplementedError', 'ArithmeticError',
  'OverflowError', 'RecursionError', 'AssertionError', 'NameError', 'FileNotFoundError'];
var JAVA_EXC = ['Exception', 'RuntimeException', 'IllegalArgumentException', 'IllegalStateException',
  'NullPointerException', 'IndexOutOfBoundsException', 'ArrayIndexOutOfBoundsException',
  'ArithmeticException', 'UnsupportedOperationException', 'NoSuchElementException', 'Error', 'StackOverflowError'];
var JS_EXC = ['Error', 'TypeError', 'RangeError', 'ReferenceError', 'SyntaxError'];

function installGlobals(I) {
  var G = I.globals, lang = I.lang;
  var typeCache = {};
  I.typeOf = function (v) {
    var n = typeName(v, lang);
    if (!typeCache[n]) typeCache[n] = new Cls(n, null);
    return typeCache[n];
  };
  var def = function (n, f) { G.declare(n, typeof f === 'function' ? nat(n, f) : f); };
  var mod = function (obj) { var m = new HMap(); m.obj = true; for (var k in obj) m.set(k, obj[k]); return new Mod('', obj); };

  /* ---------- común: números ---------- */
  var mathMembers = {
    PI: new Flo(Math.PI), E: new Flo(Math.E),
    abs: nat('abs', function (a) { return mkNum(Math.abs(num(a[0])), a[0] instanceof Flo); }),
    max: nat('max', function (a) { return a.reduce(function (x, y) { return cmpValues(x, y) >= 0 ? x : y; }); }),
    min: nat('min', function (a) { return a.reduce(function (x, y) { return cmpValues(x, y) <= 0 ? x : y; }); }),
    pow: nat('pow', function (a) { return new Flo(Math.pow(num(a[0]), num(a[1]))); }),
    sqrt: nat('sqrt', function (a) { return new Flo(Math.sqrt(num(a[0]))); }),
    cbrt: nat('cbrt', function (a) { return new Flo(Math.cbrt(num(a[0]))); }),
    floor: nat('floor', function (a) { return lang === 'javascript' ? Math.floor(num(a[0])) : new Flo(Math.floor(num(a[0]))); }),
    ceil: nat('ceil', function (a) { return lang === 'javascript' ? Math.ceil(num(a[0])) : new Flo(Math.ceil(num(a[0]))); }),
    round: nat('round', function (a) { return Math.round(num(a[0])); }),
    trunc: nat('trunc', function (a) { return Math.trunc(num(a[0])); }),
    random: nat('random', function () { return new Flo(Math.random()); }),
    log: nat('log', function (a) { return new Flo(Math.log(num(a[0]))); }),
    log2: nat('log2', function (a) { return new Flo(Math.log2(num(a[0]))); }),
    log10: nat('log10', function (a) { return new Flo(Math.log10(num(a[0]))); }),
    exp: nat('exp', function (a) { return new Flo(Math.exp(num(a[0]))); }),
    hypot: nat('hypot', function (a) { return new Flo(Math.hypot(num(a[0]), num(a[1]))); }),
    sign: nat('sign', function (a) { return Math.sign(num(a[0])); }),
    signum: nat('signum', function (a) { return new Flo(Math.sign(num(a[0]))); }),
    floorDiv: nat('floorDiv', function (a) { return Math.floor(num(a[0]) / num(a[1])); }),
    floorMod: nat('floorMod', function (a) { var x = num(a[0]), y = num(a[1]); return ((x % y) + y) % y; }),
    toIntExact: nat('toIntExact', function (a) { return Math.trunc(num(a[0])); }),
    addExact: nat('addExact', function (a) { return num(a[0]) + num(a[1]); })
  };

  if (lang === 'python') {
    def('print', function (a, ln, kw) {
      var sep = kw && kw.sep !== undefined ? display(kw.sep, lang) : ' ';
      var end = kw && kw.end !== undefined ? display(kw.end, lang) : '\n';
      I.write(a.map(function (x) { return pyStr(x, false); }).join(sep) + end);
      return null;
    });
    def('len', function (a, ln) {
      var v = a[0];
      if (typeof v === 'string') return v.length;
      if (Array.isArray(v)) return v.length;
      if (v instanceof Tup) return v.a.length;
      if (v instanceof Coll) return v.a.length;
      if (v instanceof HMap) return v.m.size;
      if (v instanceof HSet) return v.m.size;
      if (v instanceof Range) return Math.max(0, Math.ceil((v.stop - v.start) / v.step));
      throw I.err('type', 'len() no sabe medir un valor de tipo ' + typeName(v, lang) + '.', ln);
    });
    def('range', function (a, ln) {
      var s, e, st;
      if (a.length === 1) { s = 0; e = Math.trunc(num(a[0])); st = 1; }
      else if (a.length === 2) { s = Math.trunc(num(a[0])); e = Math.trunc(num(a[1])); st = 1; }
      else if (a.length >= 3) { s = Math.trunc(num(a[0])); e = Math.trunc(num(a[1])); st = Math.trunc(num(a[2])); }
      else throw I.err('type', 'range() necesita al menos un número: range(fin), range(inicio, fin) o range(inicio, fin, paso).', ln);
      if (st === 0) throw I.err('value', 'El paso de range() no puede ser 0.', ln);
      return new Range(s, e, st);
    });
    def('sorted', function (a, ln, kw) { return sortArray(I, I.toArray(a[0], ln), kw && kw.key, null, kw && truthy(kw.reverse, lang), ln); });
    def('sum', function (a, ln) {
      var arr = I.toArray(a[0], ln), acc = a.length > 1 ? a[1] : 0;
      for (var i = 0; i < arr.length; i++) acc = I.binop('+', acc, arr[i], ln);
      return acc;
    });
    def('min', function (a, ln, kw) { return minmax(I, a, kw, ln, -1); });
    def('max', function (a, ln, kw) { return minmax(I, a, kw, ln, 1); });
    def('abs', function (a) { return mkNum(Math.abs(num(a[0])), a[0] instanceof Flo); });
    def('enumerate', function (a, ln) {
      var start = a.length > 1 ? num(a[1]) : 0;
      return I.toArray(a[0], ln).map(function (v, i) { return new Tup([i + start, v]); });
    });
    def('zip', function (a, ln) {
      var ls = a.map(function (x) { return I.toArray(x, ln); });
      var n = Math.min.apply(null, ls.map(function (l) { return l.length; }));
      var out = [];
      for (var i = 0; i < n; i++) out.push(new Tup(ls.map(function (l) { return l[i]; })));
      return out;
    });
    def('reversed', function (a, ln) { return I.toArray(a[0], ln).slice().reverse(); });
    def('str', function (a) { return a.length ? pyStr(a[0], false) : ''; });
    def('repr', function (a) { return pyRepr(a[0]); });
    def('int', function (a, ln) {
      if (!a.length) return 0;
      var v = a[0];
      if (typeof v === 'string') {
        var base = a.length > 1 ? num(a[1]) : 10;
        var r = parseInt(v.trim(), base);
        if (isNaN(r)) throw I.err('value', 'int() no puede convertir «' + v + '» a número entero.', ln);
        return r;
      }
      if (typeof v === 'boolean') return v ? 1 : 0;
      return Math.trunc(num(v));
    });
    def('float', function (a, ln) {
      if (!a.length) return new Flo(0);
      if (typeof a[0] === 'string') {
        var s = a[0].trim().toLowerCase();
        if (s === 'inf' || s === '+inf' || s === 'infinity') return new Flo(Infinity);
        if (s === '-inf' || s === '-infinity') return new Flo(-Infinity);
        if (s === 'nan') return new Flo(NaN);
        var r = parseFloat(s);
        if (isNaN(r)) throw I.err('value', 'float() no puede convertir «' + a[0] + '».', ln);
        return new Flo(r);
      }
      return new Flo(num(a[0]));
    });
    def('bool', function (a) { return a.length ? truthy(a[0], lang) : false; });
    def('list', function (a, ln) { return a.length ? I.toArray(a[0], ln).slice() : []; });
    def('tuple', function (a, ln) { return new Tup(a.length ? I.toArray(a[0], ln).slice() : []); });
    def('set', function (a, ln) { var s = new HSet(); if (a.length) I.toArray(a[0], ln).forEach(function (x) { s.add(x); }); return s; });
    def('frozenset', function (a, ln) { var s = new HSet(); if (a.length) I.toArray(a[0], ln).forEach(function (x) { s.add(x); }); return s; });
    def('dict', function (a, ln, kw) {
      var m = new HMap();
      if (a.length && a[0] instanceof HMap) a[0].entries().forEach(function (e) { m.set(e.k, e.v); });
      else if (a.length) I.toArray(a[0], ln).forEach(function (p) { var q = I.toArray(p, ln); m.set(q[0], q[1]); });
      if (kw) for (var k in kw) m.set(k, kw[k]);
      return m;
    });
    def('type', function (a) { return I.typeOf(a[0]); });
    def('isinstance', function (a, ln) {
      var v = a[0], t = a[1];
      var names = t instanceof Tup ? t.a : [t];
      return names.some(function (c) {
        var nm = c instanceof Cls ? c.name : display(c, lang);
        if (v instanceof Obj) { var cc = v.cls; while (cc) { if (cc.name === nm) return true; cc = cc.base; } return false; }
        if (nm === 'int') return typeof v === 'number';
        if (nm === 'float') return v instanceof Flo;
        if (nm === 'bool') return typeof v === 'boolean';
        return typeName(v, lang) === nm;
      });
    });
    def('any', function (a, ln) { return I.toArray(a[0], ln).some(function (x) { return truthy(x, lang); }); });
    def('all', function (a, ln) { return I.toArray(a[0], ln).every(function (x) { return truthy(x, lang); }); });
    def('map', function (a, ln) { return I.toArray(a[1], ln).map(function (x) { return I.callValue(a[0], [x], ln); }); });
    def('filter', function (a, ln) { return I.toArray(a[1], ln).filter(function (x) { return a[0] === null ? truthy(x, lang) : truthy(I.callValue(a[0], [x], ln), lang); }); });
    def('round', function (a) {
      var x = num(a[0]);
      if (a.length > 1) return new Flo(parseFloat(x.toFixed(Math.max(0, Math.min(20, num(a[1]))))));
      var r = Math.round(x);
      if (Math.abs(x % 1) === 0.5 && r % 2 !== 0) r -= Math.sign(x);   // Python redondea al par
      return r;
    });
    def('ord', function (a, ln) { var s = asStr(a[0]); if (s === null || s.length !== 1) throw I.err('type', 'ord() espera un carácter.', ln); return s.charCodeAt(0); });
    def('chr', function (a) { return String.fromCharCode(num(a[0])); });
    def('divmod', function (a, ln) { var x = num(a[0]), y = num(a[1]); if (y === 0) throw I.err('zero', 'divmod() con divisor 0.', ln); return new Tup([Math.floor(x / y), ((x % y) + y) % y]); });
    def('pow', function (a) { return a.length > 2 ? Math.pow(num(a[0]), num(a[1])) % num(a[2]) : mkNum(Math.pow(num(a[0]), num(a[1])), a[0] instanceof Flo || a[1] instanceof Flo || num(a[1]) < 0); });
    def('bin', function (a) { var x = Math.trunc(num(a[0])); return (x < 0 ? '-0b' : '0b') + Math.abs(x).toString(2); });
    def('hex', function (a) { var x = Math.trunc(num(a[0])); return (x < 0 ? '-0x' : '0x') + Math.abs(x).toString(16); });
    def('oct', function (a) { var x = Math.trunc(num(a[0])); return (x < 0 ? '-0o' : '0o') + Math.abs(x).toString(8); });
    def('hash', function (a) { return keyOf(a[0]).split('').reduce(function (h, c) { return (h * 31 + c.charCodeAt(0)) | 0; }, 7); });
    def('id', function (a) { return typeof a[0] === 'object' && a[0] ? identity(a[0]) : 0; });
    def('input', function (a, ln) { throw I.err('type', 'El laboratorio no puede pedir datos por teclado: no hay consola interactiva. Pon los datos de prueba directamente en el código o pásalos como argumentos de la función.', ln); });
    def('format', function (a) { return applyFormat(a[0], a.length > 1 ? display(a[1], lang) : '', lang); });
    def('iter', function (a, ln) { return I.toArray(a[0], ln).slice(); });
    def('next', function (a, ln) { if (Array.isArray(a[0]) && a[0].length) return a[0].shift(); if (a.length > 1) return a[1]; throw I.err('key', 'next() sobre algo agotado.', ln); });
    def('math', null);
    PY_EXC.forEach(function (n) { G.declare(n, excClass(n)); });
  }

  if (lang === 'java') {
    var sysOut = new Mod('System.out', {
      println: nat('println', function (a) { I.write((a.length ? javaStr(a[0]) : '') + '\n'); return null; }),
      print: nat('print', function (a) { I.write(a.length ? javaStr(a[0]) : ''); return null; }),
      printf: nat('printf', function (a) { I.write(sprintf(a[0], a.slice(1), lang)); return null; }),
      flush: nat('flush', function () { return null; })
    });
    G.declare('System', new Mod('System', {
      out: sysOut, err: sysOut,
      currentTimeMillis: nat('currentTimeMillis', function () { return Date.now(); }),
      nanoTime: nat('nanoTime', function () { return Date.now() * 1000000; }),
      exit: nat('exit', function () { throw new ReturnSig(null); }),
      arraycopy: nat('arraycopy', function (a) {
        var src = a[0], sp = num(a[1]), dst = a[2], dp = num(a[3]), len = num(a[4]);
        for (var i = 0; i < len; i++) dst[dp + i] = src[sp + i];
        return null;
      })
    }));
    G.declare('Math', new Mod('Math', mathMembers));
    G.declare('Integer', new Mod('Integer', {
      MAX_VALUE: 2147483647, MIN_VALUE: -2147483648,
      parseInt: nat('parseInt', function (a, ln) { var r = parseInt(String(asStr(a[0])).trim(), a.length > 1 ? num(a[1]) : 10); if (isNaN(r)) throw I.err('value', 'Integer.parseInt("' + asStr(a[0]) + '") no es un número.', ln); return r; }),
      valueOf: nat('valueOf', function (a) { return typeof a[0] === 'string' ? parseInt(a[0], 10) : Math.trunc(num(a[0])); }),
      toString: nat('toString', function (a) { return a.length > 1 ? Math.trunc(num(a[0])).toString(num(a[1])) : String(Math.trunc(num(a[0]))); }),
      toBinaryString: nat('toBinaryString', function (a) { return (num(a[0]) >>> 0).toString(2); }),
      compare: nat('compare', function (a) { return num(a[0]) - num(a[1]); }),
      max: mathMembers.max, min: mathMembers.min,
      bitCount: nat('bitCount', function (a) { var x = num(a[0]) >>> 0, c = 0; while (x) { c += x & 1; x >>>= 1; } return c; })
    }));
    G.declare('Long', new Mod('Long', { MAX_VALUE: 9223372036854775807, MIN_VALUE: -9223372036854775808, parseLong: nat('parseLong', function (a) { return parseInt(asStr(a[0]), 10); }), valueOf: nat('valueOf', function (a) { return Math.trunc(num(a[0])); }) }));
    G.declare('Double', new Mod('Double', {
      MAX_VALUE: new Flo(Number.MAX_VALUE), MIN_VALUE: new Flo(Number.MIN_VALUE),
      POSITIVE_INFINITY: new Flo(Infinity), NEGATIVE_INFINITY: new Flo(-Infinity),
      parseDouble: nat('parseDouble', function (a) { return new Flo(parseFloat(asStr(a[0]))); }),
      valueOf: nat('valueOf', function (a) { return new Flo(num(a[0])); }),
      compare: nat('compare', function (a) { return Math.sign(num(a[0]) - num(a[1])); })
    }));
    G.declare('Boolean', new Mod('Boolean', { parseBoolean: nat('parseBoolean', function (a) { return String(asStr(a[0])).toLowerCase() === 'true'; }), valueOf: nat('valueOf', function (a) { return truthy(a[0], lang); }), TRUE: true, FALSE: false }));
    G.declare('Character', new Mod('Character', {
      isDigit: nat('isDigit', function (a) { return /^[0-9]$/.test(asStr(a[0]) || ''); }),
      isLetter: nat('isLetter', function (a) { return /^[A-Za-zÀ-ÿñÑ]$/.test(asStr(a[0]) || ''); }),
      isLetterOrDigit: nat('isLetterOrDigit', function (a) { return /^[A-Za-z0-9À-ÿñÑ]$/.test(asStr(a[0]) || ''); }),
      isAlphabetic: nat('isAlphabetic', function (a) { return /^[A-Za-zÀ-ÿñÑ]$/.test(asStr(a[0]) || ''); }),
      isUpperCase: nat('isUpperCase', function (a) { var c = asStr(a[0]) || ''; return /[A-Za-zÀ-ÿ]/.test(c) && c === c.toUpperCase(); }),
      isLowerCase: nat('isLowerCase', function (a) { var c = asStr(a[0]) || ''; return /[A-Za-zÀ-ÿ]/.test(c) && c === c.toLowerCase(); }),
      isWhitespace: nat('isWhitespace', function (a) { return /^\s$/.test(asStr(a[0]) || ''); }),
      toUpperCase: nat('toUpperCase', function (a) { return new Chr((asStr(a[0]) || '').toUpperCase()); }),
      toLowerCase: nat('toLowerCase', function (a) { return new Chr((asStr(a[0]) || '').toLowerCase()); }),
      getNumericValue: nat('getNumericValue', function (a) { return parseInt(asStr(a[0]), 36); }),
      valueOf: nat('valueOf', function (a) { return new Chr(asStr(a[0])); }),
      toString: nat('toString', function (a) { return asStr(a[0]); }),
      compare: nat('compare', function (a) { return num(a[0]) - num(a[1]); })
    }));
    G.declare('String', new Mod('String', {
      valueOf: nat('valueOf', function (a) { return Array.isArray(a[0]) ? a[0].map(function (c) { return asStr(c); }).join('') : javaStr(a[0]); }),
      format: nat('format', function (a) { return sprintf(a[0], a.slice(1), lang); }),
      join: nat('join', function (a, ln) {
        var sep = asStr(a[0]);
        var items = a.length === 2 && (Array.isArray(a[1]) || a[1] instanceof Coll) ? I.toArray(a[1], ln) : a.slice(1);
        return items.map(function (x) { return javaStr(x); }).join(sep);
      })
    }));
    G.declare('Arrays', new Mod('Arrays', {
      sort: nat('sort', function (a, ln) {
        var arr = a[0] instanceof Coll ? a[0].a : a[0];
        var r = sortArray(I, arr, null, a.length > 1 && !isNum(a[1]) ? a[1] : null, false, ln);
        arr.length = 0; r.forEach(function (x) { arr.push(x); }); return null;
      }),
      toString: nat('toString', function (a) { return a[0] === null ? 'null' : '[' + I.toArray(a[0], 0).map(javaStr).join(', ') + ']'; }),
      deepToString: nat('deepToString', function (a) { return javaStr(a[0]); }),
      fill: nat('fill', function (a) { var arr = a[0]; for (var i = 0; i < arr.length; i++) arr[i] = a[a.length - 1]; return null; }),
      copyOf: nat('copyOf', function (a) { var n = num(a[1]), o = a[0].slice(0, n); while (o.length < n) o.push(0); return o; }),
      copyOfRange: nat('copyOfRange', function (a) { return a[0].slice(num(a[1]), num(a[2])); }),
      asList: nat('asList', function (a, ln) { return new Coll('list', a.length === 1 && Array.isArray(a[0]) ? a[0].slice() : a.slice()); }),
      equals: nat('equals', function (a) { return eqValues(a[0], a[1]); }),
      stream: nat('stream', function (a) { return new Coll('list', a[0].slice()); }),
      binarySearch: nat('binarySearch', function (a) {
        var arr = a[0], k = a[1], lo = 0, hi = arr.length - 1;
        while (lo <= hi) { var m = (lo + hi) >> 1; var c = cmpValues(arr[m], k); if (c === 0) return m; if (c < 0) lo = m + 1; else hi = m - 1; }
        return -(lo + 1);
      })
    }));
    G.declare('Collections', new Mod('Collections', {
      sort: nat('sort', function (a, ln) {
        var arr = a[0] instanceof Coll ? a[0].a : a[0];
        var r = sortArray(I, arr, null, a.length > 1 ? a[1] : null, false, ln);
        arr.length = 0; r.forEach(function (x) { arr.push(x); }); return null;
      }),
      reverse: nat('reverse', function (a) { var arr = a[0] instanceof Coll ? a[0].a : a[0]; arr.reverse(); return null; }),
      max: nat('max', function (a, ln) { return I.toArray(a[0], ln).reduce(function (x, y) { return cmpValues(x, y) >= 0 ? x : y; }); }),
      min: nat('min', function (a, ln) { return I.toArray(a[0], ln).reduce(function (x, y) { return cmpValues(x, y) <= 0 ? x : y; }); }),
      swap: nat('swap', function (a) { var arr = a[0] instanceof Coll ? a[0].a : a[0]; var i = num(a[1]), j = num(a[2]); var t = arr[i]; arr[i] = arr[j]; arr[j] = t; return null; }),
      emptyList: nat('emptyList', function () { return new Coll('list', []); }),
      frequency: nat('frequency', function (a, ln) { return I.toArray(a[0], ln).filter(function (x) { return eqValues(x, a[1]); }).length; }),
      nCopies: nat('nCopies', function (a) { var o = []; for (var i = 0; i < num(a[0]); i++) o.push(a[1]); return new Coll('list', o); }),
      unmodifiableList: nat('unmodifiableList', function (a) { return a[0]; }),
      reverseOrder: nat('reverseOrder', function () { return nat('cmp', function (a) { return -cmpValues(a[0], a[1]); }); })
    }));
    G.declare('Objects', new Mod('Objects', {
      equals: nat('equals', function (a) { return eqValues(a[0], a[1]); }),
      hash: nat('hash', function (a) { return keyOf(a.length === 1 ? a[0] : a).length; }),
      isNull: nat('isNull', function (a) { return a[0] === null || a[0] === undefined; }),
      nonNull: nat('nonNull', function (a) { return !(a[0] === null || a[0] === undefined); }),
      requireNonNull: nat('requireNonNull', function (a, ln) { if (a[0] === null) throw I.err('nul', 'requireNonNull recibió null.', ln); return a[0]; }),
      toString: nat('toString', function (a) { return javaStr(a[0]); })
    }));
    G.declare('List', new Mod('List', { of: nat('of', function (a) { return new Coll('list', a.slice()); }), copyOf: nat('copyOf', function (a, ln) { return new Coll('list', I.toArray(a[0], ln).slice()); }) }));
    G.declare('Set', new Mod('Set', { of: nat('of', function (a) { var s = new HSet(); a.forEach(function (x) { s.add(x); }); return s; }) }));
    G.declare('Map', new Mod('Map', {
      of: nat('of', function (a) { var m = new HMap(); for (var i = 0; i + 1 < a.length; i += 2) m.set(a[i], a[i + 1]); return m; }),
      entry: nat('entry', function (a) { return new Tup([a[0], a[1]]); })
    }));
    G.declare('Comparator', new Mod('Comparator', {
      naturalOrder: nat('naturalOrder', function () { return nat('cmp', function (a) { return cmpValues(a[0], a[1]); }); }),
      reverseOrder: nat('reverseOrder', function () { return nat('cmp', function (a) { return -cmpValues(a[0], a[1]); }); }),
      comparingInt: nat('comparingInt', function (a, ln) { var f = a[0]; return nat('cmp', function (b, l2) { return num(I.callValue(f, [b[0]], l2)) - num(I.callValue(f, [b[1]], l2)); }); }),
      comparing: nat('comparing', function (a, ln) { var f = a[0]; return nat('cmp', function (b, l2) { return cmpValues(I.callValue(f, [b[0]], l2), I.callValue(f, [b[1]], l2)); }); })
    }));
    JAVA_EXC.forEach(function (n) { G.declare(n, excClass(n)); });
    // Nombres completos: java.util.Arrays.sort(...) funciona igual que Arrays.sort(...)
    var utilNames = ['Arrays', 'Collections', 'List', 'Map', 'Set', 'Objects', 'Comparator'];
    var util = {};
    utilNames.forEach(function (k) { util[k] = G.get(k); });
    var langNames = { Math: G.get('Math'), Integer: G.get('Integer'), Long: G.get('Long'), Double: G.get('Double'), Character: G.get('Character'), String: G.get('String'), Boolean: G.get('Boolean'), System: G.get('System') };
    G.declare('java', new Mod('java', { util: new Mod('java.util', util), lang: new Mod('java.lang', langNames), io: new Mod('java.io', {}) }));
  }

  if (lang === 'javascript') {
    G.declare('console', new Mod('console', {
      log: nat('log', function (a) { I.write(a.map(function (x) { return jsStr(x, false); }).join(' ') + '\n'); return undefined; }),
      error: nat('error', function (a) { I.write(a.map(function (x) { return jsStr(x, false); }).join(' ') + '\n'); return undefined; }),
      warn: nat('warn', function (a) { I.write(a.map(function (x) { return jsStr(x, false); }).join(' ') + '\n'); return undefined; }),
      info: nat('info', function (a) { I.write(a.map(function (x) { return jsStr(x, false); }).join(' ') + '\n'); return undefined; }),
      table: nat('table', function (a) { I.write(jsStr(a[0], false) + '\n'); return undefined; })
    }));
    G.declare('Math', new Mod('Math', mathMembers));
    G.declare('Number', new Mod('Number', {
      MAX_SAFE_INTEGER: 9007199254740991, MIN_SAFE_INTEGER: -9007199254740991,
      POSITIVE_INFINITY: Infinity, NEGATIVE_INFINITY: -Infinity, EPSILON: 2.220446049250313e-16,
      parseInt: nat('parseInt', function (a) { return parseInt(display(a[0], lang), a.length > 1 ? num(a[1]) : 10); }),
      parseFloat: nat('parseFloat', function (a) { return parseFloat(display(a[0], lang)); }),
      isInteger: nat('isInteger', function (a) { return typeof a[0] === 'number' && Number.isInteger(a[0]); }),
      isNaN: nat('isNaN', function (a) { return typeof a[0] === 'number' && isNaN(a[0]); }),
      isFinite: nat('isFinite', function (a) { return isNum(a[0]) && isFinite(num(a[0])); })
    }));
    G.declare('Object', new Mod('Object', {
      keys: nat('keys', function (a) { return a[0] instanceof HMap ? a[0].keys().map(function (k) { return display(k, lang); }) : a[0] instanceof Obj ? Object.keys(a[0].f) : []; }),
      values: nat('values', function (a) { return a[0] instanceof HMap ? a[0].values() : a[0] instanceof Obj ? Object.keys(a[0].f).map(function (k) { return a[0].f[k]; }) : []; }),
      entries: nat('entries', function (a) { return a[0] instanceof HMap ? a[0].entries().map(function (e) { return [e.k, e.v]; }) : []; }),
      assign: nat('assign', function (a) { for (var i = 1; i < a.length; i++) if (a[i] instanceof HMap) a[i].entries().forEach(function (e) { a[0].set(e.k, e.v); }); return a[0]; }),
      fromEntries: nat('fromEntries', function (a, ln) { var m = new HMap(); m.obj = true; I.toArray(a[0], ln).forEach(function (p) { var q = I.toArray(p, ln); m.set(q[0], q[1]); }); return m; }),
      freeze: nat('freeze', function (a) { return a[0]; })
    }));
    G.declare('Array', new Mod('Array', {
      isArray: nat('isArray', function (a) { return Array.isArray(a[0]); }),
      from: nat('from', function (a, ln) {
        var src;
        if (a[0] instanceof HMap && a[0].obj && a[0].has('length')) { src = []; for (var i = 0; i < num(a[0].get('length')); i++) src.push(undefined); }
        else src = I.toArray(a[0], ln).slice();
        return a.length > 1 ? src.map(function (x, i) { return I.callValue(a[1], [x, i], ln); }) : src;
      }),
      of: nat('of', function (a) { return a.slice(); })
    }));
    G.declare('String', new Mod('String', {
      fromCharCode: nat('fromCharCode', function (a) { return a.map(function (x) { return String.fromCharCode(num(x)); }).join(''); })
    }));
    G.declare('JSON', new Mod('JSON', {
      stringify: nat('stringify', function (a) { return jsonStr(a[0]); })
    }));
    def('parseInt', function (a) { return parseInt(display(a[0], lang), a.length > 1 ? num(a[1]) : 10); });
    def('parseFloat', function (a) { return parseFloat(display(a[0], lang)); });
    def('isNaN', function (a) { return isNaN(num(a[0])); });
    def('isFinite', function (a) { return isFinite(num(a[0])); });
    def('Number', function (a) { return a.length === 0 ? 0 : typeof a[0] === 'string' ? (a[0].trim() === '' ? 0 : Number(a[0])) : num(a[0]); });
    def('String', function (a) { return a.length ? jsStr(a[0], false) : ''; });
    def('Boolean', function (a) { return truthy(a[0], lang); });
    def('structuredClone', function (a) { return deepCopy(a[0]); });
    G.declare('Infinity', Infinity);
    G.declare('NaN', NaN);
    G.declare('undefined', undefined);
    JS_EXC.forEach(function (n) { G.declare(n, excClass(n)); });
  }
}

function minmax(I, a, kw, ln, dir) {
  var arr = a.length === 1 ? I.toArray(a[0], ln) : a;
  if (!arr.length) {
    if (kw && kw['default'] !== undefined) return kw['default'];
    throw I.err('value', (dir > 0 ? 'max' : 'min') + '() sobre una secuencia vacía. Comprueba antes que no esté vacía.', ln);
  }
  var key = kw && kw.key;
  var best = arr[0], bestK = key ? I.callValue(key, [best], ln) : best;
  for (var i = 1; i < arr.length; i++) {
    var k = key ? I.callValue(key, [arr[i]], ln) : arr[i];
    if (cmpValues(k, bestK) * dir > 0) { best = arr[i]; bestK = k; }
  }
  return best;
}

function jsonStr(v) {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'boolean') return String(v);
  if (isNum(v)) return String(num(v));
  if (typeof v === 'string') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(jsonStr).join(',') + ']';
  if (v instanceof HMap) return '{' + v.entries().map(function (e) { return JSON.stringify(String(display(e.k, 'javascript'))) + ':' + jsonStr(e.v); }).join(',') + '}';
  if (v instanceof Obj) { var o = []; for (var k in v.f) o.push(JSON.stringify(k) + ':' + jsonStr(v.f[k])); return '{' + o.join(',') + '}'; }
  return 'null';
}
function deepCopy(v) {
  if (Array.isArray(v)) return v.map(deepCopy);
  if (v instanceof Tup) return new Tup(v.a.map(deepCopy));
  if (v instanceof HMap) { var m = new HMap(v.sorted); m.obj = v.obj; v.entries().forEach(function (e) { m.set(e.k, deepCopy(e.v)); }); return m; }
  if (v instanceof HSet) { var s = new HSet(v.sorted); v.items().forEach(function (x) { s.add(deepCopy(x)); }); return s; }
  if (v instanceof Coll) return new Coll(v.kind, v.a.map(deepCopy), v.cmp);
  return v;
}

/* ---------- constructores con «new» ---------- */
function builtinConstructor(I, name, args, line) {
  var lang = I.lang;
  switch (name) {
    case 'ArrayList': case 'Vector':
      return new Coll('list', args.length && (args[0] instanceof Coll || Array.isArray(args[0]) || args[0] instanceof HSet) ? I.toArray(args[0], line).slice() : []);
    case 'LinkedList': case 'ArrayDeque':
      return new Coll('deque', args.length && !isNum(args[0]) ? I.toArray(args[0], line).slice() : []);
    case 'Stack': return new Coll('stack', []);
    case 'PriorityQueue': {
      var cmp = null, init = [];
      args.forEach(function (a) {
        if (a instanceof Fun || a instanceof Native || a instanceof Bound) cmp = a;
        else if (Array.isArray(a) || a instanceof Coll) init = I.toArray(a, line).slice();
      });
      var c = new Coll('pq', [], cmp);
      init.forEach(function (x) { heapPush(c.a, x, heapCmp(cmp, I, line)); });
      return c;
    }
    case 'HashMap': case 'LinkedHashMap': case 'Hashtable': {
      var m = new HMap(false);
      if (args.length && args[0] instanceof HMap) args[0].entries().forEach(function (e) { m.set(e.k, e.v); });
      return m;
    }
    case 'TreeMap': {
      var tm = new HMap(true);
      if (args.length && args[0] instanceof HMap) args[0].entries().forEach(function (e) { tm.set(e.k, e.v); });
      return tm;
    }
    case 'HashSet': case 'LinkedHashSet': {
      var s = new HSet(false);
      if (args.length && !isNum(args[0])) I.toArray(args[0], line).forEach(function (x) { s.add(x); });
      return s;
    }
    case 'TreeSet': {
      var ts = new HSet(true);
      if (args.length && !isNum(args[0])) I.toArray(args[0], line).forEach(function (x) { ts.add(x); });
      return ts;
    }
    case 'StringBuilder': case 'StringBuffer': {
      var sb = new Coll('sb', []);
      sb.s = args.length && typeof args[0] === 'string' ? args[0] : '';
      return sb;
    }
    case 'String': return args.length ? (Array.isArray(args[0]) ? args[0].map(function (c) { return asStr(c); }).join('') : display(args[0], lang)) : '';
    case 'Integer': return Math.trunc(num(args[0]));
    case 'Double': return new Flo(num(args[0]));
    case 'Map': {
      var jm = new HMap();
      if (args.length) I.toArray(args[0], line).forEach(function (p) { var q = I.toArray(p, line); jm.set(q[0], q[1]); });
      return jm;
    }
    case 'Set': {
      var js = new HSet();
      if (args.length && args[0] !== null) I.toArray(args[0], line).forEach(function (x) { js.add(x); });
      return js;
    }
    case 'Array': {
      if (args.length === 1 && isNum(args[0])) { var o = []; for (var i = 0; i < num(args[0]); i++) o.push(undefined); return o; }
      return args.slice();
    }
    case 'Object': { var om = new HMap(); om.obj = true; return om; }
  }
  return undefined;
}

/* ---------- módulos de Python que se pueden importar ---------- */
var MODULES = {
  math: {
    sqrt: function (I) { return nat('sqrt', function (a) { return new Flo(Math.sqrt(num(a[0]))); }); },
    floor: function (I) { return nat('floor', function (a) { return Math.floor(num(a[0])); }); },
    ceil: function (I) { return nat('ceil', function (a) { return Math.ceil(num(a[0])); }); },
    fabs: function (I) { return nat('fabs', function (a) { return new Flo(Math.abs(num(a[0]))); }); },
    pow: function (I) { return nat('pow', function (a) { return new Flo(Math.pow(num(a[0]), num(a[1]))); }); },
    log: function (I) { return nat('log', function (a) { return new Flo(a.length > 1 ? Math.log(num(a[0])) / Math.log(num(a[1])) : Math.log(num(a[0]))); }); },
    log2: function (I) { return nat('log2', function (a) { return new Flo(Math.log2(num(a[0]))); }); },
    log10: function (I) { return nat('log10', function (a) { return new Flo(Math.log10(num(a[0]))); }); },
    exp: function (I) { return nat('exp', function (a) { return new Flo(Math.exp(num(a[0]))); }); },
    gcd: function (I) { return nat('gcd', function (a) { var x = Math.abs(num(a[0])), y = Math.abs(num(a[1])); while (y) { var t = y; y = x % y; x = t; } return x; }); },
    lcm: function (I) { return nat('lcm', function (a) { var x = Math.abs(num(a[0])), y = Math.abs(num(a[1])), g = x; var b = y; while (b) { var t = b; b = g % b; g = t; } return g ? x / g * y : 0; }); },
    factorial: function (I) { return nat('factorial', function (a) { var r = 1; for (var i = 2; i <= num(a[0]); i++) r *= i; return r; }); },
    isqrt: function (I) { return nat('isqrt', function (a) { return Math.floor(Math.sqrt(num(a[0]))); }); },
    comb: function (I) { return nat('comb', function (a) { var n = num(a[0]), k = num(a[1]), r = 1; for (var i = 0; i < k; i++) r = r * (n - i) / (i + 1); return Math.round(r); }); },
    inf: function () { return new Flo(Infinity); },
    pi: function () { return new Flo(Math.PI); },
    e: function () { return new Flo(Math.E); },
    nan: function () { return new Flo(NaN); }
  },
  collections: {
    deque: function (I) { return nat('deque', function (a, ln) { return new Coll('deque', a.length ? I.toArray(a[0], ln).slice() : []); }); },
    defaultdict: function (I) {
      return nat('defaultdict', function (a, ln) {
        var m = new HMap();
        m.factory = a[0] || null;
        return m;
      });
    },
    Counter: function (I) {
      return nat('Counter', function (a, ln) {
        var m = new HMap();
        m.counter = true;
        if (a.length) I.toArray(a[0], ln).forEach(function (x) { m.set(x, (m.has(x) ? m.get(x) : 0) + 1); });
        return m;
      });
    },
    OrderedDict: function (I) { return nat('OrderedDict', function () { return new HMap(); }); },
    namedtuple: function (I) { return nat('namedtuple', function (a) { return nat('tuple', function (b) { return new Tup(b.slice()); }); }); }
  },
  heapq: {
    heappush: function (I) { return nat('heappush', function (a, ln) { heapPush(a[0], a[1], cmpValues); return null; }); },
    heappop: function (I) { return nat('heappop', function (a, ln) { if (!a[0].length) throw I.err('index', 'heappop() de un montículo vacío.', ln); return heapPop(a[0], cmpValues); }); },
    heapify: function (I) { return nat('heapify', function (a) { heapify(a[0], cmpValues); return null; }); },
    heappushpop: function (I) { return nat('heappushpop', function (a) { heapPush(a[0], a[1], cmpValues); return heapPop(a[0], cmpValues); }); },
    heapreplace: function (I) { return nat('heapreplace', function (a) { var t = heapPop(a[0], cmpValues); heapPush(a[0], a[1], cmpValues); return t; }); },
    nlargest: function (I) { return nat('nlargest', function (a, ln) { return sortArray(I, I.toArray(a[1], ln), null, null, true, ln).slice(0, num(a[0])); }); },
    nsmallest: function (I) { return nat('nsmallest', function (a, ln) { return sortArray(I, I.toArray(a[1], ln), null, null, false, ln).slice(0, num(a[0])); }); }
  },
  bisect: {
    bisect_left: function (I) { return nat('bisect_left', function (a) { var A = a[0], x = a[1], lo = 0, hi = A.length; while (lo < hi) { var m = (lo + hi) >> 1; if (cmpValues(A[m], x) < 0) lo = m + 1; else hi = m; } return lo; }); },
    bisect_right: function (I) { return nat('bisect_right', function (a) { var A = a[0], x = a[1], lo = 0, hi = A.length; while (lo < hi) { var m = (lo + hi) >> 1; if (cmpValues(x, A[m]) < 0) hi = m; else lo = m + 1; } return lo; }); },
    insort: function (I) { return nat('insort', function (a) { var A = a[0], x = a[1], lo = 0, hi = A.length; while (lo < hi) { var m = (lo + hi) >> 1; if (cmpValues(A[m], x) < 0) lo = m + 1; else hi = m; } A.splice(lo, 0, x); return null; }); }
  },
  functools: {
    lru_cache: function (I) { return nat('lru_cache', function () { return nat('deco', function (b) { return b[0]; }); }); },
    cache: function (I) { return nat('cache', function (b) { return b[0]; }); },
    reduce: function (I) {
      return nat('reduce', function (a, ln) {
        var arr = I.toArray(a[1], ln), acc, i = 0;
        if (a.length > 2) acc = a[2]; else { acc = arr[0]; i = 1; }
        for (; i < arr.length; i++) acc = I.callValue(a[0], [acc, arr[i]], ln);
        return acc;
      });
    }
  },
  itertools: {
    permutations: function (I) {
      return nat('permutations', function (a, ln) {
        var arr = I.toArray(a[0], ln), r = a.length > 1 ? num(a[1]) : arr.length, out = [];
        var used = new Array(arr.length).fill(false), cur = [];
        (function go() {
          if (cur.length === r) { out.push(new Tup(cur.slice())); return; }
          for (var i = 0; i < arr.length; i++) if (!used[i]) { used[i] = true; cur.push(arr[i]); go(); cur.pop(); used[i] = false; }
        })();
        return out;
      });
    },
    combinations: function (I) {
      return nat('combinations', function (a, ln) {
        var arr = I.toArray(a[0], ln), r = num(a[1]), out = [], cur = [];
        (function go(s) {
          if (cur.length === r) { out.push(new Tup(cur.slice())); return; }
          for (var i = s; i < arr.length; i++) { cur.push(arr[i]); go(i + 1); cur.pop(); }
        })(0);
        return out;
      });
    },
    product: function (I) {
      return nat('product', function (a, ln) {
        var ls = a.map(function (x) { return I.toArray(x, ln); }), out = [], cur = [];
        (function go(k) {
          if (k === ls.length) { out.push(new Tup(cur.slice())); return; }
          ls[k].forEach(function (v) { cur.push(v); go(k + 1); cur.pop(); });
        })(0);
        return out;
      });
    }
  },
  string: {
    ascii_lowercase: function () { return 'abcdefghijklmnopqrstuvwxyz'; },
    ascii_uppercase: function () { return 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'; },
    digits: function () { return '0123456789'; },
    punctuation: function () { return '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~'; }
  },
  random: {
    randint: function (I) { return nat('randint', function (a) { var lo = num(a[0]), hi = num(a[1]); return lo + Math.floor(Math.random() * (hi - lo + 1)); }); },
    random: function (I) { return nat('random', function () { return new Flo(Math.random()); }); },
    choice: function (I) { return nat('choice', function (a, ln) { var arr = I.toArray(a[0], ln); return arr[Math.floor(Math.random() * arr.length)]; }); },
    shuffle: function (I) { return nat('shuffle', function (a) { var A = a[0]; for (var i = A.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = A[i]; A[i] = A[j]; A[j] = t; } return null; }); },
    seed: function (I) { return nat('seed', function () { return null; }); }
  },
  typing: {},
  sys: { maxsize: function () { return 9007199254740991; } }
};

/* ============================================================
   H. API PÚBLICA
   ============================================================ */

function parse(src, lang) {
  var toks = lex(src, lang);
  var p = lang === 'python' ? new PyParser(toks) : new CParser(toks, lang);
  return p.parseProgram();
}

/** Convierte un valor de JavaScript «normal» a un valor del intérprete. */
function toVal(x, lang) {
  if (x === null || x === undefined) return null;
  if (typeof x === 'number') return (Number.isInteger(x) || lang === 'javascript') ? x : new Flo(x);
  if (typeof x === 'string' || typeof x === 'boolean') return x;
  if (Array.isArray(x)) return x.map(function (y) { return toVal(y, lang); });
  if (x && x.__map) { var m = new HMap(); x.__map.forEach(function (p) { m.set(toVal(p[0], lang), toVal(p[1], lang)); }); return m; }
  return x;
}

/** Convierte un valor del intérprete a JavaScript «normal» para poder compararlo. */
function toPlain(v) {
  if (v === null || v === undefined) return null;
  if (v instanceof Flo) return v.v;
  if (v instanceof Chr) return v.c;
  if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') return v;
  if (Array.isArray(v)) return v.map(toPlain);
  if (v instanceof Tup) return v.a.map(toPlain);
  if (v instanceof Coll) return v.a.map(toPlain);
  if (v instanceof HSet) return v.items().map(toPlain).sort(function (a, b) { return a < b ? -1 : a > b ? 1 : 0; });
  if (v instanceof HMap) { var o = {}; v.entries().forEach(function (e) { o[String(toPlain(e.k))] = toPlain(e.v); }); return o; }
  if (v instanceof Obj) { var f = {}; for (var k in v.f) f[k] = toPlain(v.f[k]); return f; }
  return v;
}

/** Comparación laxa: 5 y 5.0 valen igual, y el orden de un conjunto no importa. */
function sameValue(a, b) {
  if (a === b) return true;
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < 1e-9;
  if (a === null || b === null) return a === b || (a === undefined && b === null) || (a === null && b === undefined);
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) if (!sameValue(a[i], b[i])) return false;
    return true;
  }
  if (typeof a === 'object' && typeof b === 'object') {
    var ka = Object.keys(a), kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    for (var j = 0; j < ka.length; j++) if (!(ka[j] in b) || !sameValue(a[ka[j]], b[ka[j]])) return false;
    return true;
  }
  return false;
}

function describeError(e, lang) {
  if (e && (e.rt || e.lex || e.syn)) {
    return {
      name: e.lex ? 'ErrorDeEscritura' : e.syn ? 'ErrorDeSintaxis' : (e.name || 'Error'),
      message: e.message,
      line: e.line || 0
    };
  }
  if (e && e.message && /call stack/i.test(e.message)) {
    return { name: 'StackOverflow', message: 'Se han acumulado demasiadas llamadas anidadas. Casi siempre es una recursión sin caso base.', line: 0 };
  }
  return { name: 'ErrorInterno', message: (e && e.message) || String(e), line: 0 };
}

/**
 * Ejecuta un programa completo.
 * @returns {{ok:boolean, output:string, error:?{name,message,line}, steps:number, ms:number}}
 */
function runProgram(src, lang, opts) {
  opts = opts || {};
  var I = new Interp(lang, opts);
  var t0 = Date.now();
  try {
    var ast = parse(src, lang);
    I.run(ast);
    return { ok: true, output: I.out, error: null, steps: I.steps, ms: Date.now() - t0, interp: I };
  } catch (e) {
    return { ok: false, output: I.out, error: describeError(e, lang), steps: I.steps, ms: Date.now() - t0, interp: I };
  }
}

/**
 * Ejecuta el programa sin lanzar main y llama a una función concreta con
 * unos argumentos. Es lo que usa el botón «Probar» del laboratorio.
 */
function runTests(src, lang, spec) {
  var I = new Interp(lang, { limit: spec.limit || 4000000, maxMs: spec.maxMs || 5000 });
  var results = [];
  var fnName = typeof spec.fn === 'string' ? spec.fn : spec.fn[lang === 'python' ? 'py' : lang === 'java' ? 'java' : 'js'];
  try {
    var ast = parse(src, lang);
    I.hoist(ast.body, I.globals);
    var loose = ast.body.filter(function (s) { return s.k !== 'Func' && s.k !== 'Class'; });
    if (loose.length && lang !== 'java') {
      // ejecutamos el nivel superior pero descartamos lo que imprima
      var keep = I.out;
      try { I.execBlock({ k: 'Block', body: loose }, I.globals); } catch (e) { }
      I.out = keep;
    }
  } catch (e) {
    return { ok: false, error: describeError(e, lang), results: [] };
  }

  var fn = I.globals.get(fnName);
  if (!fn) {
    return {
      ok: false, results: [],
      error: { name: 'FaltaLaFuncion', line: 0,
        message: 'No encuentro ninguna función llamada «' + fnName + '». Los tests la llaman por ese nombre exacto: revisa que esté escrita igual (mayúsculas incluidas).' }
    };
  }

  var passed = 0;
  for (var i = 0; i < spec.cases.length; i++) {
    var c = spec.cases[i];
    var args = c[0].map(function (a) { return toVal(a, lang); });
    var expected = c[1];
    I.steps = 0; I.t0 = Date.now(); I.out = '';
    try {
      var got = I.callValue(fn, args, 0);
      var plain = toPlain(got);
      var ok = spec.compare === 'set'
        ? sameValue(sortDeep(plain), sortDeep(expected))
        : sameValue(plain, expected);
      if (ok) passed++;
      results.push({ args: c[0], expected: expected, got: plain, ok: ok, printed: I.out });
    } catch (e) {
      results.push({ args: c[0], expected: expected, got: null, ok: false, error: describeError(e, lang), printed: I.out });
    }
  }
  return { ok: passed === spec.cases.length, passed: passed, total: spec.cases.length, results: results, error: null };
}

function sortDeep(v) {
  if (!Array.isArray(v)) return v;
  var c = v.map(sortDeep);
  c.sort(function (a, b) { var x = JSON.stringify(a), y = JSON.stringify(b); return x < y ? -1 : x > y ? 1 : 0; });
  return c;
}

export const AlgoLab = {
  run: runProgram,
  test: runTests,
  parse: parse,
  display: display,
  /* Las usa el modo «servidor real» para comparar lo que devuelve Judge0
     con la misma tolerancia que el intérprete local. */
  same: sameValue,
  sortDeep: sortDeep,
  version: '1.1'
};

