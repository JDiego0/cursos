import { Injectable } from '@angular/core';

/* ============================================================
   RESALTADOR DE SINTAXIS

   Cada curso legacy llevaba su propia copia del resaltador, con
   las palabras reservadas de su lenguaje incrustadas. Aquí hay
   una sola implementación y un perfil por lenguaje.

   El original coloreaba a base de pasadas sucesivas de `replace`,
   guardando lo ya coloreado bajo tokens para que las reglas
   siguientes no lo rompieran. Esta versión hace una sola pasada
   con un analizador léxico: no hay tokens centinela, no hay orden
   frágil entre reglas y no puede colorear dos veces lo mismo.
   ============================================================ */

/** Categorías que sabe pintar; se corresponden con las clases .c-* del CSS. */
type Categoria = 'key' | 'typ' | 'str' | 'com' | 'num' | 'ann' | 'tag' | 'cmd' | 'flag';

interface PerfilLenguaje {
  palabras: ReadonlySet<string>;
  tipos: ReadonlySet<string>;
  /** `//` inicia comentario (C, Java, JS…). En Python es división. */
  comentarioBarra: boolean;
  /** `#` inicia comentario (Python, YAML, shell, properties). */
  comentarioAlmohadilla: boolean;
  /** `--` inicia comentario (SQL). */
  comentarioGuion: boolean;
  /** `@Anotacion` o `@decorador`. */
  anotaciones: boolean;
  /** Etiquetas `<div>`: sólo en lenguajes de marcado. */
  marcado: boolean;
  /** Primera palabra de la línea = comando; `--opcion` = bandera. */
  consola: boolean;
}

const conjunto = (palabras: string) => new Set(palabras.split(/\s+/).filter(Boolean));

const COMUNES_SQL = conjunto(`
  SELECT FROM WHERE INSERT INTO VALUES UPDATE DELETE CREATE TABLE ALTER DROP PRIMARY KEY FOREIGN
  REFERENCES NOT NULL VARCHAR BIGINT INT SERIAL TEXT DATE TIMESTAMP BOOLEAN DEFAULT JOIN LEFT RIGHT
  INNER OUTER ON ORDER BY GROUP HAVING LIMIT OFFSET AS AND OR IN LIKE DISTINCT COUNT SUM AVG MIN MAX
`);

const VACIO: ReadonlySet<string> = new Set<string>();

const BASE: PerfilLenguaje = {
  palabras: VACIO,
  tipos: VACIO,
  comentarioBarra: false,
  comentarioAlmohadilla: false,
  comentarioGuion: false,
  anotaciones: false,
  marcado: false,
  consola: false,
};

