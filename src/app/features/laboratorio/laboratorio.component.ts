import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';

import { Laboratorio } from '@core/models';
import { AlgoLab, CasoProbado, LenguajeLab } from './interprete/algo-lab';
import { LENGUAJES, LaboratorioService } from './laboratorio.service';

/** Lo que se enseña en el panel de resultados. */
interface Salida {
  clase: '' | 'empty' | 'err' | 'good';
  texto: string;
  /** Marcador «3 de 5 casos correctos», si se pulsó ✅ Probar. */
  marcador?: { ok: boolean; texto: string };
  casos?: CasoProbado[];
}

const MENSAJE_INICIAL: Salida = {
  clase: 'empty',
  texto:
    'Escribe tu solución y pulsa ▶ Ejecutar. El botón ✅ Probar la pasa por los casos del ejercicio.',
};

/**
 * Laboratorio de código: editor, ejecución y casos de prueba.
 *
 * Sólo lo usa el curso de algoritmia, y por eso vive en su propio
 * feature y se carga con `import()` dinámico desde el capítulo: los
 * otros seis cursos nunca descargan ni el componente ni el
 * intérprete de 4.000 líneas que hay detrás.
 *
 * El componente no interpreta nada: delega en `AlgoLab` (intérprete
 * local, instantáneo y sin conexión) o, si el alumno enciende ⚡, en
 * Judge0. Aquí sólo está la interfaz y la decisión entre uno y otro.
 */
@Component({
  selector: 'app-laboratorio',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './laboratorio.component.html',
  styleUrl: './laboratorio.component.css',
})
export class LaboratorioComponent {
  readonly id = input.required<string>();
  readonly ejercicio = input.required<Laboratorio>();
  readonly cursoId = input.required<string>();

  protected readonly labs = inject(LaboratorioService);
  protected readonly LENGUAJES = LENGUAJES;

  private readonly editor = viewChild.required<ElementRef<HTMLTextAreaElement>>('editor');

  protected readonly codigo = signal('');
  protected readonly salida = signal<Salida>(MENSAJE_INICIAL);
  protected readonly cronometro = signal('');
  protected readonly ocupado = signal(false);

  protected readonly numerosDeLinea = computed(() =>
    Array.from({ length: this.codigo().split('\n').length }, (_, i) => i + 1).join('\n'),
  );

  protected readonly nombreFuncion = computed(() => {
    const fn = this.ejercicio().fn;
    if (typeof fn === 'string') return fn;
    const lang = this.labs.lenguaje();
    return lang === 'python' ? fn.py : lang === 'java' ? fn.java : fn.js;
  });

  constructor() {
    /* Al montar, y cada vez que cambia el lenguaje, se recupera lo
       que el alumno tuviera escrito; si no hay nada, el código de
       partida del ejercicio. */
    effect(() => {
      const lang = this.labs.lenguaje();
      const cursoId = this.cursoId();
      this.labs.cargarPreferencias(cursoId);
      this.codigo.set(this.labs.codigoGuardado(cursoId, this.id(), lang) ?? this.codigoDePartida(lang));
    });
  }

  /* ---------- Editor ---------- */

  protected alEscribir(evento: Event): void {
    const texto = (evento.target as HTMLTextAreaElement).value;
    this.codigo.set(texto);
    this.labs.guardarCodigo(this.cursoId(), this.id(), this.labs.lenguaje(), texto);
  }

  /**
   * Tabulador que sangra el bloque seleccionado, Enter que respeta
   * la sangría (y la aumenta tras `:` o `{`) y Ctrl+Enter que
   * ejecuta. Sin esto, escribir Python en un `textarea` es inviable.
   */
  protected alTeclearEnEditor(e: KeyboardEvent): void {
    const area = e.target as HTMLTextAreaElement;

    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void this.lanzar('run');
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      const { selectionStart: desde, selectionEnd: hasta } = area;
      const haySeleccionMultilinea = desde !== hasta && area.value.slice(desde, hasta).includes('\n');

      if (haySeleccionMultilinea) {
        const inicio = area.value.lastIndexOf('\n', desde - 1) + 1;
        const bloque = area.value.slice(inicio, hasta);
        const nuevo = e.shiftKey ? bloque.replace(/^ {1,4}/gm, '') : bloque.replace(/^/gm, '    ');
        area.setRangeText(nuevo, inicio, hasta, 'select');
      } else {
        area.setRangeText('    ', desde, hasta, 'end');
      }
      this.sincronizar(area);
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      const desde = area.selectionStart;
      const linea = area.value.slice(area.value.lastIndexOf('\n', desde - 1) + 1, desde);
      const sangria = /^[ \t]*/.exec(linea)?.[0] ?? '';
      const extra = /[:{]\s*$/.test(linea) ? '    ' : '';
      area.setRangeText('\n' + sangria + extra, desde, area.selectionEnd, 'end');
      this.sincronizar(area);
    }
  }

