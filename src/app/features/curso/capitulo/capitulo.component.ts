import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ViewContainerRef,
  computed,
  effect,
  inject,
  input,
  numberAttribute,
  signal,
  untracked,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { RUTAS } from '@core/rutas';
import { ProgresoStore } from '@core/state/progreso.store';
import { AcordeonComponent } from '@shared/components/acordeon/acordeon.component';
import { ContenidoDirective } from '@shared/directives/contenido.directive';
import { HtmlSeguroPipe } from '@shared/pipes/html-seguro.pipe';
import { NivelClasePipe } from '@shared/pipes/nivel.pipe';
import { CursoActualStore } from '../curso-actual.store';

/**
 * Un capítulo del curso.
 *
 * En los archivos originales, la cabecera, los chips, la barra de
 * progreso y la navegación se inyectaban en el DOM al arrancar
 * (`buildChapterChrome`). Aquí son plantilla: se declaran una vez y
 * valen para los 158 capítulos de los siete cursos.
 *
 * Lo único que sigue siendo HTML crudo es el cuerpo de cada
 * acordeón, que se pinta con `appContenido` (ver la directiva).
 */
@Component({
  selector: 'app-capitulo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, AcordeonComponent, ContenidoDirective, HtmlSeguroPipe, NivelClasePipe],
  templateUrl: './capitulo.component.html',
  styleUrl: './capitulo.component.css',
})
export class CapituloComponent {
  readonly cursoId = input.required<string>();
  /** `numberAttribute` convierte el segmento de la URL, que es texto. */
  readonly num = input.required({ transform: numberAttribute });

  private readonly store = inject(CursoActualStore);
  private readonly progreso = inject(ProgresoStore);
  private readonly router = inject(Router);
  private readonly vcr = inject(ViewContainerRef);

  protected readonly RUTAS = RUTAS;

  protected readonly capitulo = computed(() => this.store.capitulo(this.num()));
  protected readonly vecinos = computed(() => this.store.vecinos(this.num()));
  protected readonly completado = computed(() => this.progreso.estaCompletado(this.cursoId(), this.num()));

  protected readonly leidos = computed(() => this.progreso.acordeonesLeidos(this.cursoId(), this.num()));

  protected readonly progresoCapitulo = computed(() => {
    const total = this.capitulo()?.acordeones.length ?? 0;
    const leidos = this.leidos().size;
    return { leidos, total, pct: total ? Math.round((leidos / total) * 100) : 0 };
  });

  /** Estado abierto/cerrado de cada acordeón, por índice. */
  protected readonly abiertos = signal<Record<number, boolean>>({});

  constructor() {
    /* Al cambiar de capítulo: se anota la visita y se reinicia el
       estado de los acordeones al que trae el contenido.

       Todo lo que toca `ProgresoStore` va dentro de `untracked`: sus
       lecturas dependen de `revision`, que se incrementa al volver a
       la pestaña (`visibilitychange`) o al escribir otra pestaña. Sin
       aislarlas, el efecto se reejecutaba en cada regreso y cerraba
       los acordeones que el alumno tenía abiertos. La única
       dependencia legítima aquí es el capítulo. */
    effect(() => {
      const cap = this.capitulo();
      if (!cap) return;

      untracked(() => {
        this.progreso.marcarVisitado(this.cursoId(), cap.num);

        const inicial: Record<number, boolean> = {};
        cap.acordeones.forEach((acc, i) => (inicial[i] = acc.abiertoPorDefecto));
        this.abiertos.set(inicial);

        /* El primero viene abierto, así que cuenta como leído. */
        cap.acordeones.forEach((acc, i) => {
          if (acc.abiertoPorDefecto) this.progreso.marcarAcordeonLeido(this.cursoId(), cap.num, i);
        });
      });
    });

    /* `←` y `→` saltan de capítulo, como en los cursos originales. */
    const alPulsar = (e: KeyboardEvent) => {
      const destino = e.target as HTMLElement | null;
      const escribiendo =
        destino instanceof HTMLInputElement ||
        destino instanceof HTMLTextAreaElement ||
        destino?.isContentEditable === true;
      if (escribiendo || e.altKey || e.ctrlKey || e.metaKey) return;

      if (e.key === 'ArrowLeft') this.irA(this.vecinos().anterior?.num);
      if (e.key === 'ArrowRight') this.irA(this.vecinos().siguiente?.num);
    };
    addEventListener('keydown', alPulsar);
    inject(DestroyRef).onDestroy(() => removeEventListener('keydown', alPulsar));
  }

  protected alAbrir(indice: number, abierto: boolean): void {
    this.abiertos.update((estado) => ({ ...estado, [indice]: abierto }));
    if (abierto) this.progreso.marcarAcordeonLeido(this.cursoId(), this.num(), indice);
  }

  /**
   * Marca o desmarca el capítulo. Al marcarlo, salta al siguiente
   * tras un instante: es el gesto que tenían los cursos y el que
   * mantiene el ritmo de estudio.
   */
  protected alternarCompletado(): void {
    const eraCompletado = this.completado();
    this.progreso.alternarCapitulo(this.cursoId(), this.num());

    if (!eraCompletado) {
      const siguiente = this.vecinos().siguiente;
      if (siguiente) setTimeout(() => this.irA(siguiente.num), 250);
    }
  }

  /**
   * Monta los editores del laboratorio en los huecos
   * `<div class="lab" data-lab="…">` del contenido.
   *
   * El componente y el intérprete se cargan con `import()` dinámico
   * y sólo cuando un capítulo trae laboratorios: los seis cursos que
   * no los usan nunca descargan ese código.
   */
  protected async montarLaboratorios(anfitrion: HTMLElement): Promise<void> {
    const huecos = Array.from(anfitrion.querySelectorAll<HTMLElement>('.lab[data-lab]'));
    if (!huecos.length) return;

    const laboratorios = this.store.curso()?.laboratorios ?? {};
    const { LaboratorioComponent } = await import(
      '@features/laboratorio/laboratorio.component'
    );

    for (const hueco of huecos) {
      const id = hueco.dataset['lab'];
      const ejercicio = id ? laboratorios[id] : undefined;
      if (!id || !ejercicio || hueco.dataset['montado']) continue;
      hueco.dataset['montado'] = '1';

      const ref = this.vcr.createComponent(LaboratorioComponent);
      ref.setInput('id', id);
      ref.setInput('ejercicio', ejercicio);
      ref.setInput('cursoId', this.cursoId());
      hueco.appendChild(ref.location.nativeElement as Node);
      ref.changeDetectorRef.detectChanges();
    }
  }

  private irA(num: number | undefined): void {
    if (num === undefined) return;
    void this.router.navigate(RUTAS.capitulo(this.cursoId(), num));
  }
}
