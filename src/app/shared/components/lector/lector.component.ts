import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';

import { AlmacenamientoService } from '@core/services/almacenamiento.service';
import { VELOCIDADES, VozService, prepararParaVoz, trocear } from '@core/services/voz.service';

/** Lo que se lee: prosa. Código, tablas y diagramas no se entienden de oído.
    Los títulos de las tarjetas (`.tag`, `.svc`) son texto suelto dentro
    de un `<div>`: sin nombrarlos aquí, de cada tarjeta sólo sonaba el cuerpo. */
const LEGIBLE = 'h1, h2, h3, h4, p, li, dt, dd, summary .ttl, .note > b.t, .card > .tag, .card > .svc, .q-text';
/* Las respuestas de la autoevaluación tampoco: leerlas las destripa. */
const EXCLUIDO = '.code-block, pre, .code-note, .diagram, .tbl-wrap, table, .q-ans, .lab, .hint, .sol, app-lector';

const CLASE_ACTIVO = 'leyendo';

/* Dónde se paró cada capítulo, por `clave`. */
const CLAVE_MARCAS = 'cursos-lector-posicion-v1';

interface Bloque {
  el: HTMLElement;
  fragmentos: string[];
  seccion: string;
}

type Estado = 'parado' | 'sonando' | 'pausado';

interface Marca {
  indice: number;
  seccion: string;
}

/**
 * Lee en voz alta el capítulo que hay dentro de `raiz`, bloque a
 * bloque, resaltando el que suena y abriendo su acordeón.
 *
 * Los bloques se sacan del DOM ya pintado y no del JSON: así el
 * lector sirve igual para los quince cursos sin que el contenido
 * tenga que saber nada de él.
 */
@Component({
  selector: 'app-lector',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './lector.component.html',
  styleUrl: './lector.component.css',
})
export class LectorComponent {
  readonly raiz = input.required<HTMLElement>();
  /** Al cambiar (otro capítulo), la lectura se detiene. */
  readonly clave = input<unknown>();

  protected readonly voz = inject(VozService);
  /** Para que el capítulo no pinte botones ▶ en un navegador sin voz. */
  readonly disponible = this.voz.disponible;
  private readonly almacen = inject(AlmacenamientoService);
  protected readonly VELOCIDADES = VELOCIDADES;

  protected readonly estado = signal<Estado>('parado');
  private readonly bloques = signal<Bloque[]>([]);
  private readonly indice = signal(0);
  /* Fragmento dentro del bloque: no lo pinta nadie, pero es estado. */
  private readonly fragmento = signal(0);

  /** Dónde se quedó la última lectura de este capítulo, si no llegó al final. */
  protected readonly guardada = signal<Marca | null>(null);

  protected readonly posicion = computed(() => {
    const bloque = this.bloques()[this.indice()];
    return { seccion: bloque?.seccion ?? '', actual: this.indice() + 1, total: this.bloques().length };
  });

  constructor() {
    effect(() => {
      const clave = String(this.clave());
      untracked(() => {
        this.detener();
        this.guardada.set(this.leerMarcas()[clave] ?? null);
      });
    });

    /* Se guarda en cada bloque y no sólo al detener: si el alumno
       cierra la pestaña a media lectura, también debe poder seguir. */
    effect(() => {
      const bloque = this.bloques()[this.indice()];
      if (!bloque) return;
      const marca = { indice: this.indice(), seccion: bloque.seccion };
      untracked(() => this.guardarMarca(String(this.clave()), marca));
    });

    /* Cambiar de voz o de velocidad se oye al momento: se repite el
       fragmento en curso con los nuevos ajustes. */
    effect(() => {
      this.voz.voz();
      this.voz.velocidad();
      untracked(() => {
        if (this.estado() === 'sonando') this.leerActual();
      });
    });

    inject(DestroyRef).onDestroy(() => this.detener());
  }

  protected alternar(): void {
    const estado = this.estado();
    if (estado === 'sonando') {
      this.estado.set('pausado');
      this.voz.callar();
      return;
    }
    if (estado === 'parado') {
      this.empezar(this.guardada()?.indice ?? 0);
      return;
    }
    this.estado.set('sonando');
    this.leerActual();
  }

  protected empezar(indice: number): void {
    const bloques = this.extraer();
    if (!bloques.length) return;
    /* Si el contenido cambió desde que se guardó, la marca puede
       apuntar más allá del final: mejor empezar que no sonar. */
    this.ir(bloques, indice < bloques.length ? indice : 0);
  }

  /**
   * Lee desde el principio del acordeón `seccion` y sigue hasta el
   * final del capítulo, esté el lector sonando, en pausa o parado.
   * El primer bloque es el título del acordeón: se anuncia solo.
   */
  leerSeccion(seccion: number): void {
    const acordeon = this.raiz().querySelectorAll('app-acordeon')[seccion];
    if (!acordeon) return;
    const bloques = this.estado() === 'parado' ? this.extraer() : this.bloques();
    const indice = bloques.findIndex((b) => acordeon.contains(b.el));
    if (indice >= 0) this.ir(bloques, indice);
  }