  protected reiniciar(): void {
    const lang = this.labs.lenguaje();
    this.labs.olvidarCodigo(this.cursoId(), this.id(), lang);
    this.codigo.set(this.codigoDePartida(lang));
    this.salida.set({ clase: 'empty', texto: 'Código restaurado al de partida.' });
    this.cronometro.set('');
  }

  protected cambiarLenguaje(evento: Event): void {
    const lang = (evento.target as HTMLSelectElement).value as LenguajeLab;
    this.labs.elegirLenguaje(this.cursoId(), lang);
    this.salida.set({
      clase: 'empty',
      texto: 'Has cambiado de lenguaje. Pulsa ▶ Ejecutar cuando quieras.',
    });
    this.cronometro.set('');
  }

  protected cambiarRemoto(evento: Event): void {
    const activo = (evento.target as HTMLInputElement).checked;
    this.labs.alternarRemoto(this.cursoId(), activo);
    this.salida.set({
      clase: 'empty',
      texto: activo
        ? '⚡ Modo servidor real activado. Al pulsar ▶ o ✅, tu código se enviará a Judge0 y se ejecutará\n' +
          '   en un intérprete de verdad. Necesita internet y tarda entre uno y tres segundos.'
        : 'Modo local: el intérprete de esta página, instantáneo y sin conexión.',
    });
    this.cronometro.set('');
  }

  /* ---------- Ejecución ---------- */

  protected async lanzar(modo: 'run' | 'test'): Promise<void> {
    if (this.ocupado()) return;
    this.ocupado.set(true);
    try {
      if (this.labs.remoto()) await this.lanzarRemoto(modo);
      else this.lanzarLocal(modo);
    } finally {
      this.ocupado.set(false);
    }
  }

  private lanzarLocal(modo: 'run' | 'test'): void {
    const lang = this.labs.lenguaje();
    const codigo = this.codigo();
    const inicio = performance.now();

    if (modo === 'run') {
      const r = AlgoLab.run(codigo, lang);
      this.cronometro.set(
        Math.round(performance.now() - inicio) + ' ms · ' + r.steps.toLocaleString('es') + ' pasos',
      );

      if (r.ok) {
        this.salida.set(
          r.output
            ? { clase: '', texto: r.output }
            : {
                clase: 'empty',
                texto:
                  'El programa terminó sin errores, pero no imprimió nada.\n' +
                  'Añade un print / System.out.println / console.log para ver el resultado.',
              },
        );
      } else {
        this.salida.set({
          clase: 'err',
          texto: (r.output ? r.output + '\n' : '') + this.pintarError(r.error),
        });
      }
      return;
    }

    const r = AlgoLab.test(codigo, lang, this.ejercicio());
    this.cronometro.set(Math.round(performance.now() - inicio) + ' ms');

    if (r.error) {
      this.salida.set({ clase: 'err', texto: this.pintarError(r.error) });
      return;
    }

    this.salida.set({
      clase: r.ok ? 'good' : '',
      texto: r.ok
        ? '🎉 Perfecto. Ahora abre la solución y compara tu razonamiento con el del capítulo:\n' +
          '   ¿coincide la complejidad? ¿hay algún caso borde que no habías pensado?'
        : 'Revisa los casos marcados con ✗. Empieza siempre por el más pequeño que falle.',
      marcador: { ok: r.ok, texto: `${r.passed} de ${r.total} casos correctos` },
      casos: r.results,
    });
  }

