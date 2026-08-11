import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

/**
 * Copiar al portapapeles, con red de seguridad.
 *
 * `navigator.clipboard` sólo existe en contextos seguros (https o
 * localhost). Si la aplicación se sirve desde un http:// interno o
 * desde el sistema de archivos, se recurre a `execCommand('copy')`,
 * que está obsoleto pero sigue funcionando en todos los navegadores.
 */
@Injectable({ providedIn: 'root' })
export class PortapapelesService {
  private readonly documento = inject(DOCUMENT);

  async copiar(texto: string): Promise<boolean> {
    if (navigator.clipboard && isSecureContext) {
      try {
        await navigator.clipboard.writeText(texto);
        return true;
      } catch {
        /* Permiso denegado: se intenta por el camino antiguo. */
      }
    }
    return this.copiarConSeleccion(texto);
  }

  private copiarConSeleccion(texto: string): boolean {
    const area = this.documento.createElement('textarea');
    area.value = texto;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    this.documento.body.appendChild(area);
    area.select();

    let ok = false;
    try {
      ok = this.documento.execCommand('copy');
    } catch {
      ok = false;
    }
    this.documento.body.removeChild(area);
    return ok;
  }
}
