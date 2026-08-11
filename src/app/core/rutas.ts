/* ============================================================
   RUTAS DE LA APLICACIÓN

   Un solo sitio donde se arman los enlaces. Los componentes usan
   estas funciones en vez de escribir arrays de segmentos a mano,
   así que cambiar la forma de una URL es cambiar una línea.
   ============================================================ */

export const RUTAS = {
  panel: () => ['/'],
  progreso: () => ['/progreso'],
  curso: (cursoId: string) => ['/curso', cursoId],
  capitulo: (cursoId: string, num: number) => ['/curso', cursoId, 'capitulo', num],
  estadoProyecto: (cursoId: string) => ['/curso', cursoId, 'estado'],
  glosario: (cursoId: string) => ['/curso', cursoId, 'glosario'],
} as const;