const PERFILES: Record<string, PerfilLenguaje> = {
  java: {
    ...BASE,
    palabras: conjunto(`
      abstract assert boolean break byte case catch char class const continue default do double else
      enum extends final finally float for goto if implements import instanceof int interface long
      native new non-sealed package permits private protected public record return sealed short static
      strictfp super switch synchronized this throw throws transient try var void volatile while yield
      true false null`),
    tipos: conjunto(`
      String Integer Double Long Boolean Character List ArrayList LinkedList Map HashMap TreeMap Set
      HashSet TreeSet Queue Deque Optional Stream Collectors System Object Exception RuntimeException
      IllegalArgumentException Scanner LocalDate LocalDateTime BigDecimal Math Arrays Collections
      StringBuilder Thread Runnable Comparable Comparator Iterable`),
    comentarioBarra: true,
    anotaciones: true,
  },

  python: {
    ...BASE,
    palabras: conjunto(`
      and as assert async await break class continue def del elif else except finally for from global
      if import in is lambda nonlocal not or pass raise return try while with yield True False None
      match case self`),
    tipos: conjunto(`
      int float str bool list dict set tuple bytes range object type len print input open enumerate
      zip map filter sorted sum min max abs round any all isinstance super Exception ValueError
      TypeError KeyError IndexError StopIteration Optional List Dict Set Tuple Any Union Callable
      dataclass pd np plt Path datetime timedelta`),
    comentarioAlmohadilla: true,
    anotaciones: true,
  },

  typescript: {
    ...BASE,
    palabras: conjunto(`
      abstract any as async await break case catch class const continue debugger declare default delete
      do else enum export extends false finally for from function get if implements import in
      infer instanceof interface is keyof let new null of private protected public readonly return
      satisfies set static super switch this throw true try type typeof undefined var void while yield`),
    tipos: conjunto(`
      string number boolean object symbol bigint unknown never Array Promise Record Partial Required
      Readonly Pick Omit Map Set WeakMap Date JSON Math Object Error Component Injectable Input Output
      signal computed effect inject Observable Subject BehaviorSubject HttpClient FormGroup FormControl
      Validators Router ActivatedRoute React useState useEffect useMemo useCallback useRef useContext
      console document window`),
    comentarioBarra: true,
    anotaciones: true,
  },

  sql: { ...BASE, tipos: COMUNES_SQL, comentarioGuion: true },

  marcado: {
    ...BASE,
    tipos: conjunto(`true false null`),
    comentarioBarra: false,
    marcado: true,
  },

  configuracion: { ...BASE, tipos: conjunto(`true false null yes no on off`), comentarioAlmohadilla: true },

  consola: {
    ...BASE,
    tipos: conjunto(`true false null`),
    comentarioAlmohadilla: true,
    consola: true,
  },

  /* Salidas de programa, texto plano: no se colorea nada. */
  ninguno: BASE,
};

/** `data-lang` → perfil. Se prueba en orden: gana la primera regla. */
const REGLAS: [RegExp, keyof typeof PERFILES][] = [
  [/salida|resultado|texto|comparaci|entorno|pedido/i, 'ninguno'],
  [/xml|pom\b|html|thymeleaf|jsx|tsx|angular|svg/i, 'marcado'],
  [/json|yaml|yml|properties|toml|ini|package\.json/i, 'configuracion'],
  [/terminal|bash|shell|consola|cli|dockerfile|nginx|crontab|windows|macos|linux|vercel|npm/i, 'consola'],
  [/sql|cosmos/i, 'sql'],
  [/python|\bpy\b|django|fastapi|pandas/i, 'python'],
  [/typescript|\bts\b|javascript|\bjs\b|node|react|vue/i, 'typescript'],
  [/java/i, 'java'],
  [/css|scss/i, 'configuracion'],
  [/markdown|\bmd\b/i, 'ninguno'],
];

@Injectable({ providedIn: 'root' })
export class ResaltadorService {
  /** Cachea la expresión de cada perfil: se construye una sola vez. */
  private readonly lexicos = new Map<PerfilLenguaje, RegExp>();

  /** Elige perfil a partir de la etiqueta `data-lang` del bloque. */
  perfilDe(lenguaje: string): PerfilLenguaje {
    for (const [patron, nombre] of REGLAS) {
      if (patron.test(lenguaje)) return PERFILES[nombre];
    }
    return PERFILES['ninguno'];
  }

