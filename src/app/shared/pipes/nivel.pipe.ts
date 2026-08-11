import { Pipe, PipeTransform } from '@angular/core';
import { EstadoCurso } from '@core/models';

/**
 * Nivel del capítulo → clase del chip que lo colorea.
 * «Principiante» → lv1 (verde) · «Intermedio» → lv2 (ámbar) · resto → lv3 (rojo).
 */
@Pipe({ name: 'nivelClase' })
export class NivelClasePipe implements PipeTransform {
  transform(nivel: string | null | undefined): string {
    const n = (nivel ?? '').toLowerCase();
    if (n.startsWith('princip')) return 'lv1';
    if (n.startsWith('inter')) return 'lv2';
    return 'lv3';
  }
}

/** Estado de un curso → cómo se enseña: texto y clase del distintivo. */
@Pipe({ name: 'estadoCurso' })
export class EstadoCursoPipe implements PipeTransform {
  transform(estado: EstadoCurso): { texto: string; clase: string } {
    switch (estado) {
      case 'completado':
        return { texto: 'Completado', clase: 'ok' };
      case 'en-curso':
        return { texto: 'En curso', clase: 'doing' };
      default:
        return { texto: 'Sin empezar', clase: 'pend' };
    }
  }
}
