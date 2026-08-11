import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { RUTAS } from '@core/rutas';
import { CatalogoStore } from '@core/state/catalogo.store';
import { ProgresoStore } from '@core/state/progreso.store';
import { TarjetaCursoComponent } from '../componentes/tarjeta-curso/tarjeta-curso.component';

/** Un tramo de la ruta recomendada de estudio. */
interface PasoRuta {
  cursoId: string;
  porque: string;
}

/**
 * Portada del panel: cuatro cifras, la rejilla de cursos y la ruta
 * recomendada.
 *
 * La ruta se dibuja a partir del catálogo, no a mano, para que no se
 * desincronice si mañana se añade o se quita un curso.
 */
@Component({
  selector: 'app-inicio',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TarjetaCursoComponent],
  templateUrl: './inicio.component.html',
  styles: `
    .cursos {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
      margin: 14px 0 10px;
    }

    @media (max-width: 1100px) {
      .cursos {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class InicioComponent {
  protected readonly catalogo = inject(CatalogoStore);
  protected readonly progreso = inject(ProgresoStore);

  protected readonly RUTAS = RUTAS;
  protected readonly global = this.progreso.global;

  protected readonly continuar = computed(() => {
    const curso = this.progreso.cursoParaContinuar();
    if (!curso) return null;
    return { curso, capitulo: this.progreso.capituloParaContinuar(curso.id) };
  });

  private readonly RUTA: PasoRuta[] = [
    { cursoId: 'java', porque: 'Enseña a programar y a pensar en objetos.' },
    { cursoId: 'react', porque: 'La interfaz: ya sabes lógica, ahora píntala.' },
    { cursoId: 'angular', porque: 'El mismo problema con otra filosofía.' },
    { cursoId: 'azure', porque: 'Dónde vive lo que has construido.' },
    { cursoId: 'ia', porque: 'Se apoya en todo lo anterior: API, datos y nube.' },
  ];

  /** Diagrama ASCII de la ruta, con el avance real de cada curso. */
  protected readonly diagramaRuta = computed(() => {
    const relleno = (texto: string, ancho: number) => (texto + ' '.repeat(ancho)).slice(0, ancho);

    const lineas: string[] = [
      '  RUTA RECOMENDADA                    │ AVANCE │ POR QUÉ EN ESTE ORDEN',
      '  ────────────────────────────────────┼────────┼──────────────────────────────────',
    ];

    const pasos = this.RUTA.filter((p) => this.catalogo.ficha(p.cursoId));
    pasos.forEach((paso, i) => {
      const ficha = this.catalogo.ficha(paso.cursoId)!;
      const pct = String(this.progreso.de(ficha.id).pct).padStart(3, ' ');
      lineas.push(
        '  ' + relleno(ficha.icono, 3) + ' ' + relleno(ficha.nombre, 26) + '│ ' + pct + ' %  │ ' + paso.porque,
      );
      if (i < pasos.length - 1) {
        lineas.push('           ↓                          │        │');
      }
    });

    lineas.push('', '  Ninguno es obligatorio antes que otro: Azure e IA se pueden hacer sueltos.');
    return lineas.join('\n');
  });
}
