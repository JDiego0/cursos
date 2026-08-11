import { Injectable, signal } from '@angular/core';

/**
 * Única puerta de entrada a `localStorage`.
 *
 * Existe por dos motivos:
 *
 * 1. El navegador puede tenerlo bloqueado (modo incógnito estricto,
 *    cookies de terceros desactivadas, iframes). Cualquier acceso
 *    directo lanzaría una excepción y tumbaría la vista; aquí se
 *    captura una sola vez y se marca `disponible` en falso.
 * 2. Aísla el resto de la aplicación del detalle de que el progreso
 *    se guarde en el navegador. Si mañana se guarda en un backend,
 *    este servicio es lo único que cambia.
 */
@Injectable({ providedIn: 'root' })
export class AlmacenamientoService {
  /** false si el navegador bloquea el almacenamiento. */
  readonly disponible = signal(true);

  leer(clave: string): string | null {
    try {
      return localStorage.getItem(clave);
    } catch {
      this.disponible.set(false);
      return null;
    }
  }

  leerJson<T>(clave: string): T | null {
    const bruto = this.leer(clave);
    if (!bruto) return null;
    try {
      return JSON.parse(bruto) as T;
    } catch {
      /* Un JSON corrupto no debe romper la aplicación: se ignora. */
      return null;
    }
  }

  escribir(clave: string, valor: string): boolean {
    try {
      localStorage.setItem(clave, valor);
      return true;
    } catch {
      this.disponible.set(false);
      return false;
    }
  }

  escribirJson(clave: string, valor: unknown): boolean {
    return this.escribir(clave, JSON.stringify(valor));
  }

  borrar(clave: string): void {
    try {
      localStorage.removeItem(clave);
    } catch {
      this.disponible.set(false);
    }
  }
}
