import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { RUTAS } from '@core/rutas';
import { ProgresoStore } from '@core/state/progreso.store';
import { HtmlSeguroPipe } from '@shared/pipes/html-seguro.pipe';
import { NivelClasePipe } from '@shared/pipes/nivel.pipe';
import { CursoActualStore } from '../curso-actual.store';

/**
 * Portada de un curso: presentación del proyecto y temario completo.
 *
 * Reúne lo que en el panel legacy eran dos pantallas distintas —la
 * portada del curso y su ficha con el temario—, porque desde que
 * todo vive en la misma aplicación no hay razón para separarlas.
 */
@Component({
  selector: 'app-portada',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, HtmlSeguroPipe, NivelClasePipe],
  templateUrl: './portada.component.html',
  styleUrl: './portada.component.css',
})
export class PortadaComponent {
  readonly cursoId = input.required<string>();

  protected readonly store = inject(CursoActualStore);
  protected readonly progreso = inject(ProgresoStore);

  protected readonly RUTAS = RUTAS;

  protected readonly curso = this.store.curso;
  protected readonly avance = computed(() => this.progreso.de(this.cursoId()));

  protected readonly primerCapitulo = computed(() => this.curso()?.capitulos[0]?.num ?? 0);
  protected readonly capituloContinuar = computed(() =>
    this.progreso.capituloParaContinuar(this.cursoId()),
  );
}
