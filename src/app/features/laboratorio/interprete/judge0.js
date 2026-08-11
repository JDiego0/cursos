/* ============================================================
   MODO «SERVIDOR REAL» · Judge0

   Importado de legacy/cursos/algoritmia.html (sección 12b).
   Envía el código del alumno a ce.judge0.com para ejecutarlo en
   un Python, un Java y un Node auténticos.

   Es un añadido, nunca un sustituto: viene desactivado, no se
   toca la red al cargar la página, y si el servicio desapareciera
   el laboratorio seguiría funcionando entero con el intérprete
   local de algo-lab.js.
   ============================================================ */
import { AlgoLab } from './algo-lab.js';
const JUDGE0 = {
  url: 'https://ce.judge0.com/submissions?base64_encoded=false&wait=true',
  lenguajes: {
    python:     { id: 109, nombre: 'Python 3.13.2' },
    java:       { id: 91,  nombre: 'Java · JDK 17.0.6' },
    javascript: { id: 102, nombre: 'Node.js 22.08' }
  },
  msTimeout: 25000
};
const MARCA_OK = '<<<R>>>';
const MARCA_ERR = '<<<E>>>';

/* ---------- llamada al servicio ---------- */
async function ejecutarRemoto(codigo, lang){
  const info = JUDGE0.lenguajes[lang];
  const corte = new AbortController();
  const reloj = setTimeout(() => corte.abort(), JUDGE0.msTimeout);
  let r;
  try{
    r = await fetch(JUDGE0.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language_id: info.id, source_code: codigo }),
      signal: corte.signal
    });
  }catch(e){
    clearTimeout(reloj);
    throw new Error(navigator.onLine === false
      ? 'No hay conexión a internet. Desactiva ⚡ para usar el intérprete de la página.'
      : 'No se ha podido contactar con el servidor (' + (e.message || e) + ').');
  }
  clearTimeout(reloj);
  if(r.status === 429) throw new Error('El servidor ha recibido demasiadas peticiones seguidas. Espera unos segundos y vuelve a intentarlo.');
  if(!r.ok) throw new Error('El servidor ha respondido con un error HTTP ' + r.status + '.');
  const d = await r.json();
  return { motor: info.nombre, salida: d.stdout || '',
    error: d.compile_output || d.stderr || (d.status && d.status.id > 3 ? d.status.description : '') || '',
    estado: d.status ? d.status.description : '?', ms: Math.round(parseFloat(d.time || 0) * 1000) };
}

/* ---------- literales de Java a partir de los tipos de la firma ---------- */
function literalJava(v, tipo){
  tipo = (tipo || 'Object').trim();
  if(v === null || v === undefined) return 'null';
  if(tipo.endsWith('[]')){
    const base = tipo.slice(0, -2);
    return 'new ' + tipo + '{' + v.map(x => literalJava(x, base)).join(',') + '}';
  }
  if(tipo === 'String') return JSON.stringify(String(v));
  if(tipo === 'char') return "'" + v + "'";
  if(tipo === 'long') return String(v) + 'L';
  if(tipo === 'float') return String(v) + 'f';
  if(tipo === 'double' || tipo === 'Double') return Number.isInteger(v) ? v + '.0' : String(v);
  if(tipo === 'boolean' || tipo === 'Boolean') return v ? 'true' : 'false';
  return String(v);
}

/** Lee los tipos de los parámetros del propio código del alumno. */
function tiposDeLaFirma(codigo, fn){
  const re = new RegExp('static\\s+[\\w.<>\\[\\],\\s]+?\\s+' + fn + '\\s*\\(([^)]*)\\)');
  const m = re.exec(codigo);
  if(!m) return null;
  const dentro = m[1].trim();
  if(!dentro) return [];
  return dentro.split(',').map(p => {
    const t = p.trim().split(/\s+/);
    t.pop();                       // fuera el nombre del parámetro
    return t.join(' ');
  });
}

