import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

/**
 * Uno de los ocho acordeones de un capítulo.
 *
 * En los cursos legacy el progreso del capítulo se calculaba
 * contando `<details open>` con `querySelectorAll`. Aquí el estado
 * abierto/cerrado es un `model()`: el capítulo lo posee, el
 * acordeón lo refleja, y la barra de progreso se deriva de él sin
 * que nadie mire el DOM.
 */
@Component({
  selector: 'app-acordeon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <details class="acc" [open]="abierto()" (toggle)="alAlternar($event)">
      <summary>
        <span class="ttl">{{ titulo() }}</span>
        @if (leido()) {
          <span class="tick">✓ leído</span>
        }
      </summary>
      <div class="acc-body">
        <ng-content />
      </div>
    </details>
  `,
  styleUrl: './acordeon.component.css',
})
export class AcordeonComponent {
  readonly titulo = input.required<string>();
  /** Abierto o cerrado. Es bidireccional: el padre manda y escucha. */
  readonly abierto = model(false);
  /** Marca «✓ leído» cuando el alumno ya lo desplegó alguna vez. */
  readonly leido = input(false);

  alAlternar(evento: Event): void {
    this.abierto.set((evento.target as HTMLDetailsElement).open);
  }
}
