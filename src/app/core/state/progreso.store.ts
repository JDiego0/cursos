import { DOCUMENT } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';

import {
  EstadoCurso,
  FichaCurso,
  ProgresoCurso,
  ProgresoGlobal,
  RegistroAlmacen,
} from '@core/models';
import { AlmacenamientoService } from '@core/services/almacenamiento.service';
import { CatalogoStore } from './catalogo.store';

/** Formato de la copia de seguridad. Es el mismo del panel legacy. */
interface Copia {
  panel: string;
  fecha: string;
  datos: Record<string, string>;
}

const PROGRESO_VACIO: ProgresoCurso = {
  hechos: [],
  set: new Set<number>(),
  ultimo: null,
  total: 0,
  pct: 0,
  tocado: false,
};

/**
 * Progreso del alumno: qué capítulos lleva completados y por dónde
 * iba, en cada curso.
 *
 * Decisión importante de la migración: se conservan **las mismas
 * claves de localStorage que usaban los cursos legacy**
 * (`java-librotech-v1`, `react-cinenaka-v1`…), así que quien ya
 * estudiaba con los HTML sueltos abre la aplicación Angular y
 * encuentra su avance intacto.
 *
 * Al escribir se normaliza al esquema `completed` / `last`, pero
 * **el registro se fusiona, no se sustituye**: las claves que no
 * son nuestras (el código de los laboratorios, el idioma elegido)
 * sobreviven.
 *
 * Todo cuelga de un `computed` que se recalcula cuando cambia
 * `revision`. Así una escritura, un `releer()` o un cambio hecho en
 * otra pestaña refrescan a la vez el anillo, las barras y el mapa.
 */
@Injectable({ providedIn: 'root' })
export class ProgresoStore {
  private readonly almacen = inject(AlmacenamientoService);
  private readonly catalogo = inject(CatalogoStore);
  private readonly documento = inject(DOCUMENT);

  /** Se incrementa en cada cambio para invalidar los `computed`. */
  private readonly revision = signal(0);

  readonly porCurso = computed<Record<string, ProgresoCurso>>(() => {
    this.revision();
    const mapa: Record<string, ProgresoCurso> = {};
    for (const ficha of this.catalogo.fichas()) {
      mapa[ficha.id] = this.leerDeAlmacen(ficha);
    }
    return mapa;
  });

  readonly global = computed<ProgresoGlobal>(() => {
    const fichas = this.catalogo.fichas();
    const mapa = this.porCurso();

    let hechos = 0;
    let totales = 0;
    let completados = 0;
    let enCurso = 0;

    for (const ficha of fichas) {
      const p = mapa[ficha.id] ?? PROGRESO_VACIO;
      hechos += p.set.size;
      totales += p.total;
      if (p.total > 0 && p.set.size >= p.total) completados++;
      else if (p.set.size > 0 || p.ultimo !== null) enCurso++;
    }

    return {
      capitulosHechos: hechos,
      capitulosTotales: totales,
      pct: totales ? Math.round((hechos / totales) * 100) : 0,
      cursosCompletados: completados,
      cursosEnCurso: enCurso,
    };
  });

  constructor() {
    /* Si el alumno estudia en dos pestañas, la que está en segundo
       plano se entera del avance de la otra. */
    addEventListener('storage', () => this.releer());
    this.documento.addEventListener('visibilitychange', () => {
      if (!this.documento.hidden) this.releer();
    });
  }

  /* ---------- Consultas ---------- */

  de(cursoId: string): ProgresoCurso {
    return this.porCurso()[cursoId] ?? PROGRESO_VACIO;
  }

  estaCompletado(cursoId: string, num: number): boolean {
    return this.de(cursoId).set.has(num);
  }

  estadoDe(cursoId: string): EstadoCurso {
    const p = this.de(cursoId);
    if (p.total > 0 && p.set.size >= p.total) return 'completado';
    if (p.set.size > 0 || p.ultimo !== null) return 'en-curso';
    return 'sin-empezar';
  }

