/* ============================================================
   migrar-contenido.js
   Convierte los cursos monolíticos de legacy/ en datos JSON que
   consume la aplicación Angular.

       node herramientas/migrar-contenido.js

   Entrada   legacy/index.html          catálogo de cursos (const CURSOS)
             legacy/cursos/<id>.html    contenido de cada curso
   Salida    public/contenido/catalogo.json
             public/contenido/<id>.json

   Se ejecuta una sola vez en la migración, y después cada vez que
   se toque un curso legacy. Cuando el contenido se edite ya sólo
   en los JSON, este script deja de hacer falta.
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');
const LEGACY = path.join(RAIZ, 'legacy');
const CURSOS_DIR = path.join(LEGACY, 'cursos');
const SALIDA = path.join(RAIZ, 'public', 'contenido');

/* ============================================================
   1. UTILIDADES DE PARSEO HTML
   ============================================================ */

/** Índice justo después del `>` que cierra la etiqueta que empieza en `i`. */
function finApertura(html, i) {
  let comilla = null;
  for (let k = i; k < html.length; k++) {
    const c = html[k];
    if (comilla) {
      if (c === comilla) comilla = null;
      continue;
    }
    if (c === '"' || c === "'") comilla = c;
    else if (c === '>') return k + 1;
  }
  return html.length;
}

/**
 * Extrae el bloque de la etiqueta `tag` que empieza en el índice `i`,
 * contando anidamientos. Devuelve { apertura, inner, fin }.
 */
function bloque(html, i, tag) {
  const inicio = finApertura(html, i);
  const re = new RegExp('<' + tag + '(?=[\\s>/])|</' + tag + '\\s*>', 'gi');
  re.lastIndex = inicio;
  let nivel = 1;
  let m;
  while ((m = re.exec(html))) {
    if (m[0][1] === '/') {
      if (--nivel === 0) {
        return { apertura: html.slice(i, inicio), inner: html.slice(inicio, m.index), fin: re.lastIndex };
      }
    } else {
      nivel++;
      re.lastIndex = finApertura(html, m.index);
    }
  }
  throw new Error('Etiqueta <' + tag + '> sin cerrar en el índice ' + i);
}

/** Primer bloque cuya etiqueta de apertura casa con `patron`. */
function buscarBloque(html, patron, tag, desde = 0) {
  patron.lastIndex = desde;
  const m = patron.exec(html);
  if (!m) return null;
  return bloque(html, m.index, tag);
}

/** Todos los bloques cuya apertura casa con `patron`, sin solaparse. */
function todosLosBloques(html, patron, tag) {
  const out = [];
  let desde = 0;
  for (;;) {
    const re = new RegExp(patron.source, patron.flags.includes('g') ? patron.flags : patron.flags + 'g');
    re.lastIndex = desde;
    const m = re.exec(html);
    if (!m) return out;
    const b = bloque(html, m.index, tag);
    out.push(b);
    desde = b.fin;
  }
}

const atributo = (apertura, nombre) => {
  const m = new RegExp(nombre + '="([^"]*)"').exec(apertura);
  return m ? m[1] : '';
};

const texto = (html) =>
  html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

const limpiar = (html) => html.replace(/^\s*\n|\s+$/g, '').trimEnd();

/* ============================================================
   2. UTILIDADES DE PARSEO JAVASCRIPT
   ============================================================ */

/**
 * Extrae un literal de array/objeto declarado como `const NOMBRE = [...]`
 * y lo evalúa. Sólo se usa sobre archivos propios del repositorio.
 */
