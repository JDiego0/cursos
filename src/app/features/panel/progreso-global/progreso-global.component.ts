import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { RUTAS } from '@core/rutas';
import { PortapapelesService } from '@core/services/portapapeles.service';
import { CatalogoStore } from '@core/state/catalogo.store';
import { ProgresoStore } from '@core/state/progreso.store';
import { EstadoCursoPipe } from '@shared/pipes/nivel.pipe';

/** Mensaje del panel de copia de seguridad. */
interface Aviso {
  clase: 'good' | 'bad' | 'warn' | 'tip';
  titulo: string;
  texto: string;
}

/**
 * Progreso global: resumen por curso, mapa de capítulos y copia de
 * seguridad.
 *
 * La copia usa **formularios reactivos**: el `textarea` es un
 * `FormControl`, y exportar e importar son dos operaciones sobre su
 * valor. El formato del volcado es idéntico al del panel legacy, así
 * que una copia hecha antes de la migración se restaura aquí sin
 * tocarla.
 */
@Component({
  selector: 'app-progreso-global',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, EstadoCursoPipe],
  templateUrl: './progreso-global.component.html',
  styleUrl: './progreso-global.component.css',
})
export class ProgresoGlobalComponent {
  protected readonly catalogo = inject(CatalogoStore);
  protected readonly progreso = inject(ProgresoStore);
  private readonly portapapeles = inject(PortapapelesService);

  protected readonly RUTAS = RUTAS;
  protected readonly global = this.progreso.global;

  protected readonly copia = new FormControl('', { nonNullable: true });
  protected readonly cajaVisible = signal(false);
  protected readonly aviso = signal<Aviso | null>(null);

  protected async exportar(): Promise<void> {
    const volcado = this.progreso.exportar();
    this.copia.setValue(volcado);
    this.cajaVisible.set(true);

    const copiado = await this.portapapeles.copiar(volcado);
    const cursos = this.catalogo.fichas().filter((f) => this.progreso.de(f.id).tocado).length;

    this.aviso.set({
      clase: 'good',
      titulo: 'Progreso exportado',
      texto:
        (copiado ? 'Ya está copiado al portapapeles. ' : '') +
        `Pega el texto en un archivo .txt y guárdalo: contiene el progreso de ${cursos} curso(s).`,
    });
  }

  protected importar(): void {
    this.cajaVisible.set(true);
    const texto = this.copia.value.trim();

    if (!texto) {
      this.aviso.set({
        clase: 'tip',
        titulo: 'Pega aquí tu copia',
        texto: 'Pega en el cuadro de abajo el texto que exportaste y vuelve a pulsar «Importar progreso».',
      });
      return;
    }

    if (!confirm('Vas a sobrescribir el progreso de este navegador con el de la copia. ¿Continuar?')) {
      return;
    }

    const resultado = this.progreso.importar(texto);
    this.aviso.set({
      clase: resultado.ok ? 'good' : 'bad',
      titulo: resultado.ok ? 'Progreso importado' : 'No se pudo importar',
      texto: resultado.mensaje,
    });
  }

  protected reiniciar(): void {
    if (!confirm('Esto borra el progreso de TODOS los cursos en este navegador. No se puede deshacer. ¿Seguro?')) return;
    if (!confirm('Última confirmación: se perderán todos los capítulos marcados como completados.')) return;

    this.progreso.reiniciarTodo();
    this.aviso.set({
      clase: 'warn',
      titulo: 'Progreso borrado',
      texto:
        'Todos los cursos vuelven a estar a 0 %. Si tenías una copia exportada, puedes recuperarla con «Importar progreso».',
    });
  }
}
