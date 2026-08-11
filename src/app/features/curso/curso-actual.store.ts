import { Injectable, computed, inject, signal } from '@angular/core';

import { CursoRepository } from '@core/data/curso.repository';
import { Capitulo, Curso } from '@core/models';
import { BusquedaService } from '@core/services/busqueda.service';

type Estado = 'cargando' | 'listo' | 'error';

/**
 * El curso que se está viendo.
 *
 * **No es un servicio global**: se declara en `providers` de la ruta
 * `curso/:cursoId`, así que Angular crea una instancia al entrar en
 * un curso y la destruye al salir. Eso evita el problema clásico de
 * los servicios `root` que van acumulando estado de pantallas
 * anteriores, y hace que el ciclo de vida del dato coincida
 * exactamente con el de la vista que lo usa.
 */
@Injectable()
export class CursoActualStore {
  private readonly repo = inject(CursoRepository);
  private readonly busqueda = inject(BusquedaService);

  private readonly _curso = signal<Curso | null>(null);
  private readonly _estado = signal<Estado>('cargando');
  private idPedido: string | null = null;

  readonly curso = this._curso.asReadonly();
  readonly estado = this._estado.asReadonly();

  readonly cargando = computed(() => this._estado() === 'cargando');
  readonly error = computed(() => this._estado() === 'error');

  /** Capítulos agrupados por módulo, en el orden del temario. */
  readonly modulos = computed(() => {
    const capitulos = this._curso()?.capitulos ?? [];
    const grupos: { nombre: string; capitulos: Capitulo[] }[] = [];
    for (const cap of capitulos) {
      const ultimo = grupos.at(-1);
      if (ultimo && ultimo.nombre === cap.modulo) ultimo.capitulos.push(cap);
      else grupos.push({ nombre: cap.modulo, capitulos: [cap] });
    }
    return grupos;
  });

  /** Pide el curso. Repetir la llamada con el mismo id no hace nada. */
  cargar(cursoId: string): void {
    if (this.idPedido === cursoId) return;
    this.idPedido = cursoId;
    this._estado.set('cargando');

    this.repo.curso(cursoId).subscribe({
      next: (curso) => {
        this._curso.set(curso);
        this._estado.set('listo');
        /* Con el curso en memoria, el buscador puede mirar también
           dentro del texto de sus capítulos y no sólo en los títulos. */
        this.busqueda.indexarCurso(curso);
      },
      error: () => {
        this._curso.set(null);
        this._estado.set('error');
      },
    });
  }

  capitulo(num: number): Capitulo | undefined {
    return this._curso()?.capitulos.find((c) => c.num === num);
  }

  /** Capítulo anterior y siguiente, para la navegación del pie. */
  vecinos(num: number): { anterior: Capitulo | null; siguiente: Capitulo | null } {
    const capitulos = this._curso()?.capitulos ?? [];
    const i = capitulos.findIndex((c) => c.num === num);
    return {
      anterior: i > 0 ? capitulos[i - 1] : null,
      siguiente: i >= 0 && i < capitulos.length - 1 ? capitulos[i + 1] : null,
    };
  }
}
