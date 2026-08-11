import { DOCUMENT } from '@angular/common';
import { Injectable, effect, inject, signal } from '@angular/core';

import { FichaCurso } from '@core/models';

/**
 * Estado de la interfaz que comparten el shell y las vistas: si el
 * menú lateral está abierto y en qué curso estamos.
 *
 * Es estado de presentación, no de dominio, y por eso vive en
 * `layout/` y no en `core/state/`: nada de esto se guarda ni se
 * sincroniza con nadie.
 */
@Injectable({ providedIn: 'root' })
export class LayoutStore {
  private readonly documento = inject(DOCUMENT);

  /** Sólo importa por debajo de 900 px; encima el menú es fijo. */
  readonly menuAbierto = signal(false);

  /** Curso que se está viendo, o null si estamos en el panel. */
  readonly cursoActivo = signal<FichaCurso | null>(null);

  constructor() {
    /* El acento de toda la interfaz sale de este atributo (ver el
       bloque «Acento por curso» de styles.css). */
    effect(() => {
      const curso = this.cursoActivo();
      const raiz = this.documento.documentElement;
      if (curso) raiz.setAttribute('data-curso', curso.id);
      else raiz.removeAttribute('data-curso');
    });

    /* Con el menú desplegado en móvil, el fondo no debe desplazarse. */
    effect(() => {
      this.documento.body.style.overflow = this.menuAbierto() ? 'hidden' : '';
    });
  }

  alternarMenu(): void {
    this.menuAbierto.update((v) => !v);
  }

  cerrarMenu(): void {
    this.menuAbierto.set(false);
  }
}
