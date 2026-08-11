import { Injectable, effect, inject, signal } from '@angular/core';
import { AlmacenamientoService } from './almacenamiento.service';

export type Tema = 'dark' | 'light';

const CLAVE = 'cursos-panel-v1';

/**
 * Tema claro / oscuro.
 *
 * El tema es un `signal` y un `effect` lo refleja en el atributo
 * `data-theme` del <html>, que es de donde cuelgan todos los tokens
 * de color de styles.css. Nadie más toca el DOM para cambiar colores.
 *
 * Se guarda bajo la misma clave que usaba el panel legacy para que
 * quien ya tenía elegido el tema claro lo conserve tras la migración.
 */
@Injectable({ providedIn: 'root' })
export class TemaService {
  private readonly almacen = inject(AlmacenamientoService);

  readonly tema = signal<Tema>(this.temaInicial());

  constructor() {
    effect(() => {
      const tema = this.tema();
      document.documentElement.setAttribute('data-theme', tema);
      const guardado = this.almacen.leerJson<Record<string, unknown>>(CLAVE) ?? {};
      this.almacen.escribirJson(CLAVE, { ...guardado, theme: tema });
    });
  }

  alternar(): void {
    this.tema.update((t) => (t === 'dark' ? 'light' : 'dark'));
  }

  /** Preferencia guardada; si no hay, la del sistema operativo. */
  private temaInicial(): Tema {
    const guardado = this.almacen.leerJson<{ theme?: string }>(CLAVE);
    if (guardado?.theme === 'light' || guardado?.theme === 'dark') {
      return guardado.theme;
    }
    return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
}
