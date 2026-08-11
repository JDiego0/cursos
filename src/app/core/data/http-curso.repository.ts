import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, shareReplay } from 'rxjs';

import { Curso, FichaCurso } from '@core/models';
import { CursoRepository } from './curso.repository';

/** Carpeta de los JSON de contenido, relativa al base href. */
const BASE = 'contenido/';

/**
 * Implementación del repositorio sobre los JSON estáticos que
 * genera `node herramientas/migrar-contenido.js`.
 *
 * Cachea con `shareReplay(1)`: el catálogo se pide una vez en toda
 * la sesión, y cada curso (que pesa alrededor de 1 MB) una sola vez
 * aunque se navegue entre sus capítulos.
 */
@Injectable()
export class HttpCursoRepository extends CursoRepository {
  private readonly http = inject(HttpClient);

  private catalogo$?: Observable<FichaCurso[]>;
  private readonly cursos = new Map<string, Observable<Curso>>();

  override catalogo(): Observable<FichaCurso[]> {
    this.catalogo$ ??= this.http
      .get<FichaCurso[]>(BASE + 'catalogo.json')
      .pipe(shareReplay({ bufferSize: 1, refCount: false }));
    return this.catalogo$;
  }

  override curso(id: string): Observable<Curso> {
    let peticion = this.cursos.get(id);
    if (!peticion) {
      peticion = this.http
        .get<Curso>(BASE + id + '.json')
        .pipe(shareReplay({ bufferSize: 1, refCount: false }));
      this.cursos.set(id, peticion);
    }
    return peticion;
  }
}
