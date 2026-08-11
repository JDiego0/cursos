/* ============================================================
   generar-catalogo.js  ·  SÓLO PARA EL PANEL LEGACY

   Relee los data-* de cada curso de legacy/cursos/ y reescribe el
   bloque CAPS de legacy/index.html:

       node herramientas/generar-catalogo.js

   ⚠ La aplicación Angular NO usa este script. Su catálogo y su
   contenido los genera `node herramientas/migrar-contenido.js`,
   que además valida lo extraído.

   Esto sólo sirve para mantener al día el panel HTML de legacy/,
   que se conserva para poder seguir abriendo los cursos con doble
   clic mientras dure la transición. Cuando legacy/ desaparezca,
   este archivo se va con él.
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');

const RAIZ    = path.resolve(__dirname, '..');
const LEGACY  = path.join(RAIZ, 'legacy');
const CURSOS  = path.join(LEGACY, 'cursos');
const INDEX   = path.join(LEGACY, 'index.html');
const INICIO  = '/* __CAPS_INICIO__ */';
const FIN     = '/* __CAPS_FIN__ */';

/* --- 1. Localizar los cursos --------------------------------- */
if(!fs.existsSync(CURSOS)){
  console.error('No existe la carpeta ' + CURSOS);
  process.exit(1);
}
const archivos = fs.readdirSync(CURSOS)
  .filter(f => f.endsWith('.html'))
  .sort();

if(!archivos.length){
  console.error('No hay ningún .html en ' + CURSOS);
  process.exit(1);
}

/* --- 2. Extraer los capítulos de cada uno -------------------- */
const comilla = s => "'" + String(s == null ? '' : s)
  .replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";

const catalogo = {};
for(const archivo of archivos){
  const id   = path.basename(archivo, '.html');
  const html = fs.readFileSync(path.join(CURSOS, archivo), 'utf8');
  const re   = /<section class="view chapter"([\s\S]*?)>/g;
  const filas = [];
  let m;
  while((m = re.exec(html))){
    const attrs = m[1];
    const dato = k => { const r = new RegExp(k + '="([^"]*)"').exec(attrs); return r ? r[1] : ''; };
    filas.push('  {n:' + Number(dato('data-num')) +
      ',s:'  + comilla(dato('data-short') || dato('data-title')) +
      ',t:'  + comilla(dato('data-title')) +
      ',m:'  + comilla(dato('data-module')) +
      ',h:'  + comilla(dato('data-time')) +
      ',lv:' + comilla(dato('data-level')) +
      ',i:'  + comilla(dato('data-icon') || '📘') +
      ',c:'  + comilla(dato('data-concepts')) + '}');
  }
  if(!filas.length){
    console.warn('⚠  ' + archivo + ' no tiene ninguna <section class="view chapter">; se omite.');
    continue;
  }
  catalogo[id] = filas;
}

/* --- 3. Reescribir el bloque CAPS del index ------------------ */
let bloque = INICIO + '\nconst CAPS = {\n';
for(const id of Object.keys(catalogo)){
  bloque += ' ' + id + ': [\n' + catalogo[id].join(',\n') + '\n ],\n';
}
bloque += '};\n' + FIN;

const src = fs.readFileSync(INDEX, 'utf8');
const a = src.indexOf(INICIO);
const b = src.indexOf(FIN);
if(a === -1 || b === -1){
  console.error('No encuentro las marcas ' + INICIO + ' … ' + FIN + ' en index.html.');
  process.exit(1);
}
fs.writeFileSync(INDEX, src.slice(0, a) + bloque + src.slice(b + FIN.length), 'utf8');

/* --- 4. Comprobar que catálogo e index están alineados -------- */
const idsIndex = [...src.matchAll(/\{\s*id:'([a-z0-9-]+)'/g)].map(m => m[1]);
const idsDisco = Object.keys(catalogo);
const sinFicha  = idsDisco.filter(id => !idsIndex.includes(id));
const sinCurso  = idsIndex.filter(id => !idsDisco.includes(id));

idsDisco.forEach(id => console.log('  ' + id.padEnd(10) + catalogo[id].length + ' capítulos'));
console.log('✓ index.html actualizado con ' +
  idsDisco.reduce((n, id) => n + catalogo[id].length, 0) + ' capítulos de ' + idsDisco.length + ' cursos.');

if(sinFicha.length) console.warn('⚠  En cursos/ pero sin entrada en CURSOS del index: ' + sinFicha.join(', '));
if(sinCurso.length) console.warn('⚠  En CURSOS del index pero sin archivo en cursos/: ' + sinCurso.join(', '));
