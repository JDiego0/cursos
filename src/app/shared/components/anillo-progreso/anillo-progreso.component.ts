import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Anillo de progreso de la barra superior.
 *
 * Es un `conic-gradient` y no un SVG: una sola variable CSS con los
 * grados, sin nodos que actualizar. El texto va aparte para que un
 * lector de pantalla lea el porcentaje y no el gráfico.
 */
@Component({
  selector: 'app-anillo-progreso',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="anillo"
      role="img"
      [attr.aria-label]="etiqueta() + ': ' + pct() + ' por ciento'"
      [style.--grados.deg]="grados()"
    ></div>
    <span class="txt">{{ pct() }}%</span>
  `,
  styleUrl: './anillo-progreso.component.css',
})
export class AnilloProgresoComponent {
  readonly pct = input.required<number>();
  readonly etiqueta = input('Progreso');

  protected readonly grados = computed(() => Math.round((this.pct() / 100) * 360));
}
