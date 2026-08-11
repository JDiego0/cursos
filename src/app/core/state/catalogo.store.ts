import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { CursoRepository } from '@core/data/curso.repository';
import { FichaCurso, ResumenCapitulo } from '@core/models';

/**
 * Catálogo de cursos: la lista de fichas y las consultas que se
 * hacen sobre ella.
 *
 * Se carga una sola vez al arrancar la aplicación (ver
 * `provideAppInitializer` en app.config.ts), así que a partir de ahí
 * `fichas()` siempre tiene datos y ningún componente necesita
 * comprobar si el catálogo llegó. El contenido de cada curso, que sí
 * pesa, se pide aparte y sólo cuando se abre.
 */
@Injectable({ providedIn: 'root' })
export class CatalogoStore {
  private readonly repo = inject(CursoRepository);

  private readonly _fichas = signal<FichaCurso[]>([]);
  private readonly _error = signal<string | null>(null);

  readonly fichas = this._fichas.asReadonly();
  readonly error = this._error.asReadonly();

  /** Índice por id, para no recorrer el array en cada consulta. */
  private readonly porId = computed(() => new Map(this._fichas().map((f) => [f.id, f])));

  readonly totalCapitulos = computed(() =>
    this._fichas().reduce((n, f) => n + f.totalCapitulos, 0),
  );

  readonly totalHoras = computed(() => this._fichas().reduce((n, f) => n + f.horas, 0));

  /** Carga inicial. La llama el inicializador de la aplicación. */
  cargar(): Observable<FichaCurso[]> {
    return this.repo.catalogo().pipe(
      tap({
        next: (fichas) => this._fichas.set(fichas),
        error: () =>
          this._error.set(
            'No se pudo leer el catálogo de cursos. Comprueba que public/contenido/ está publicado ' +
              'junto a la aplicación y vuelve a cargar la página.',
          ),
      }),
    );
  }

  ficha(id: string): FichaCurso | undefined {
    return this.porId().get(id);
  }

  capitulo(cursoId: string, num: number): ResumenCapitulo | undefined {
    return this.ficha(cursoId)?.capitulos.find((c) => c.num === num);
  }

  /** Capítulos de un curso agrupados por módulo, en orden. */
  modulos(cursoId: string): { nombre: string; capitulos: ResumenCapitulo[] }[] {
    const ficha = this.ficha(cursoId);
    if (!ficha) return [];

    const grupos: { nombre: string; capitulos: ResumenCapitulo[] }[] = [];
    for (const cap of ficha.capitulos) {
      const ultimo = grupos[grupos.length - 1];
      if (ultimo && ultimo.nombre === cap.modulo) ultimo.capitulos.push(cap);
      else grupos.push({ nombre: cap.modulo, capitulos: [cap] });
    }
    return grupos;
  }
}
