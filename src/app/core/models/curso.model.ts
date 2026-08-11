/* ============================================================
   MODELO DE DOMINIO · CURSOS

   Estas interfaces describen exactamente la forma de los JSON de
   public/contenido/, que genera herramientas/migrar-contenido.js.
   Son el contrato entre el acceso a datos y el resto de la
   aplicación: si algún día el contenido llega de una API, sólo
   cambia el repositorio, no estas interfaces.
   ============================================================ */

/** Colores de marca de un curso, definidos también como tokens CSS. */
export interface ColoresCurso {
  /** Color sólido: barras, puntos, filetes. */
  base: string;
  /** Variante suave para degradados. */
  suave: string;
  /** Versión legible como color de texto en el tema activo. */
  texto: string;
}

/**
 * Ficha de un curso en el catálogo: lo justo para pintar el panel
 * y el temario sin descargar el curso entero (que pesa ~1 MB).
 */
export interface FichaCurso {
  id: string;
  /** Clave de localStorage donde el curso guarda su progreso. */
  claveAlmacen: string;
  nombre: string;
  tecnologia: string;
  icono: string;
  proyecto: string;
  proyectoDesc: string;
  horas: number;
  nivel: string;
  /** Descripción en HTML (lleva <strong> y <code>). */
  descripcion: string;
  temas: string[];
  colores: ColoresCurso;
  totalCapitulos: number;
  modulos: string[];
  capitulos: ResumenCapitulo[];
}

/** Un capítulo visto desde el catálogo: metadatos, sin contenido. */
export interface ResumenCapitulo {
  num: number;
  corto: string;
  titulo: string;
  modulo: string;
  duracion: string;
  nivel: string;
  icono: string;
  conceptos: string[];
}

/** Uno de los ocho acordeones de un capítulo. */
export interface Acordeon {
  id: string;
  titulo: string;
  abiertoPorDefecto: boolean;
  /** Cuerpo del acordeón en HTML. Contenido propio, sin scripts. */
  html: string;
}

/** Un capítulo completo, con su contenido. */
export interface Capitulo extends ResumenCapitulo {
  /** Caja «🎯 Objetivo del capítulo», en HTML. */
  objetivo: string;
  acordeones: Acordeon[];
}

/** Una pieza del proyecto dentro de una capa de la arquitectura. */
export interface NodoArquitectura {
  /** Capítulo que construye esta pieza. */
  ch: number;
  /** Icono. */
  i: string;
  /** Nombre. */
  n: string;
}

export interface CapaArquitectura {
  layer: string;
  nodes: NodoArquitectura[];
}

/** Una fila de la tabla de artefactos del proyecto. */
export interface Artefacto {
  nombre: string;
  donde: string;
  capitulo: number;
}

export interface TerminoGlosario {
  termino: string;
  /** Definición en HTML (lleva <code> y <em>). */
  definicion: string;
}

export interface EntradaChuleta {
  clave: string;
  /** Para qué sirve, en HTML. */
  para: string;
}

/** Portada del curso. */
export interface Portada {
  kicker: string;
  /** Título en HTML: lleva <br> y <span>. */
  titulo: string;
  lead: string;
  stats: { valor: string; etiqueta: string }[];
  /** Resto de la portada en HTML, desde el primer <h2 class="sec">. */
  cuerpo: string;
}

/** Cabecera de la vista «estado del proyecto». */
export interface EstadoProyecto {
  crumb: string;
  titulo: string;
  lead: string;
  /** Etiqueta de la barra: «LibroTech completado». */
  etiquetaProgreso: string;
  /** Nota de convención de nombres, en HTML. */
  nota: string;
}

/** Un ejercicio del laboratorio de código (sólo en algoritmia). */
export interface Laboratorio {
  titulo: string;
  /** Firma esperada: «sumaHasta(n) → entero». */
  firma?: string;
  /** Nombre de la función a implementar, por lenguaje o común. */
  fn: string | { py: string; java: string; js: string };
  /** Casos de prueba: [argumentos, resultado esperado]. */
  cases?: [unknown[], unknown][];
  /** Código de partida en cada lenguaje. */
  py: string;
  java: string;
  js: string;
}

/** Un curso completo, tal y como llega del repositorio. */
export interface Curso {
  id: string;
  claveAlmacen: string;
  titulo: string;
  descripcion: string;
  nombre: string;
  icono: string;
  proyecto: string;
  portada: Portada;
  estado: EstadoProyecto;
  arquitectura: CapaArquitectura[];
  artefactos: Artefacto[];
  glosario: TerminoGlosario[];
  chuleta: EntradaChuleta[];
  laboratorios: Record<string, Laboratorio>;
  capitulos: Capitulo[];
}