function literalJS(src, nombre) {
  const m = new RegExp('const\\s+' + nombre + '\\s*=\\s*').exec(src);
  if (!m) return null;
  let i = m.index + m[0].length;
  const abre = src[i];
  const cierra = abre === '[' ? ']' : '}';
  if (abre !== '[' && abre !== '{') return null;

  let nivel = 0;
  let comilla = null;
  let comentario = null;
  for (let k = i; k < src.length; k++) {
    const c = src[k];
    const sig = src[k + 1];

    if (comentario === 'linea') {
      if (c === '\n') comentario = null;
      continue;
    }
    if (comentario === 'bloque') {
      if (c === '*' && sig === '/') { comentario = null; k++; }
      continue;
    }
    if (comilla) {
      if (c === '\\') { k++; continue; }
      if (c === comilla) comilla = null;
      continue;
    }
    if (c === '/' && sig === '/') { comentario = 'linea'; k++; continue; }
    if (c === '/' && sig === '*') { comentario = 'bloque'; k++; continue; }
    if (c === '"' || c === "'" || c === '`') { comilla = c; continue; }
    if (c === abre) nivel++;
    else if (c === cierra) {
      if (--nivel === 0) {
        const codigo = src.slice(i, k + 1);
        return new Function('return ' + codigo)();
      }
    }
  }
  return null;
}

/* ============================================================
   3. EXTRACCIÓN DE UN CURSO
   ============================================================ */

/** Portada del curso: héroe, estadísticas y cuerpo libre. */
function extraerPortada(html, totalCapitulos) {
  const sec = buscarBloque(html, /<section class="view" id="inicio">/g, 'section');
  if (!sec) return null;
  const dentro = sec.inner;

  const hero = buscarBloque(dentro, /<div class="hero">/g, 'div');
  const kicker = hero ? buscarBloque(hero.inner, /<div class="kicker">/g, 'div') : null;
  const titulo = hero ? buscarBloque(hero.inner, /<h1 class="page-title">/g, 'h1') : null;
  const lead = hero ? buscarBloque(hero.inner, /<p class="lead">/g, 'p') : null;

  const filaStats = buscarBloque(dentro, /<div class="stat-row">/g, 'div');
  const stats = filaStats
    ? todosLosBloques(filaStats.inner, /<div class="stat">/g, 'div').map((s) => {
        const valor = buscarBloque(s.inner, /<b[\s>]/g, 'b');
        const etiqueta = buscarBloque(s.inner, /<span[\s>]/g, 'span');
        const bruto = valor ? texto(valor.inner) : '';
        const esContador = valor && /id="statCh"/.test(valor.apertura);
        return {
          valor: esContador || !bruto ? String(totalCapitulos) : bruto,
          etiqueta: etiqueta ? texto(etiqueta.inner) : '',
        };
      })
    : [];

  const iCuerpo = dentro.indexOf('<h2 class="sec">');
  return {
    kicker: kicker ? texto(kicker.inner) : '',
    titulo: titulo ? limpiar(titulo.inner) : '',
    lead: lead ? limpiar(lead.inner) : '',
    stats,
    cuerpo: iCuerpo === -1 ? '' : limpiar(dentro.slice(iCuerpo)),
  };
}

/** Cabecera y nota final de la vista «estado del proyecto». */
function extraerEstado(html) {
  const sec = buscarBloque(html, /<section class="view" id="estado">/g, 'section');
  if (!sec) return null;
  const dentro = sec.inner;

  const crumb = buscarBloque(dentro, /<div class="crumb">/g, 'div');
  const titulo = buscarBloque(dentro, /<h1 class="page-title">/g, 'h1');
  const lead = buscarBloque(dentro, /<p class="lead">/g, 'p');
  const etiquetaPct = buscarBloque(dentro, /<div class="pct">/g, 'div');

  const iNota = dentro.lastIndexOf('<div class="note');
  const nota = iNota === -1 ? null : bloque(dentro, iNota, 'div');

  return {
    crumb: crumb ? texto(crumb.inner) : 'Panel permanente',
    titulo: titulo ? limpiar(titulo.inner) : 'Estado del proyecto',
    lead: lead ? limpiar(lead.inner) : '',
    etiquetaProgreso: etiquetaPct ? texto((buscarBloque(etiquetaPct.inner, /<span[\s>]/g, 'span') || { inner: '' }).inner) : 'Proyecto completado',
    nota: nota ? limpiar(nota.inner) : '',
  };
}

