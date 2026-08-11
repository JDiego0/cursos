import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { RUTAS } from '@core/rutas';
import { ProgresoStore } from '@core/state/progreso.store';
import { HtmlSeguroPipe } from '@shared/pipes/html-seguro.pipe';
import { CursoActualStore } from '../curso-actual.store';

/**
 * Panel permanente del proyecto: la arquitectura por capas y la
 * tabla de artefactos.
 *
 * Cada pieza se «enciende» cuando su capítulo está completado. Antes
 * eso lo hacía un `pintarArch()` que reescribía el HTML entero cada
 * vez; aquí es una expresión derivada del progreso, y el marcado se
 * actualiza solo.
 */
@Component({
  selector: 'app-estado-proyecto',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, HtmlSeguroPipe],
  templateUrl: './estado-proyecto.component.html',
  styleUrl: './estado-proyecto.component.css',
})
export class EstadoProyectoComponent {
  readonly cursoId = input.required<string>();

  protected readonly store = inject(CursoActualStore);
  private readonly progreso = inject(ProgresoStore);

  protected readonly RUTAS = RUTAS;
  protected readonly curso = this.store.curso;
  protected readonly avance = computed(() => this.progreso.de(this.cursoId()));

  /** ¿Está construida la pieza que aporta el capítulo `num`? */
  protected construido(num: number): boolean {
    return this.avance().set.has(num);
  }

  /** Piezas construidas sobre el total, para la barra del proyecto. */
  protected readonly piezas = computed(() => {
    const capas = this.curso()?.arquitectura ?? [];
    const nodos = capas.flatMap((c) => c.nodes);
    const hechos = nodos.filter((n) => this.avance().set.has(n.ch)).length;
    return { hechos, total: nodos.length };
  });
}
