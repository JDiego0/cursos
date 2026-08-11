import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { RUTAS } from '@core/rutas';
import { CatalogoStore } from '@core/state/catalogo.store';
import { ProgresoStore } from '@core/state/progreso.store';
import { LayoutComponent } from '@layout/layout.component';
import { LayoutStore } from '@layout/layout.store';

/**
 * Contenedor del panel: pone el menú lateral con la lista de cursos
 * y deja el hueco donde el router pinta la portada, el progreso
 * global o el temario de un curso.
 *
 * Es el único sitio del panel que habla con los stores: las vistas
 * hijas reciben lo que necesitan y se limitan a presentarlo.
 */
@Component({
  selector: 'app-panel-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, LayoutComponent],
  templateUrl: './panel-shell.component.html',
  styleUrl: './panel-shell.component.css',
})
export class PanelShellComponent {
  protected readonly catalogo = inject(CatalogoStore);
  protected readonly progreso = inject(ProgresoStore);
  private readonly layout = inject(LayoutStore);

  protected readonly RUTAS = RUTAS;

  protected readonly global = this.progreso.global;

  /** Curso que se propone retomar y capítulo exacto por el que ibas. */
  protected readonly continuar = computed(() => {
    const curso = this.progreso.cursoParaContinuar();
    if (!curso) return null;
    return { curso, capitulo: this.progreso.capituloParaContinuar(curso.id) };
  });

  constructor() {
    /* Al entrar en el panel se suelta el acento del curso anterior. */
    this.layout.cursoActivo.set(null);
  }

  protected cerrarMenu(): void {
    this.layout.cerrarMenu();
  }
}