  /**
   * Capítulo al que lleva el botón «Continuar»: el último visitado
   * si aún no está completado, y si no, el primero que quede
   * pendiente.
   */
  capituloParaContinuar(cursoId: string): number {
    const p = this.de(cursoId);
    if (p.ultimo !== null && !p.set.has(p.ultimo)) return p.ultimo;

    const ficha = this.catalogo.ficha(cursoId);
    const pendiente = ficha?.capitulos.find((c) => !p.set.has(c.num));
    return pendiente?.num ?? ficha?.capitulos.at(-1)?.num ?? 0;
  }

  /** Curso que el panel propone retomar: el más avanzado sin terminar. */
  cursoParaContinuar(): FichaCurso | null {
    const fichas = this.catalogo.fichas();
    const sinTerminar = fichas.filter((f) => this.estadoDe(f.id) !== 'completado');
    const empezados = sinTerminar.filter((f) => this.de(f.id).tocado);
    const candidatos = empezados.length ? empezados : sinTerminar;

    return (
      candidatos
        .slice()
        .sort((a, b) => this.de(b.id).set.size - this.de(a.id).set.size)[0] ?? fichas[0] ?? null
    );
  }

  /* ---------- Modificaciones ---------- */

  alternarCapitulo(cursoId: string, num: number): void {
    this.modificar(cursoId, (registro) => {
      const hechos = new Set(this.numerosDe(registro));
      if (hechos.has(num)) hechos.delete(num);
      else hechos.add(num);
      this.escribirHechos(registro, hechos);
    });
  }

  /**
   * Índices de los acordeones que el alumno ya desplegó alguna vez
   * en un capítulo. Es lo que alimenta la marca «✓ leído» y la barra
   * de progreso del capítulo (secciones leídas de 8).
   */
  acordeonesLeidos(cursoId: string, capitulo: number): ReadonlySet<number> {
    this.revision();
    const ficha = this.catalogo.ficha(cursoId);
    if (!ficha) return new Set<number>();

    const registro = this.almacen.leerJson<RegistroAlmacen>(ficha.claveAlmacen);
    const lista = registro?.opened?.['cap-' + capitulo] ?? [];
    return new Set(lista.map(Number).filter((n) => Number.isInteger(n)));
  }

  /** Anota que un acordeón se abrió. Nunca se desanota: leído es leído. */
  marcarAcordeonLeido(cursoId: string, capitulo: number, indice: number): void {
    if (this.acordeonesLeidos(cursoId, capitulo).has(indice)) return;

    this.modificar(cursoId, (registro) => {
      const abiertos = registro.opened ?? {};
      const clave = 'cap-' + capitulo;
      const lista = abiertos[clave] ?? [];
      if (!lista.includes(String(indice))) lista.push(String(indice));
      abiertos[clave] = lista;
      registro.opened = abiertos;
    });
  }

  marcarVisitado(cursoId: string, num: number): void {
    const actual = this.de(cursoId);
    if (actual.ultimo === num) return;
    this.modificar(cursoId, (registro) => {
      registro['last'] = 'cap-' + num;
      delete registro['ultimo'];
    });
  }

  reiniciarCurso(cursoId: string): void {
    const ficha = this.catalogo.ficha(cursoId);
    if (!ficha) return;
    this.almacen.borrar(ficha.claveAlmacen);
    this.revision.update((n) => n + 1);
  }

  reiniciarTodo(): void {
    for (const ficha of this.catalogo.fichas()) {
      this.almacen.borrar(ficha.claveAlmacen);
    }
    this.revision.update((n) => n + 1);
  }

  /** Relee el almacenamiento sin cambiar nada. */
  releer(): void {
    this.revision.update((n) => n + 1);
  }

  /* ---------- Copia de seguridad ---------- */

  /** Vuelca el progreso en el mismo formato que el panel legacy. */
  exportar(): string {
    const copia: Copia = { panel: 'cursos-panel-v1', fecha: new Date().toISOString(), datos: {} };
    for (const ficha of this.catalogo.fichas()) {
      const bruto = this.almacen.leer(ficha.claveAlmacen);
      if (bruto) copia.datos[ficha.claveAlmacen] = bruto;
    }
    return JSON.stringify(copia);
  }

