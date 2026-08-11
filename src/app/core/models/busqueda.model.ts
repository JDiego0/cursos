/* ============================================================
   MODELO DE DOMINIO · BUSCADOR
   ============================================================ */

/** De dónde salió el resultado, para saber a dónde navegar. */
export type TipoResultado = 'curso' | 'capitulo';

export interface ResultadoBusqueda {
  tipo: TipoResultado;
  cursoId: string;
  cursoNombre: string;
  /** Sólo en resultados de capítulo. */
  capitulo?: number;
  /** Título del resultado, ya con <mark> alrededor de lo buscado. */
  titulo: string;
  /** Contexto: módulo del capítulo o tecnología del curso. */
  contexto: string;
  /** Fragmento de texto donde apareció la búsqueda, con <mark>. */
  fragmento: string;
  /** Cuanto más alto, más arriba sale. */
  peso: number;
}

/** Una entrada del índice de búsqueda: texto plano, listo para buscar. */
export interface EntradaIndice {
  tipo: TipoResultado;
  cursoId: string;
  cursoNombre: string;
  capitulo?: number;
  titulo: string;
  contexto: string;
  /** Todo el texto buscable, en minúsculas y sin acentos. */
  texto: string;
  /** Texto original, para recortar el fragmento con su acentuación. */
  textoOriginal: string;
}
