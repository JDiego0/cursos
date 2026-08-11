import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { AlmacenamientoService } from '@core/services/almacenamiento.service';
import { CatalogoStore } from '@core/state/catalogo.store';
import { TopbarComponent } from '@layout/topbar/topbar.component';
import { VolverArribaComponent } from '@shared/components/volver-arriba/volver-arriba.component';

/**
 * Raíz de la aplicación.
 *
 * Sólo monta el "cromo" que no cambia nunca —barra superior, botón
 * de volver arriba, avisos de arranque— y deja el resto al router.
 * La estructura de dos columnas la pone cada vista con
 * `<app-layout>`, porque el menú lateral del panel y el de un curso
 * no tienen nada que ver.
 */
@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, TopbarComponent, VolverArribaComponent],
  template: `
    <a class="salto-contenido" href="#contenido">Saltar al contenido</a>

    <app-topbar />

    @if (catalogo.error(); as error) {
      <div class="aviso-global">
        <div class="note bad">
          <b class="t">No se pudo cargar el catálogo</b>
          <p>{{ error }}</p>
        </div>
      </div>
    } @else {
      @if (!almacen.disponible()) {
        <div class="aviso-global">
          <div class="note warn">
            <b class="t">Este navegador no deja guardar el progreso</b>
            <p>
              Puedes estudiar con normalidad, pero los capítulos que marques como completados no se
              recordarán al cerrar la pestaña. Suele pasar en ventanas de incógnito estrictas o con
              el almacenamiento de sitios bloqueado.
            </p>
          </div>
        </div>
      }
      <router-outlet />
    }

    <app-volver-arriba />
  `,
  styles: `
    .aviso-global {
      max-width: var(--contenido-max);
      margin: 0 auto;
      padding: calc(var(--topbar-h) + 26px) 24px 0;
    }
  `,
})
export class App {
  protected readonly catalogo = inject(CatalogoStore);
  protected readonly almacen = inject(AlmacenamientoService);
}
