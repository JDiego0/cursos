import {
  Directive,
  ElementRef,
  OnDestroy,
  effect,
  inject,
  input,
  output,
} from '@angular/core';

import { PortapapelesService } from '@core/services/portapapeles.service';
import { ResaltadorService } from '@core/services/resaltador.service';

/**
 * Pinta el HTML de un capítulo y le da vida.
 *
 * El contenido de los cursos son 135.000 líneas de HTML que no tiene
 * sentido convertir en plantillas de Angular: es prosa, tablas y
 * bloques de código. Llega como cadena y se inyecta tal cual.
 *
 * Lo que esta directiva añade encima —y es lo que antes hacía el
 * motor de cada curso a mano— es:
 *
 *   · cabecera con el lenguaje y botón «Copiar» en cada `.code-block`,
 *     con el código resaltado;
 *   · botón de mostrar/ocultar respuestas en cada `.quiz`;
 *   · aviso de que hay huecos de laboratorio, para que el componente
 *     de capítulo monte ahí los editores.
 *
 * Los `addEventListener` se registran sobre nodos que se destruyen
 * con el propio elemento, pero se guardan igualmente para poder
 * soltarlos al recargar el contenido y no acumular escuchas al
 * navegar entre capítulos.
 */
@Directive({
  selector: '[appContenido]',
  host: { class: 'contenido' },
})
export class ContenidoDirective implements OnDestroy {
  /** HTML del capítulo, ya extraído del curso. */
  readonly appContenido = input.required<string>();

  /** Se emite tras pintar e hidratar, con el elemento anfitrión. */
  readonly hidratado = output<HTMLElement>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly resaltador = inject(ResaltadorService);
  private readonly portapapeles = inject(PortapapelesService);

  private limpiezas: (() => void)[] = [];

  constructor() {
    effect(() => {
      const html = this.appContenido();
      this.soltarEscuchas();
      this.host.nativeElement.innerHTML = html;
      this.montarBloquesDeCodigo();
      this.montarAutoevaluaciones();
      this.hidratado.emit(this.host.nativeElement);
    });
  }

  ngOnDestroy(): void {
    this.soltarEscuchas();
  }

  /* ---------- Bloques de código ---------- */

  private montarBloquesDeCodigo(): void {
    const bloques = this.host.nativeElement.querySelectorAll<HTMLElement>('.code-block');

    for (const bloque of Array.from(bloques)) {
      const lenguaje = bloque.dataset['lang'] || 'Código';
      const codigo = bloque.querySelector('pre code') ?? bloque.querySelector('pre');
      if (!codigo) continue;

      /* `textContent` antes de resaltar: es lo que se copia, sin las
         etiquetas que añade el coloreado. */
      const fuente = (codigo.textContent ?? '').replace(/^\n+|\s+$/g, '');
      codigo.innerHTML = this.resaltador.resaltar(fuente, lenguaje);

      const cabecera = document.createElement('div');
      cabecera.className = 'code-head';

      const etiqueta = document.createElement('span');
      etiqueta.className = 'lang';
      etiqueta.textContent = lenguaje;

      const boton = document.createElement('button');
      boton.type = 'button';
      boton.className = 'copy-btn';
      boton.textContent = '⧉ Copiar';
      this.escuchar(boton, 'click', () => void this.copiar(fuente, boton));

      cabecera.append(etiqueta, boton);
      bloque.insertBefore(cabecera, bloque.firstChild);
    }
  }

  private async copiar(texto: string, boton: HTMLButtonElement): Promise<void> {
    const ok = await this.portapapeles.copiar(texto);
    const original = boton.textContent;
    boton.textContent = ok ? '✓ Copiado' : '⚠ No se pudo copiar';
    boton.classList.toggle('ok', ok);
    setTimeout(() => {
      boton.textContent = original;
      boton.classList.remove('ok');
    }, 1600);
  }

  /* ---------- Autoevaluación ---------- */

  private montarAutoevaluaciones(): void {
    const quizzes = this.host.nativeElement.querySelectorAll<HTMLElement>('.quiz');

    for (const quiz of Array.from(quizzes)) {
      const boton = document.createElement('button');
      boton.type = 'button';
      boton.className = 'btn';
      boton.textContent = '👁 Mostrar respuestas';
      boton.setAttribute('aria-expanded', 'false');

      this.escuchar(boton, 'click', () => {
        const visible = quiz.classList.toggle('show');
        boton.textContent = visible ? '🙈 Ocultar respuestas' : '👁 Mostrar respuestas';
        boton.setAttribute('aria-expanded', String(visible));
      });

      quiz.appendChild(boton);
    }
  }

  /* ---------- Escuchas ---------- */

  private escuchar<K extends keyof HTMLElementEventMap>(
    elemento: HTMLElement,
    evento: K,
    manejador: (e: HTMLElementEventMap[K]) => void,
  ): void {
    elemento.addEventListener(evento, manejador);
    this.limpiezas.push(() => elemento.removeEventListener(evento, manejador));
  }

  private soltarEscuchas(): void {
    for (const soltar of this.limpiezas) soltar();
    this.limpiezas = [];
  }
}
