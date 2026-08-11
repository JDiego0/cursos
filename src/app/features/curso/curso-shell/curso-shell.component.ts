import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { RUTAS } from '@core/rutas';
import { CatalogoStore } from '@core/state/catalogo.store';
import { ProgresoStore } from '@core/state/progreso.store';
import { LayoutComponent } from '@layout/layout.component';
import { LayoutStore } from '@layout/layout.store';
import { CursoActualStore } from '../curso-actual.store';

/**
 * Contenedor de un curso: menú lateral con el temario y el hueco
 * donde el router pinta la portada, un capítulo, el estado del
 * proyecto o el glosario.
 *
 * Recibe `cursoId` como `input()` gracias a
 * `withComponentInputBinding()`: el parámetro de la ruta llega como
 * una entrada más del componente, sin suscribirse a `ActivatedRoute`.
 */
@Component({
  selector: 'app-curso-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, LayoutComponent],
  templateUrl: './curso-shell.component.html',
  styleUrl: './curso-shell.component.css',
})
export class CursoShellComponent {
  /** Viene de la ruta `curso/:cursoId`. */
  readonly cursoId = input.required<string>();

  protected readonly store = inject(CursoActualStore);
  protected readonly catalogo = inject(CatalogoStore);
  protected readonly progreso = inject(ProgresoStore);
  private readonly layout = inject(LayoutStore);
  private readonly router = inject(Router);

  protected readonly RUTAS = RUTAS;

  protected readonly ficha = computed(() => this.catalogo.ficha(this.cursoId()));
  protected readonly avance = computed(() => this.progreso.de(this.cursoId()));

  constructor() {
    effect(() => {
      const id = this.cursoId();
      this.store.cargar(id);
      /* Tiñe la interfaz con el color de la tecnología y cambia la
         marca de la barra superior. */
      this.layout.cursoActivo.set(this.catalogo.ficha(id) ?? null);
    });
  }

  protected continuar(): void {
    const id = this.cursoId();
    void this.router.navigate(RUTAS.capitulo(id, this.progreso.capituloParaContinuar(id)));
    this.layout.cerrarMenu();
  }

  protected reiniciar(): void {
    const ficha = this.ficha();
    if (!ficha) return;
    if (!confirm(`Esto borra tu progreso en «${ficha.nombre}». No se puede deshacer. ¿Seguro?`)) return;
    this.progreso.reiniciarCurso(ficha.id);
  }

  protected cerrarMenu(): void {
    this.layout.cerrarMenu();
  }
}
