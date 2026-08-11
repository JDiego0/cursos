import { Injectable, computed, inject, signal } from '@angular/core';

import { Curso, EntradaIndice, ResultadoBusqueda } from '@core/models';
import { CatalogoStore } from '@core/state/catalogo.store';

/**
 * Pliega un carácter: sin acento y en minúscula. Devuelve siempre
 * un carácter, nunca cero ni dos, que es lo que permite comparar
 * por posiciones sin que se descoloque el resaltado.
 */
const plegarChar = (c: string): string => {
  const base = c.normalize('NFD').replace(/\p{M}/gu, '');
  return (base || c).toLowerCase();
};

/**
 * Pliega manteniendo una posición por carácter real.
 *
 * Se trabaja con `Array.from` y no con la cadena directamente porque
 * el contenido lleva emoji: en UTF-16 ocupan dos unidades, y cortar
 * por índices de cadena los partiría por la mitad.
 */
const plegarAlineado = (texto: string): string[] => Array.from(texto).map(plegarChar);

/** Pliega para comparar, cuando la posición da igual. */
const normalizar = (texto: string): string => plegarAlineado(texto).join('');

/** Posición (en caracteres reales) de `aguja` dentro de `pajar`. */
const posicionDe = (pajar: string[], aguja: string[]): number => {
  if (!aguja.length || aguja.length > pajar.length) return -1;
  for (let i = 0; i <= pajar.length - aguja.length; i++) {
    let casa = true;
    for (let k = 0; k < aguja.length; k++) {
      if (pajar[i + k] !== aguja[k]) {
        casa = false;
        break;
      }
    }
    if (casa) return i;
  }
  return -1;
};

/** HTML → texto plano, para poder buscar dentro del contenido. */
const aTextoPlano = (html: string): string =>
  html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

const MAX_RESULTADOS = 24;
const LARGO_FRAGMENTO = 130;

/**
 * Buscador global.
 *
 * El índice tiene dos niveles:
 *
 * - **Siempre**: los cursos y los 158 capítulos del catálogo, con su
 *   título, módulo y conceptos clave. Basta con el catálogo (56 kB),
 *   así que se puede buscar en todo desde el primer segundo.
 * - **Cuando se abre un curso**: además, el texto completo de sus
 *   ocho acordeones por capítulo. Se añade al índice al cargarlo y
 *   se queda para el resto de la sesión.
 *
 * Así se busca en todo el temario sin descargar los 7 MB de
 * contenido, y dentro del curso que estás estudiando se busca
 * también en el cuerpo de las explicaciones.
 */
@Injectable({ providedIn: 'root' })
export class BusquedaService {
  private readonly catalogo = inject(CatalogoStore);

  /** Texto completo de los cursos ya cargados, por id de curso. */
  private readonly textoCompleto = signal<Record<string, EntradaIndice[]>>({});

  private readonly indice = computed<EntradaIndice[]>(() => {
    const entradas: EntradaIndice[] = [];

    for (const ficha of this.catalogo.fichas()) {
      entradas.push({
        tipo: 'curso',
        cursoId: ficha.id,
        cursoNombre: ficha.nombre,
        titulo: ficha.nombre,
        contexto: ficha.tecnologia + ' · proyecto ' + ficha.proyecto,
        texto: normalizar(
          [ficha.nombre, ficha.tecnologia, ficha.proyecto, ficha.proyectoDesc, ...ficha.temas].join(' '),
        ),
        textoOriginal: aTextoPlano(ficha.descripcion),
      });

      for (const cap of ficha.capitulos) {
        entradas.push({
          tipo: 'capitulo',
          cursoId: ficha.id,
          cursoNombre: ficha.nombre,
          capitulo: cap.num,
          titulo: cap.titulo,
          contexto: cap.modulo + ' · Capítulo ' + cap.num,
          texto: normalizar([cap.titulo, cap.corto, cap.modulo, ...cap.conceptos].join(' ')),
          textoOriginal: cap.conceptos.join(' · '),
        });
      }
    }

    for (const extra of Object.values(this.textoCompleto())) {
      entradas.push(...extra);
    }
    return entradas;
  });

