import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { LayoutStore } from './layout.store';

/**
 * Estructura de dos columnas: menú lateral fijo y contenido.
 *
 * La usan el panel y el visor de cursos con contenido distinto en
 * cada hueco, así que la maquetación (anchos, comportamiento en
 * móvil, telón de fondo) se escribe una sola vez:
 *
 * ```html
 * <app-layout>
 *   <ng-container lateral> …menú… </ng-container>
 *   …contenido…
 * </app-layout>
 * ```
 */
@Component({
  selector: 'app-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aside class="sidebar" [class.abierto]="layout.menuAbierto()" aria-label="Navegación">
      <ng-content select="[lateral]" />
    </aside>

    <div class="telon" [class.visible]="layout.menuAbierto()" (click)="layout.cerrarMenu()"></div>

    <main class="main" id="contenido" tabindex="-1">
      <ng-content />
    </main>
  `,
  styleUrl: './layout.component.css',
})
export class LayoutComponent {
  protected readonly layout = inject(LayoutStore);
}