  /** Devuelve el código como HTML con `<span class="c-…">`. */
  resaltar(codigo: string, lenguaje: string): string {
    const perfil = this.perfilDe(lenguaje);
    if (perfil === PERFILES['ninguno']) return this.escapar(codigo);

    const lexico = this.lexico(perfil);
    lexico.lastIndex = 0;

    let salida = '';
    let cursor = 0;
    let inicioDeLinea = true;
    let m: RegExpExecArray | null;

    while ((m = lexico.exec(codigo))) {
      /* Texto suelto entre dos coincidencias. */
      const hueco = codigo.slice(cursor, m.index);
      if (hueco) {
        salida += this.escapar(hueco);
        inicioDeLinea = /\n\s*$/.test(hueco) || (inicioDeLinea && /^\s*$/.test(hueco));
      }

      const g = m.groups ?? {};
      const texto = m[0];
      let categoria: Categoria | null = null;

      if (g['com'] !== undefined || g['com2'] !== undefined || g['com3'] !== undefined || g['com4'] !== undefined)
        categoria = 'com';
      else if (g['str'] !== undefined) categoria = 'str';
      else if (g['ann'] !== undefined) categoria = 'ann';
      else if (g['tag'] !== undefined) categoria = 'tag';
      else if (g['flag'] !== undefined) categoria = 'flag';
      else if (g['num'] !== undefined) categoria = 'num';
      else if (g['id'] !== undefined) categoria = this.clasificar(texto, perfil, inicioDeLinea);

      salida += categoria ? this.envolver(categoria, texto) : this.escapar(texto);

      /* Sólo la primera palabra de una línea puede ser un comando. */
      if (g['id'] !== undefined || g['num'] !== undefined) inicioDeLinea = false;
      cursor = m.index + texto.length;
    }

    return salida + this.escapar(codigo.slice(cursor));
  }

  /* ---------- Interno ---------- */

  private clasificar(palabra: string, perfil: PerfilLenguaje, inicioDeLinea: boolean): Categoria | null {
    if (perfil.palabras.has(palabra)) return 'key';
    if (perfil.tipos.has(palabra)) return 'typ';
    if (perfil.consola && inicioDeLinea) return 'cmd';
    /* En Java y TypeScript, un identificador en PascalCase es casi
       siempre un tipo; cubrir el catálogo entero sería imposible. */
    if (!perfil.consola && /^[A-Z][a-z]\w*$/.test(palabra)) return 'typ';
    return null;
  }

  /**
   * Construye el analizador léxico del perfil. El orden de las
   * alternativas es el orden de prioridad: lo que casa primero gana,
   * y una coincidencia consume su texto, así que nada se colorea dos
   * veces (una almohadilla dentro de una cadena no abre comentario).
   */
  private lexico(perfil: PerfilLenguaje): RegExp {
    const cacheado = this.lexicos.get(perfil);
    if (cacheado) return cacheado;

    const partes: string[] = [];

    /* Comentarios de bloque: en todos los lenguajes que los tienen. */
    if (perfil.comentarioBarra || perfil.marcado) {
      partes.push(String.raw`(?<com>/\*[\s\S]*?\*/|<!--[\s\S]*?-->)`);
    }
    if (perfil.comentarioBarra) partes.push(String.raw`(?<com2>//[^\n]*)`);
    if (perfil.consola) partes.push(String.raw`(?<flag>(?<=^|\s)--?[A-Za-z][\w-]*)`);
    if (perfil.comentarioAlmohadilla) partes.push(String.raw`(?<com3>#[^\n]*)`);
    if (perfil.comentarioGuion) partes.push(String.raw`(?<com4>--[^\n]*)`);

    partes.push(String.raw`(?<str>"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|\`(?:[^\`\\]|\\.)*\`)`);

    if (perfil.anotaciones) partes.push(String.raw`(?<ann>@[A-Za-z][\w.]*)`);
    if (perfil.marcado) partes.push(String.raw`(?<tag></?[A-Za-z][\w.:-]*|/?>)`);

    partes.push(String.raw`(?<num>\b\d[\d_.]*(?:[eE][+-]?\d+)?[LlFfDdn]?\b)`);
    partes.push(String.raw`(?<id>[A-Za-z_$][\w$]*)`);

    /* com2..com4 son variantes del mismo concepto (comentario), pero
       llevan nombres distintos porque una expresión regular no puede
       repetir el nombre de un grupo entre alternativas. */
    const re = new RegExp(partes.join('|'), 'g');
    this.lexicos.set(perfil, re);
    return re;
  }

  private envolver(categoria: Categoria, texto: string): string {
    return '<span class="c-' + categoria + '">' + this.escapar(texto) + '</span>';
  }

  private escapar(texto: string): string {
    return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}