  protected saltar(paso: 1 | -1): void {
    const destino = this.indice() + paso;
    if (destino < 0 || destino >= this.bloques().length) return;
    this.indice.set(destino);
    this.fragmento.set(0);
    if (this.estado() === 'sonando') this.leerActual();
    else this.resaltar();
  }

  protected detener(): void {
    this.voz.callar();
    const bloque = this.bloques()[this.indice()];
    if (bloque) this.guardada.set({ indice: this.indice(), seccion: bloque.seccion });
    this.estado.set('parado');
    /* Todos, no sólo el actual: al acabar el capítulo el índice ya
       apunta más allá del último y su resaltado quedaría puesto. */
    for (const b of this.bloques()) b.el.classList.remove(CLASE_ACTIVO);
    this.bloques.set([]);
    this.indice.set(0);
    this.fragmento.set(0);
  }

  protected elegirVoz(evento: Event): void {
    this.voz.nombreElegido.set((evento.target as HTMLSelectElement).value);
  }

  protected elegirVelocidad(evento: Event): void {
    this.voz.velocidad.set(Number((evento.target as HTMLSelectElement).value));
  }

  /** «Microsoft Dalia Online (Natural) - Spanish (Mexico)» → «Dalia · natural · es-MX». */
  protected etiqueta(v: SpeechSynthesisVoice): string {
    const natural = /natural|neural/i.test(v.name) ? ' · natural' : '';
    const nombre = v.name
      .replace(/^(Microsoft|Google)\s+/i, (m) => (/google/i.test(m) ? 'Google ' : ''))
      .replace(/\s*(Online|\(Natural\)|\(Neural\)).*$/i, '')
      .replace(/\s+-\s+.*$/, '');
    return `${nombre}${natural} · ${v.lang}`;
  }

  private ir(bloques: Bloque[], indice: number): void {
    this.bloques.set(bloques);
    this.indice.set(indice);
    this.fragmento.set(0);
    this.estado.set('sonando');
    this.leerActual();
  }

  private leerActual(): void {
    const bloque = this.bloques()[this.indice()];
    if (!bloque) {
      /* Capítulo leído entero: la próxima vez se empieza de cero. */
      this.guardarMarca(String(this.clave()), null);
      this.guardada.set(null);
      this.detener();
      return;
    }
    if (this.fragmento() === 0) this.resaltar();

    this.voz.decir(bloque.fragmentos[this.fragmento()], () => {
      if (this.fragmento() + 1 < bloque.fragmentos.length) {
        this.fragmento.update((f) => f + 1);
      } else {
        this.indice.update((i) => i + 1);
        this.fragmento.set(0);
      }
      this.leerActual();
    });
  }

  private resaltar(): void {
    for (const b of this.bloques()) b.el.classList.remove(CLASE_ACTIVO);
    const el = this.bloques()[this.indice()]?.el;
    if (!el) return;

    /* Abrir el `<details>` dispara su `toggle`, y el acordeón avisa
       al capítulo como si lo hubiera abierto el alumno: cuenta como
       leído sin que el lector tenga que conocer el progreso. */
    const acordeon = el.closest('details');
    if (acordeon && !acordeon.open) acordeon.open = true;

    el.classList.add(CLASE_ACTIVO);
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  private extraer(): Bloque[] {
    const bloques: Bloque[] = [];
    for (const el of Array.from(this.raiz().querySelectorAll<HTMLElement>(LEGIBLE))) {
      if (el.closest(EXCLUIDO)) continue;
      /* Un `<li>` con `<p>` dentro se lee una vez, como `<li>`. */
      const padre = el.parentElement?.closest(LEGIBLE);
      if (padre && this.raiz().contains(padre)) continue;

      const texto = prepararParaVoz(textoSinExcluidos(el));
      if (!texto) continue;
      bloques.push({ el, fragmentos: trocear(texto), seccion: this.seccionDe(el) });
    }
    return bloques;
  }

  private seccionDe(el: HTMLElement): string {
    const titulo = el.closest('app-acordeon')?.querySelector('summary .ttl')?.textContent;
    if (titulo) return prepararParaVoz(titulo);
    return el.closest('.goal') ? 'Objetivo' : 'Introducción';
  }

  private leerMarcas(): Record<string, Marca> {
    return this.almacen.leerJson<Record<string, Marca>>(CLAVE_MARCAS) ?? {};
  }

  private guardarMarca(clave: string, marca: Marca | null): void {
    const marcas = this.leerMarcas();
    /* Volver a empezar no merece un «Continuar». */
    if (marca && marca.indice > 0) marcas[clave] = marca;
    else delete marcas[clave];
    this.almacen.escribirJson(CLAVE_MARCAS, marcas);
  }
}

function textoSinExcluidos(el: HTMLElement): string {
  if (!el.querySelector(EXCLUIDO)) return el.textContent ?? '';
  const copia = el.cloneNode(true) as HTMLElement;
  copia.querySelectorAll(EXCLUIDO).forEach((n) => n.remove());
  return copia.textContent ?? '';
}
