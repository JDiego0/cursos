/* ============================================================
   MODELO DE DOMINIO · PROGRESO
   ============================================================ */

/** Estado de un curso: qué llevas hecho y por dónde ibas. */
export interface ProgresoCurso {
  /** Números de capítulo completados, ordenados. */
  hechos: number[];
  /** Los mismos, en Set, para preguntar en O(1). */
  set: ReadonlySet<number>;
  /** Último capítulo visitado; null si nunca se abrió el curso. */
  ultimo: number | null;
  /** Total de capítulos del curso. */
  total: number;
  /** Porcentaje completado, 0–100 redondeado. */
  pct: number;
  /** false si el curso no tiene ningún dato guardado todavía. */
  tocado: boolean;
}

export type EstadoCurso = 'sin-empezar' | 'en-curso' | 'completado';

/** Progreso agregado de todos los cursos. */
export interface ProgresoGlobal {
  capitulosHechos: number;
  capitulosTotales: number;
  pct: number;
  cursosCompletados: number;
  cursosEnCurso: number;
}

/**
 * Forma cruda del registro de localStorage.
 *
 * Los cursos legacy usaban dos esquemas distintos para lo mismo:
 *   { completed:['cap-0'], last:'cap-3' }   · azure, java, ia, react, python, algoritmia
 *   { hechos:['cap-0'],    ultimo:'cap-3' } · angular
 *
 * Se leen los dos y se escribe siempre el primero. El resto de
 * claves (code, lang, remoto, theme) se conservan intactas: son
 * del laboratorio y de las preferencias, y no nos tocan.
 */
export interface RegistroAlmacen {
  completed?: string[];
  last?: string;
  opened?: Record<string, string[]>;
  hechos?: string[];
  ultimo?: string;
  [otras: string]: unknown;
}