/* ---------- construir el programa que ejecuta los casos ---------- */
function programaDePrueba(codigo, lang, fn, casos){
  const args = casos.map(c => c[0]);

  if(lang === 'python'){
    return codigo + '\n\n' +
      '# --- comprobación automática (lo añade el laboratorio) ---\n' +
      'import json as __j\n' +
      '__casos = __j.loads(' + JSON.stringify(JSON.stringify(args)) + ')\n' +
      'for __a in __casos:\n' +
      '    try:\n' +
      '        print("' + MARCA_OK + '" + __j.dumps(' + fn + '(*__a), default=str))\n' +
      '    except Exception as __e:\n' +
      '        print("' + MARCA_ERR + '" + type(__e).__name__ + ": " + str(__e))\n';
  }

  if(lang === 'javascript'){
    return codigo + '\n\n' +
      '// --- comprobación automática (lo añade el laboratorio) ---\n' +
      'const __casos = JSON.parse(' + JSON.stringify(JSON.stringify(args)) + ');\n' +
      'for (const __a of __casos) {\n' +
      '  try { console.log("' + MARCA_OK + '" + JSON.stringify(' + fn + '(...__a))); }\n' +
      '  catch (__e) { console.log("' + MARCA_ERR + '" + ((__e &&  __e.message) || String(__e))); }\n' +
      '}\n';
  }

  /* Java: se sustituye la cabecera del main del alumno por el verificador,
     y su cuerpo original pasa a ser un método aparte que no se llama. */
  const tipos = tiposDeLaFirma(codigo, fn);
  if(!tipos) return null;
  const llamadas = args.map(a => {
    const ps = a.map((v, i) => literalJava(v, tipos[i])).join(', ');
    return '    try { System.out.println("' + MARCA_OK + '" + __ser(' + fn + '(' + ps + '))); }\n' +
           '    catch (Throwable __e) { System.out.println("' + MARCA_ERR + '" + __e); }';
  }).join('\n');

  const verificador =
    'public static void main(String[] __argv) throws Exception {\n' + llamadas + '\n  }\n\n' +
    '  static String __ser(Object o){\n' +
    '    if(o == null) return "null";\n' +
    '    if(o instanceof String) return "\\"" + o.toString().replace("\\\\","\\\\\\\\").replace("\\"","\\\\\\"") + "\\"";\n' +
    '    if(o instanceof Character) return "\\"" + o + "\\"";\n' +
    '    if(o.getClass().isArray()){\n' +
    '      StringBuilder sb = new StringBuilder("[");\n' +
    '      int n = java.lang.reflect.Array.getLength(o);\n' +
    '      for(int i = 0; i < n; i++){ if(i > 0) sb.append(","); sb.append(__ser(java.lang.reflect.Array.get(o, i))); }\n' +
    '      return sb.append("]").toString();\n' +
    '    }\n' +
    '    if(o instanceof java.util.Collection){\n' +
    '      StringBuilder sb = new StringBuilder("[");\n' +
    '      boolean primero = true;\n' +
    '      for(Object x : (java.util.Collection<?>) o){ if(!primero) sb.append(","); primero = false; sb.append(__ser(x)); }\n' +
    '      return sb.append("]").toString();\n' +
    '    }\n' +
    '    return o.toString();\n' +
    '  }\n\n' +
    '  static void __mainDelAlumno(String[] args) {';

  const reMain = /(?:public\s+)?static\s+void\s+main\s*\([^)]*\)\s*(?:throws[^{]*)?\{/;
  if(!reMain.test(codigo)) return null;
  return codigo.replace(reMain, verificador);
}

/* ---------- interpretar la salida marcada ---------- */
function leerResultados(salida, casos, compare){
  const lineas = (salida || '').split('\n');
  const res = [];
  let i = 0;
  for(const l of lineas){
    if(l.startsWith(MARCA_OK)){
      let got;
      try{ got = JSON.parse(l.slice(MARCA_OK.length)); }catch(e){ got = l.slice(MARCA_OK.length); }
      const esperado = casos[i] ? casos[i][1] : null;
      const ok = compare === 'set'
        ? AlgoLab.same(AlgoLab.sortDeep(got), AlgoLab.sortDeep(esperado))
        : AlgoLab.same(got, esperado);
      res.push({ args: casos[i] ? casos[i][0] : [], expected: esperado, got: got, ok: ok });
      i++;
    }else if(l.startsWith(MARCA_ERR)){
      res.push({ args: casos[i] ? casos[i][0] : [], expected: casos[i] ? casos[i][1] : null,
        got: null, ok: false, error: { name: 'Error', message: l.slice(MARCA_ERR.length), line: 0 } });
      i++;
    }
  }
  return res;
}

export { JUDGE0, MARCA_OK, MARCA_ERR, ejecutarRemoto, programaDePrueba, leerResultados };