/** Un capítulo: metadatos, objetivo y sus acordeones. */
function extraerCapitulo(b) {
  const { apertura, inner } = b;

  const iGoal = inner.indexOf('<div class="goal">');
  const objetivo = iGoal === -1 ? '' : limpiar(bloque(inner, iGoal, 'div').inner);

  const acordeones = todosLosBloques(inner, /<details class="acc"/g, 'details').map((acc, i) => {
    const sum = buscarBloque(acc.inner, /<summary[\s>]/g, 'summary');
    const cuerpo = buscarBloque(acc.inner, /<div class="acc-body">/g, 'div');
    return {
      id: 'acc-' + i,
      titulo: sum ? texto(sum.inner) : 'Sección ' + (i + 1),
      abiertoPorDefecto: /\sopen[\s>]/.test(acc.apertura),
      html: cuerpo ? limpiar(cuerpo.inner) : limpiar(acc.inner),
    };
  });

  return {
    num: Number(atributo(apertura, 'data-num')),
    titulo: atributo(apertura, 'data-title'),
    corto: atributo(apertura, 'data-short') || atributo(apertura, 'data-title'),
    modulo: atributo(apertura, 'data-module'),
    duracion: atributo(apertura, 'data-time'),
    nivel: atributo(apertura, 'data-level'),
    icono: atributo(apertura, 'data-icon') || '📘',
    conceptos: atributo(apertura, 'data-concepts').split('|').filter(Boolean),
    objetivo,
    acordeones,
  };
}

function extraerCurso(id) {
  const html = fs.readFileSync(path.join(CURSOS_DIR, id + '.html'), 'utf8');

  const iScript = html.lastIndexOf('<script>');
  const script = html.slice(iScript);

  const capitulos = todosLosBloques(html, /<section class="view chapter"/g, 'section').map(extraerCapitulo);
  capitulos.sort((a, b) => a.num - b.num);

  const mClave = /const STORE_KEY\s*=\s*'([^']+)'/.exec(script);
  const mTitulo = /<title>([^<]*)<\/title>/.exec(html);
  const mDesc = /<meta name="description" content="([^"]*)"/.exec(html);

  return {
    id,
    claveAlmacen: mClave ? mClave[1] : id + '-v1',
    titulo: mTitulo ? mTitulo[1].trim() : id,
    descripcion: mDesc ? mDesc[1] : '',
    portada: extraerPortada(html, capitulos.length),
    estado: extraerEstado(html),
    arquitectura: literalJS(script, 'ARCH') || [],
    artefactos: (literalJS(script, 'RESOURCES') || []).map(([nombre, donde, cap]) => ({
      nombre,
      donde,
      capitulo: cap,
    })),
    glosario: (literalJS(script, 'GLOSARIO') || []).map(([termino, definicion]) => ({ termino, definicion })),
    chuleta: (literalJS(script, 'CHULETA') || []).map(([clave, para]) => ({ clave, para })),
    /* Sólo algoritmia trae laboratorios; en el resto queda vacío. */
    laboratorios: literalJS(script, 'LABS') || {},
    capitulos,
  };
}

/* ============================================================
   4. CATÁLOGO (desde legacy/index.html)
   ============================================================ */

function extraerCatalogo() {
  const src = fs.readFileSync(path.join(LEGACY, 'index.html'), 'utf8');
  const cursos = literalJS(src, 'CURSOS');
  if (!cursos) throw new Error('No encuentro el array CURSOS en legacy/index.html');

  const color = (nombre) => {
    const m = new RegExp('--' + nombre + ':\\s*(#[0-9a-fA-F]{3,8})').exec(src);
    return m ? m[1] : '#8e8fa0';
  };

  return cursos.map((c) => ({
    id: c.id,
    claveAlmacen: c.key,
    nombre: c.name,
    tecnologia: c.tech,
    icono: c.icon,
    proyecto: c.proyecto,
    proyectoDesc: c.proyectoDesc,
    horas: c.horas,
    nivel: c.nivel,
    descripcion: c.desc,
    temas: c.temas || [],
    colores: {
      base: color('b-' + c.id),
      suave: color('s-' + c.id),
      texto: color('c-' + c.id),
    },
  }));
}

/* ============================================================
   5. VERIFICACIÓN
   Comprueba que lo extraído cumple las reglas del proyecto. Un
   fallo aquí significa que el curso legacy está mal formado o que
   el extractor se ha quedado corto: en los dos casos hay que
   mirarlo antes de publicar.
   ============================================================ */

