import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { debounceTime, distinctUntilChanged, map } from 'rxjs';

import { ResultadoBusqueda } from '@core/models';
import { RUTAS } from '@core/rutas';
import { BusquedaService } from '@core/services/busqueda.service';
import { HtmlLimpioPipe } from '@shared/pipes/html-seguro.pipe';

/**
 * Buscador incremental.
 *
 * El campo es un `FormControl` de formularios reactivos: su flujo de
 * valores pasa por `debounceTime` para no buscar en cada tecla y por
 * `distinctUntilChanged` para no repetir la misma consulta. El
 * resultado se convierte en signal con `toSignal`, de modo que la
 * plantilla se pinta sola.
 *
 * Atajos: `/` enfoca, `Esc` limpia, `↑` `↓` recorren y `Enter` abre.
 */
@Component({
  selector: 'app-buscador',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, HtmlLimpioPipe],
  templateUrl: './buscador.component.html',
  styleUrl: './buscador.component.css',
})
export class BuscadorComponent {
  /** Si se indica, sólo busca dentro de ese curso. */
  readonly cursoId = input<string | undefined>(undefined);
  readonly marcador = input('Buscar curso, capítulo o concepto…');

  private readonly busqueda = inject(BusquedaService);
  private readonly router = inject(Router);

  private readonly campo = viewChild.required<ElementRef<HTMLInputElement>>('campo');

  readonly control = new FormControl('', { nonNullable: true });

  /** Consulta ya estabilizada; la plantilla no la usa directamente. */
  private readonly consulta = toSignal(
    this.control.valueChanges.pipe(
      debounceTime(140),
      map((v) => v.trim()),
      distinctUntilChanged(),
      takeUntilDestroyed(),
    ),
    { initialValue: '' },
  );

  readonly resultados = computed<ResultadoBusqueda[]>(() =>
    this.busqueda.buscar(this.consulta(), this.cursoId()),
  );

  readonly hayConsulta = computed(() => this.consulta().length >= 2);
  readonly seleccion = signal(0);

  constructor() {
    /* Al cambiar la lista, la selección vuelve al primero. */
    effect(() => {
      this.resultados();
      this.seleccion.set(0);
    });

    /* El atajo `/` funciona desde cualquier punto de la página,
       salvo cuando ya se está escribiendo en otro campo. */
    const alPulsar = (e: KeyboardEvent) => {
      const destino = e.target as HTMLElement | null;
      const escribiendo =
        destino instanceof HTMLInputElement ||
        destino instanceof HTMLTextAreaElement ||
        destino?.isContentEditable === true;
      if (e.key === '/' && !escribiendo) {
        e.preventDefault();
        this.campo().nativeElement.focus();
      }
    };
    addEventListener('keydown', alPulsar);
    inject(DestroyRef).onDestroy(() => removeEventListener('keydown', alPulsar));
  }

  alTeclear(e: KeyboardEvent): void {
    const total = this.resultados().length;

    switch (e.key) {
      case 'Escape':
        this.limpiar();
        break;
      case 'ArrowDown':
        if (!total) return;
        e.preventDefault();
        this.seleccion.update((i) => (i + 1) % total);
        break;
      case 'ArrowUp':
        if (!total) return;
        e.preventDefault();
        this.seleccion.update((i) => (i - 1 + total) % total);
        break;
      case 'Enter': {
        const elegido = this.resultados()[this.seleccion()];
        if (elegido) {
          e.preventDefault();
          this.abrir(elegido);
        }
        break;
      }
    }
  }

  abrir(resultado: ResultadoBusqueda): void {
    const destino =
      resultado.tipo === 'curso'
        ? RUTAS.curso(resultado.cursoId)
        : RUTAS.capitulo(resultado.cursoId, resultado.capitulo ?? 0);
    void this.router.navigate(destino);
    this.limpiar();
  }

  limpiar(): void {
    this.control.setValue('');
    this.campo().nativeElement.blur();
  }
}
