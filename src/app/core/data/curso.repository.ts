import { Observable } from 'rxjs';
import { Curso, FichaCurso } from '@core/models';

/**
 * Contrato de acceso a datos de los cursos.
 *
 * Es una clase abstracta y no una interfaz a propósito: en Angular
 * una clase abstracta sirve a la vez de tipo y de token de
 * inyección, así que los componentes piden `CursoRepository` sin
 * saber de dónde salen los datos.
 *
 * Hoy la implementación lee JSON estáticos (HttpCursoRepository).
 * El día que el contenido venga de una API sólo cambia el
 * `useClass` de app.config.ts: nada más de la aplicación se entera.
 */
export abstract class CursoRepository {
  /** Fichas de todos los cursos, con su temario pero sin contenido. */
  abstract catalogo(): Observable<FichaCurso[]>;

  /** Un curso completo, con el contenido de todos sus capítulos. */
  abstract curso(id: string): Observable<Curso>;
}