  private async lanzarRemoto(modo: 'run' | 'test'): Promise<void> {
    /* El módulo de Judge0 sólo se descarga si el alumno enciende ⚡. */
    const { JUDGE0, ejecutarRemoto, programaDePrueba, leerResultados } = await import(
      './interprete/judge0.js'
    );

    const lang = this.labs.lenguaje();
    const ejercicio = this.ejercicio();
    const motor = JUDGE0.lenguajes[lang].nombre;

    this.salida.set({ clase: 'empty', texto: `⏳ Enviando a Judge0 y ejecutando en ${motor}…` });
    this.cronometro.set('servidor real');
    const inicio = performance.now();

    let fuente = this.codigo();
    if (modo === 'test') {
      const preparado = programaDePrueba(fuente, lang, this.nombreFuncion(), ejercicio.cases ?? []);
      if (preparado === null) {
        this.salida.set({
          clase: 'err',
          texto:
            '⛔ No he podido preparar la comprobación para el servidor.\n' +
            (lang === 'java'
              ? `En Java necesito encontrar tu «public static void main(String[] args)» y la firma de «${this.nombreFuncion()}».\n` +
                'Comprueba que las dos siguen ahí, o desactiva ⚡ para probar con el intérprete de la página.'
              : 'Desactiva ⚡ para probar con el intérprete de la página.'),
        });
        this.cronometro.set('');
        return;
      }
      fuente = preparado;
    }

    let respuesta;
    try {
      respuesta = await ejecutarRemoto(fuente, lang);
    } catch (e) {
      this.salida.set({
        clase: 'err',
        texto:
          '⛔ ' + (e instanceof Error ? e.message : String(e)) +
          '\n\nEl intérprete de la página sigue disponible: desactiva ⚡ y vuelve a pulsar.',
      });
      this.cronometro.set('');
      return;
    }

    this.cronometro.set(Math.round(performance.now() - inicio) + ' ms · ' + respuesta.motor);

    if (modo === 'run') {
      if (respuesta.error) {
        this.salida.set({
          clase: 'err',
          texto:
            (respuesta.salida ? respuesta.salida + '\n' : '') +
            '⛔ ' + respuesta.estado + '\n' + respuesta.error,
        });
      } else {
        this.salida.set(
          respuesta.salida
            ? { clase: '', texto: respuesta.salida }
            : { clase: 'empty', texto: 'El programa terminó sin errores, pero no imprimió nada.' },
        );
      }
      return;
    }

    const casos = leerResultados(respuesta.salida, ejercicio.cases ?? [], undefined);
    if (!casos.length) {
      this.salida.set({
        clase: 'err',
        texto:
          '⛔ El servidor no ha devuelto ningún resultado.\n' +
          (respuesta.error ||
            `Revisa que tu función se llame «${this.nombreFuncion()}» y que el programa compile.`),
      });
      return;
    }

    const bien = casos.filter((c) => c.ok).length;
    const todos = bien === (ejercicio.cases?.length ?? 0);

    this.salida.set({
      clase: todos ? 'good' : '',
      texto: todos
        ? `🎉 Perfecto, y verificado en ${respuesta.motor} de verdad.\n   Tu solución no depende del intérprete de la página.`
        : `Revisa los casos marcados con ✗. Esto es lo que hace un ${respuesta.motor} real.`,
      marcador: {
        ok: todos,
        texto: `${bien} de ${ejercicio.cases?.length ?? 0} casos correctos · ⚡ ${respuesta.motor}`,
      },
      casos,
    });
  }

  /* ---------- Presentación ---------- */

  protected llamada(caso: CasoProbado): string {
    return this.nombreFuncion() + '(' + caso.args.map((a) => this.pintarValor(a)).join(', ') + ')';
  }

  protected obtenido(caso: CasoProbado): string {
    return caso.error
      ? '⛔ ' + caso.error.name + ': ' + caso.error.message
      : this.pintarValor(caso.got);
  }

  protected esperado(caso: CasoProbado): string {
    return this.pintarValor(caso.expected);
  }

  /** Cómo se escribe un argumento o un resultado en el panel de casos. */
  private pintarValor(v: unknown): string {
    if (v === null || v === undefined) return 'null';
    if (typeof v === 'string') return '"' + v + '"';
    if (Array.isArray(v)) return '[' + v.map((x) => this.pintarValor(x)).join(', ') + ']';
    if (typeof v === 'object') {
      return (
        '{' +
        Object.entries(v as Record<string, unknown>)
          .map(([k, val]) => k + ': ' + this.pintarValor(val))
          .join(', ') +
        '}'
      );
    }
    return String(v);
  }

  private pintarError(error: { name: string; message: string; line?: number } | null): string {
    if (!error) return '⛔ Error desconocido.';
    return '⛔ ' + error.name + (error.line ? ' · línea ' + error.line : '') + '\n' + error.message;
  }

  private codigoDePartida(lenguaje: LenguajeLab): string {
    const e = this.ejercicio();
    return lenguaje === 'python' ? e.py : lenguaje === 'java' ? e.java : e.js;
  }

  /** Tras editar por código hay que avisar al signal y al alto del área. */
  private sincronizar(area: HTMLTextAreaElement): void {
    this.codigo.set(area.value);
    this.labs.guardarCodigo(this.cursoId(), this.id(), this.labs.lenguaje(), area.value);
  }
}
