import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { EstadoCurso, FichaCurso, ProgresoCurso } from '@core/models';
import { RUTAS } from '@core/rutas';
import { HtmlSeguroPipe } from '@shared/pipes/html-seguro.pipe';
import { EstadoCursoPipe } from '@shared/pipes/nivel.pipe';

/**
 * Tarjeta de un curso en el panel.
 *
 * Componente de presentación puro: recibe la ficha, su progreso y a
 * qué capítulo lleva «Continuar», y no consulta ningún store. Así se
 * puede reutilizar (portada, resultados, futuras vistas) y se prueba
 * pasándole objetos, sin montar la aplicación entera.
 */
@Component({
  selector: 'app-tarjeta-curso',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, HtmlSeguroPipe, EstadoCursoPipe],
  templateUrl: './tarjeta-curso.component.html',
  styleUrl: './tarjeta-curso.component.css',
  host: {
    '[style.--cb]': '"var(--b-" + ficha().id + ")"',
    '[style.--cs]': '"var(--s-" + ficha().id + ")"',
    '[style.--ct]': '"var(--c-" + ficha().id + ")"',
  },
})
export class TarjetaCursoComponent {
  readonly ficha = input.required<FichaCurso>();
  readonly progreso = input.required<ProgresoCurso>();
  readonly estado = input.required<EstadoCurso>();
  readonly capituloContinuar = input.required<number>();

  protected readonly RUTAS = RUTAS;

  /** Título del capítulo que se retomaría, para enseñarlo en la tarjeta. */
  protected readonly siguiente = computed(() =>
    this.ficha().capitulos.find((c) => c.num === this.capituloContinuar()),
  );

  protected readonly textoBoton = computed(() =>
    this.estado() === 'sin-empezar' ? '▶ Empezar' : '▶ Continuar',
  );
}
