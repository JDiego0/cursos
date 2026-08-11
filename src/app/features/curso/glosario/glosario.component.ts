import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { HtmlSeguroPipe } from '@shared/pipes/html-seguro.pipe';
import { CursoActualStore } from '../curso-actual.store';

/** Filtra sin acentos ni mayúsculas. */
const plegar = (t: string) =>
  t
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();

/**
 * Anexo del curso: glosario de términos y chuleta de comandos.
 *
 * El filtro es un `FormControl` convertido a signal con `toSignal`,
 * así que la lista visible es una expresión derivada del texto
 * escrito. En el curso legacy había que volver a pintar la lista a
 * mano en cada pulsación.
 */
@Component({
  selector: 'app-glosario',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, HtmlSeguroPipe],
  templateUrl: './glosario.component.html',
  styleUrl: './glosario.component.css',
})
export class GlosarioComponent {
  private readonly store = inject(CursoActualStore);

  protected readonly curso = this.store.curso;
  protected readonly filtro = new FormControl('', { nonNullable: true });

  private readonly texto = toSignal(this.filtro.valueChanges, { initialValue: '' });

  protected readonly terminos = computed(() => {
    const q = plegar(this.texto().trim());
    const lista = this.curso()?.glosario ?? [];
    if (!q) return lista;
    return lista.filter((t) => plegar(t.termino + ' ' + t.definicion).includes(q));
  });

  protected readonly comandos = computed(() => {
    const q = plegar(this.texto().trim());
    const lista = this.curso()?.chuleta ?? [];
    if (!q) return lista;
    return lista.filter((c) => plegar(c.clave + ' ' + c.para).includes(q));
  });
}
