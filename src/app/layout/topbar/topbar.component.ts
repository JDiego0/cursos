import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { RUTAS } from '@core/rutas';
import { TemaService } from '@core/services/tema.service';
import { ProgresoStore } from '@core/state/progreso.store';
import { AnilloProgresoComponent } from '@shared/components/anillo-progreso/anillo-progreso.component';
import { BuscadorComponent } from '@shared/components/buscador/buscador.component';
import { LayoutStore } from '../layout.store';

/**
 * Barra superior, común a todas las vistas.
 *
 * Cambia de piel según dónde estés: en el panel muestra la marca
 * general y el progreso de todos los cursos; dentro de un curso
 * muestra su nombre, el botón de volver y su progreso, y el
 * buscador pasa a buscar sólo dentro de ese curso.
 */
@Component({
  selector: 'app-topbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, BuscadorComponent, AnilloProgresoComponent],
  templateUrl: './topbar.component.html',
  styleUrl: './topbar.component.css',
})
export class TopbarComponent {
  protected readonly layout = inject(LayoutStore);
  protected readonly tema = inject(TemaService);
  private readonly progreso = inject(ProgresoStore);

  protected readonly RUTAS = RUTAS;

  protected readonly curso = this.layout.cursoActivo;

  protected readonly pct = computed(() => {
    const curso = this.curso();
    return curso ? this.progreso.de(curso.id).pct : this.progreso.global().pct;
  });

  protected readonly etiquetaProgreso = computed(() => {
    const curso = this.curso();
    return curso ? 'Progreso de ' + curso.nombre : 'Progreso global de todos los cursos';
  });
}