  /** Añade al índice el texto de los acordeones de un curso cargado. */
  indexarCurso(curso: Curso): void {
    if (this.textoCompleto()[curso.id]) return;

    const entradas: EntradaIndice[] = [];
    for (const cap of curso.capitulos) {
      for (const acc of cap.acordeones) {
        const plano = aTextoPlano(acc.html);
        entradas.push({
          tipo: 'capitulo',
          cursoId: curso.id,
          cursoNombre: curso.nombre,
          capitulo: cap.num,
          titulo: cap.titulo,
          contexto: acc.titulo + ' · Capítulo ' + cap.num,
          texto: normalizar(plano),
          textoOriginal: plano,
        });
      }
    }
    this.textoCompleto.update((actual) => ({ ...actual, [curso.id]: entradas }));
  }

  /**
   * Busca y devuelve los resultados ordenados. Se puede acotar a un
   * curso (buscador de dentro del curso) o dejar abierto (buscador
   * del panel).
   */
  buscar(consulta: string, cursoId?: string): ResultadoBusqueda[] {
    const q = normalizar(consulta.trim());
    if (q.length < 2) return [];

    const vistos = new Set<string>();
    const salida: ResultadoBusqueda[] = [];

    for (const entrada of this.indice()) {
      if (cursoId && entrada.cursoId !== cursoId) continue;

      const enTitulo = normalizar(entrada.titulo).includes(q);
      const posicion = entrada.texto.indexOf(q);
      if (!enTitulo && posicion === -1) continue;

      /* Un capítulo aparece una sola vez aunque case en varios sitios. */
      const llave = entrada.cursoId + '#' + (entrada.capitulo ?? 'curso');
      if (vistos.has(llave)) continue;
      vistos.add(llave);

      salida.push({
        tipo: entrada.tipo,
        cursoId: entrada.cursoId,
        cursoNombre: entrada.cursoNombre,
        capitulo: entrada.capitulo,
        titulo: this.marcar(entrada.titulo, consulta),
        contexto: entrada.contexto,
        fragmento: this.fragmento(entrada.textoOriginal, consulta),
        peso: (enTitulo ? 100 : 0) + (entrada.tipo === 'curso' ? 50 : 0) - Math.min(posicion, 49),
      });

      if (salida.length >= MAX_RESULTADOS * 3) break;
    }

    return salida.sort((a, b) => b.peso - a.peso).slice(0, MAX_RESULTADOS);
  }

  /* ---------- Interno ---------- */

  /** Recorta alrededor de la coincidencia y la resalta. */
  private fragmento(texto: string, consulta: string): string {
    if (!texto) return '';
    const chars = Array.from(texto);
    const i = posicionDe(plegarAlineado(texto), plegarAlineado(consulta.trim()));
    if (i === -1) return this.escapar(chars.slice(0, LARGO_FRAGMENTO).join(''));

    const desde = Math.max(0, i - 45);
    const hasta = Math.min(chars.length, i + LARGO_FRAGMENTO - 45);
    const trozo =
      (desde > 0 ? '…' : '') + chars.slice(desde, hasta).join('') + (hasta < chars.length ? '…' : '');
    return this.marcar(trozo, consulta);
  }

  /**
   * Envuelve cada coincidencia en `<mark>`. El texto se escapa trozo
   * a trozo al construir la salida, así que ni el contenido ni la
   * consulta pueden inyectar HTML.
   */
  private marcar(texto: string, consulta: string): string {
    const chars = Array.from(texto);
    const plegado = plegarAlineado(texto);
    const aguja = plegarAlineado(consulta.trim());
    if (!aguja.length) return this.escapar(texto);

    let salida = '';
    let cursor = 0;
    for (;;) {
      const i = posicionDe(plegado.slice(cursor), aguja);
      if (i === -1) break;
      const inicio = cursor + i;
      const fin = inicio + aguja.length;
      salida +=
        this.escapar(chars.slice(cursor, inicio).join('')) +
        '<mark>' +
        this.escapar(chars.slice(inicio, fin).join('')) +
        '</mark>';
      cursor = fin;
    }
    return salida + this.escapar(chars.slice(cursor).join(''));
  }

  private escapar(texto: string): string {
    return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}
