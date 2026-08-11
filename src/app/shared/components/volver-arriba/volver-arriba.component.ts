import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';

/** Botón flotante que aparece al bajar y devuelve al principio. */
@Component({
  selector: 'app-volver-arriba',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <button type="button" title="Volver arriba" aria-label="Volver arriba" (click)="subir()">↑</button>
    }
  `,
  styleUrl: './volver-arriba.component.css',
})
export class VolverArribaComponent {
  protected readonly visible = signal(false);

  constructor() {
    const alDesplazar = () => this.visible.set(scrollY > 500);
    addEventListener('scroll', alDesplazar, { passive: true });
    inject(DestroyRef).onDestroy(() => removeEventListener('scroll', alDesplazar));
  }

  protected subir(): void {
    scrollTo({ top: 0, behavior: 'smooth' });
  }
}
