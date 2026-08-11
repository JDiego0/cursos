import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { RUTAS } from '@core/rutas';
import { CatalogoStore } from '@core/state/catalogo.store';
import { LayoutStore } from '@layout/layout.store';

/** Dirección que no existe: se ofrece la lista de cursos. */
@Component({
  selector: 'app-no-encontrado',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <div class="caja">
      <h1 class="page-title">Esta dirección no lleva a ninguna parte</h1>
      <p class="lead">
        Puede que sea un enlace antiguo, de cuando cada curso era un archivo HTML suelto. Estos son
        los cursos disponibles ahora mismo:
      </p>

      <ul class="clean">
        @for (ficha of catalogo.fichas(); track ficha.id) {
          <li>
            <a [routerLink]="RUTAS.curso(ficha.id)">
              {{ ficha.icono }} {{ ficha.nombre }}
            </a>
            · {{ ficha.totalCapitulos }} capítulos · proyecto {{ ficha.proyecto }}
          </li>
        }
      </ul>

      <p><a class="btn primary" [routerLink]="RUTAS.panel()">◀ Ir al panel de cursos</a></p>
    </div>
  `,
  styles: `
    .caja {
      max-width: var(--contenido-max);
      margin: 0 auto;
      padding: calc(var(--topbar-h) + 40px) 24px 60px;
    }
  `,
})
export class NoEncontradoComponent {
  protected readonly catalogo = inject(CatalogoStore);
  protected readonly RUTAS = RUTAS;

  constructor() {
    /* Sin curso activo: la barra superior vuelve a su forma de panel. */
    inject(LayoutStore).cursoActivo.set(null);
  }
}