function verificar(curso, ficha) {
  const fallos = [];
  const avisos = [];
  const numeros = new Set(curso.capitulos.map((c) => c.num));

  if (!curso.claveAlmacen) fallos.push('no tiene STORE_KEY');
  if (!curso.portada) fallos.push('no se pudo leer la vista de inicio');
  if (!curso.estado) fallos.push('no se pudo leer la vista de estado');
  if (!curso.capitulos.length) fallos.push('no tiene capítulos');

  /* Regla del proyecto: capítulos correlativos desde 0. */
  curso.capitulos.forEach((cap, i) => {
    if (cap.num !== i) fallos.push('el capítulo ' + i + ' está numerado como ' + cap.num);
    if (!cap.titulo) fallos.push('el capítulo ' + cap.num + ' no tiene data-title');
    if (!cap.modulo) fallos.push('el capítulo ' + cap.num + ' no tiene data-module');
    if (!cap.duracion) avisos.push('el capítulo ' + cap.num + ' no tiene data-time');
    if (!cap.nivel) avisos.push('el capítulo ' + cap.num + ' no tiene data-level');
    if (!cap.conceptos.length) avisos.push('el capítulo ' + cap.num + ' no tiene data-concepts');
    if (!cap.objetivo) fallos.push('el capítulo ' + cap.num + ' no tiene caja .goal');
    if (cap.acordeones.length !== 8) {
      fallos.push('el capítulo ' + cap.num + ' tiene ' + cap.acordeones.length + ' acordeones, no 8');
    }
    for (const acc of cap.acordeones) {
      if (!acc.html.trim()) fallos.push('el capítulo ' + cap.num + ' tiene el acordeón «' + acc.titulo + '» vacío');
    }
  });

  /* Los módulos agrupan capítulos consecutivos. */
  const vistos = new Set();
  let anterior = null;
  for (const cap of curso.capitulos) {
    if (cap.modulo !== anterior) {
      if (vistos.has(cap.modulo)) fallos.push('el módulo «' + cap.modulo + '» aparece en dos tramos separados');
      vistos.add(cap.modulo);
      anterior = cap.modulo;
    }
  }

  /* Cada capítulo aporta al menos un nodo y una fila. */
  const conNodo = new Set(curso.arquitectura.flatMap((capa) => capa.nodes.map((n) => n.ch)));
  const conFila = new Set(curso.artefactos.map((a) => a.capitulo));
  for (const n of numeros) {
    if (!conNodo.has(n)) avisos.push('el capítulo ' + n + ' no aporta ningún nodo a ARCH');
    if (!conFila.has(n)) avisos.push('el capítulo ' + n + ' no aporta ninguna fila a RESOURCES');
  }
  for (const ch of conNodo) {
    if (!numeros.has(ch)) fallos.push('ARCH apunta al capítulo ' + ch + ', que no existe');
  }
  for (const ch of conFila) {
    if (!numeros.has(ch)) fallos.push('RESOURCES apunta al capítulo ' + ch + ', que no existe');
  }

  /* El contenido tiene que ser inerte: se inyecta con innerHTML. */
  const todoElHtml = curso.capitulos
    .map((c) => c.objetivo + c.acordeones.map((a) => a.html).join(''))
    .join('');
  /* Ojo: los cursos enseñan código, así que el texto está lleno de
     «&lt;button onClick=…&gt;» escapados. Eso es contenido, no
     marcado. Sólo preocupa lo que aparece dentro de una etiqueta
     real, es decir, entre un «<» sin escapar y su «>». */
  if (/<script[\s>]/i.test(todoElHtml)) fallos.push('el contenido lleva una etiqueta <script>');
  const manejador = /<[a-zA-Z][^<>]*\son[a-z]+\s*=/i.exec(todoElHtml);
  if (manejador) fallos.push('el contenido lleva un manejador on*= : ' + manejador[0].slice(-60));
  const javascriptUrl = /<[a-zA-Z][^<>]*(?:href|src)\s*=\s*"\s*javascript:/i.exec(todoElHtml);
  if (javascriptUrl) fallos.push('el contenido lleva un enlace javascript:');

  /* Todo bloque de código lleva su etiqueta de lenguaje. */
  const bloques = (todoElHtml.match(/<div class="code-block"/g) || []).length;
  const conLang = (todoElHtml.match(/<div class="code-block" data-lang="/g) || []).length;
  if (bloques !== conLang) avisos.push(bloques - conLang + ' bloques de código sin data-lang');

  /* Los laboratorios referenciados existen. */
  const referencias = [...todoElHtml.matchAll(/data-lab="([^"]+)"/g)].map((m) => m[1]);
  for (const ref of referencias) {
    if (!curso.laboratorios[ref]) fallos.push('falta el ejercicio «' + ref + '» en LABS');
  }

  if (ficha && ficha.claveAlmacen !== curso.claveAlmacen) {
    fallos.push('la clave del catálogo (' + ficha.claveAlmacen + ') no es la del curso (' + curso.claveAlmacen + ')');
  }

  return { fallos, avisos };
}

/* ============================================================
   6. EJECUCIÓN
   ============================================================ */

function main() {
  if (!fs.existsSync(CURSOS_DIR)) {
    console.error('No existe ' + CURSOS_DIR);
    process.exit(1);
  }
  fs.mkdirSync(SALIDA, { recursive: true });

  const catalogo = extraerCatalogo();
  const enDisco = fs
    .readdirSync(CURSOS_DIR)
    .filter((f) => f.endsWith('.html'))
    .map((f) => path.basename(f, '.html'));

  const resumen = [];
  for (const ficha of catalogo) {
    if (!enDisco.includes(ficha.id)) {
      console.warn('⚠  ' + ficha.id + ' está en el catálogo pero no en legacy/cursos/; se omite.');
      continue;
    }
    const curso = extraerCurso(ficha.id);

    /* El catálogo manda en los metadatos; el archivo manda en el contenido. */
    curso.nombre = ficha.nombre;
    curso.icono = ficha.icono;
    curso.proyecto = ficha.proyecto;

    fs.writeFileSync(path.join(SALIDA, ficha.id + '.json'), JSON.stringify(curso), 'utf8');

    ficha.totalCapitulos = curso.capitulos.length;
    ficha.modulos = [...new Set(curso.capitulos.map((c) => c.modulo))];
    ficha.capitulos = curso.capitulos.map((c) => ({
      num: c.num,
      corto: c.corto,
      titulo: c.titulo,
      modulo: c.modulo,
      duracion: c.duracion,
      nivel: c.nivel,
      icono: c.icono,
      conceptos: c.conceptos,
    }));

    const acc = curso.capitulos.reduce((n, c) => n + c.acordeones.length, 0);
    const { fallos, avisos } = verificar(curso, ficha);
    resumen.push({
      id: ficha.id,
      caps: curso.capitulos.length,
      acc,
      glos: curso.glosario.length,
      fallos,
      avisos,
    });
  }

  fs.writeFileSync(path.join(SALIDA, 'catalogo.json'), JSON.stringify(catalogo), 'utf8');

  console.log('Contenido generado en public/contenido/\n');
  for (const r of resumen) {
    const marca = r.fallos.length ? '✗' : r.avisos.length ? '!' : '✓';
    console.log(
      '  ' + marca + ' ' + r.id.padEnd(12) + String(r.caps).padStart(2) + ' cap · ' +
      String(r.acc).padStart(3) + ' acordeones · ' + String(r.glos).padStart(2) + ' términos'
    );
    for (const f of r.fallos) console.log('      ✗ ' + f);
    for (const a of r.avisos.slice(0, 6)) console.log('      ! ' + a);
    if (r.avisos.length > 6) console.log('      ! …y ' + (r.avisos.length - 6) + ' avisos más');
  }

  const tot = resumen.reduce((n, r) => n + r.caps, 0);
  const conFallos = resumen.filter((r) => r.fallos.length);
  console.log('\n' + (conFallos.length ? '✗' : '✓') + ' ' + resumen.length + ' cursos, ' + tot + ' capítulos.');

  if (conFallos.length) {
    console.error('\nHay ' + conFallos.length + ' curso(s) con problemas. El contenido se ha escrito igualmente,');
    console.error('pero revísalos antes de publicar.');
    process.exitCode = 1;
  }
}

main();