  /**
   * Restaura una copia. Sólo acepta claves de cursos conocidos, para
   * que un texto manipulado no pueda escribir cualquier cosa en el
   * almacenamiento del navegador.
   */
  importar(texto: string): { ok: boolean; mensaje: string; restaurados: number } {
    let copia: Partial<Copia>;
    try {
      copia = JSON.parse(texto) as Partial<Copia>;
    } catch {
      return {
        ok: false,
        restaurados: 0,
        mensaje: 'Ese texto no es una copia válida: debe ser el JSON completo que generó «Exportar progreso», sin recortar.',
      };
    }

    if (!copia || typeof copia.datos !== 'object' || copia.datos === null) {
      return { ok: false, restaurados: 0, mensaje: 'La copia no tiene el bloque «datos» que se espera.' };
    }

    const conocidas = new Set(this.catalogo.fichas().map((f) => f.claveAlmacen));
    let restaurados = 0;
    for (const [clave, valor] of Object.entries(copia.datos)) {
      if (!conocidas.has(clave) || typeof valor !== 'string') continue;
      if (this.almacen.escribir(clave, valor)) restaurados++;
    }

    this.revision.update((n) => n + 1);
    return {
      ok: restaurados > 0,
      restaurados,
      mensaje: restaurados
        ? `Se restauró el progreso de ${restaurados} curso(s).`
        : 'La copia no contenía ningún curso de los que hay en este catálogo.',
    };
  }

  /* ---------- Interno ---------- */

  /** Lee el registro de un curso y lo normaliza. */
  private leerDeAlmacen(ficha: FichaCurso): ProgresoCurso {
    const total = ficha.totalCapitulos;
    const registro = this.almacen.leerJson<RegistroAlmacen>(ficha.claveAlmacen);
    if (!registro) return { ...PROGRESO_VACIO, set: new Set<number>(), total };

    const validos = new Set(ficha.capitulos.map((c) => c.num));
    const set = new Set<number>();
    for (const n of this.numerosDe(registro)) {
      if (validos.has(n)) set.add(n);
    }

    const ultimoBruto = typeof registro.last === 'string' ? registro.last : registro.ultimo;
    const ultimo = this.numeroDe(ultimoBruto);

    return {
      hechos: [...set].sort((a, b) => a - b),
      set,
      ultimo: ultimo !== null && validos.has(ultimo) ? ultimo : null,
      total,
      pct: total ? Math.round((set.size / total) * 100) : 0,
      tocado: true,
    };
  }

  /** Números de capítulo completados, vengan del esquema que vengan. */
  private numerosDe(registro: RegistroAlmacen): number[] {
    const lista = Array.isArray(registro.completed)
      ? registro.completed
      : Array.isArray(registro.hechos)
        ? registro.hechos
        : [];
    return lista.map((id) => this.numeroDe(id)).filter((n): n is number => n !== null);
  }

  /** 'cap-12' → 12 */
  private numeroDe(id: string | undefined): number | null {
    const m = /(\d+)/.exec(id ?? '');
    return m ? Number(m[1]) : null;
  }

  private escribirHechos(registro: RegistroAlmacen, hechos: Set<number>): void {
    registro['completed'] = [...hechos].sort((a, b) => a - b).map((n) => 'cap-' + n);
    /* El esquema antiguo de angular.html se elimina al escribir para
       no dejar dos listas que puedan divergir. */
    delete registro['hechos'];
  }

  /**
   * Lee el registro crudo, deja que `cambio` lo modifique y lo
   * vuelve a escribir. Se fusiona sobre el registro existente para
   * no perder las claves que no son del progreso.
   */
  private modificar(cursoId: string, cambio: (registro: RegistroAlmacen) => void): void {
    const ficha = this.catalogo.ficha(cursoId);
    if (!ficha) return;

    const registro = this.almacen.leerJson<RegistroAlmacen>(ficha.claveAlmacen) ?? {};
    cambio(registro);
    this.almacen.escribirJson(ficha.claveAlmacen, registro);
    this.revision.update((n) => n + 1);
  }
}
