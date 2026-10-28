import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { AlmacenamientoService } from './almacenamiento.service';

const CLAVE = 'cursos-lector-v1';

export const VELOCIDADES = [1, 1.25, 1.5, 1.75, 2] as const;

/**
 * Voz del lector de capítulos.
 *
 * Usa la síntesis de voz del propio navegador: no cuesta nada, no
 * necesita servidor y funciona con el build publicado como carpeta
 * estática. La calidad depende de las voces que traiga el sistema,
 * así que lo importante aquí es **elegir bien**: las voces neuronales
 * de Edge («Microsoft Dalia Online (Natural)») suenan casi humanas,
 * mientras que las locales de Windows («Microsoft Helena») suenan a
 * máquina. `puntuarVoz` ordena por eso antes que por cualquier otra
 * cosa.
 */
@Injectable({ providedIn: 'root' })
export class VozService {
  private readonly almacen = inject(AlmacenamientoService);

  readonly disponible = typeof speechSynthesis !== 'undefined';

  /** Voces en español, de mejor a peor. */
  readonly voces = signal<SpeechSynthesisVoice[]>([]);
  readonly nombreElegido = signal<string | null>(null);
  readonly velocidad = signal<number>(1);

  readonly voz = computed<SpeechSynthesisVoice | null>(() => {
    const voces = this.voces();
    return voces.find((v) => v.name === this.nombreElegido()) ?? voces[0] ?? null;
  });

  /* Se guarda para que `onend` de una locución cancelada no avance la
     lectura: sólo cuenta el fin de la que está sonando ahora. Además,
     Chrome deja de emitir `onend` si la locución se recolecta antes
     de terminar, y esta referencia lo impide. */
  private actual: SpeechSynthesisUtterance | null = null;

  constructor() {
    const guardado = this.almacen.leerJson<{ voz?: string; velocidad?: number }>(CLAVE);
    if (guardado?.voz) this.nombreElegido.set(guardado.voz);
    if (VELOCIDADES.includes(guardado?.velocidad as never)) this.velocidad.set(guardado!.velocidad!);

    if (!this.disponible) return;

    /* Las voces llegan tarde: en Chrome y Edge la primera llamada
       devuelve una lista vacía y la buena llega con `voiceschanged`. */
    const cargar = () => this.voces.set(ordenarVoces(speechSynthesis.getVoices()));
    cargar();
    speechSynthesis.addEventListener('voiceschanged', cargar);

    effect(() => {
      this.almacen.escribirJson(CLAVE, { voz: this.nombreElegido(), velocidad: this.velocidad() });
    });
  }

  /**
   * Dice `texto` y llama a `alTerminar` cuando acaba (o falla).
   * `alLlegar` recibe la posición en `texto` de cada palabra que
   * empieza a sonar, para poder reanudar desde ella.
   */
  decir(texto: string, alTerminar: () => void, alLlegar?: (posicion: number) => void): void {
    if (!this.disponible) return;
    speechSynthesis.cancel();

    const locucion = new SpeechSynthesisUtterance(texto);
    const voz = this.voz();
    locucion.lang = voz?.lang ?? 'es-ES';
    if (voz) locucion.voice = voz;
    locucion.rate = this.velocidad();

    const fin = () => {
      if (this.actual !== locucion) return;
      this.actual = null;
      alTerminar();
    };
    locucion.onend = fin;
    /* Un fragmento que el motor no sabe decir se salta en lugar de
       dejar la lectura colgada. `interrupted` y `canceled` son
       nuestros propios `cancel()` y ya los filtra `fin`. */
    locucion.onerror = fin;
    /* No todas las voces emiten `boundary`: con las que no, reanudar
       vuelve al principio del fragmento, como antes. */
    locucion.onboundary = (e) => {
      if (this.actual === locucion && e.name !== 'sentence') alLlegar?.(e.charIndex);
    };

    this.actual = locucion;
    speechSynthesis.speak(locucion);
  }

  /**
   * Corta la locución en curso.
   *
   * No se usa `speechSynthesis.pause()`: con las voces en línea de
   * Chrome y Edge no reanuda o reanuda en silencio. Pausar es callar
   * y, al reanudar, volver a decir el fragmento desde la última
   * palabra que llegó por `alLlegar`.
   */
  callar(): void {
    this.actual = null;
    if (this.disponible) speechSynthesis.cancel();
  }
}

/* ---------- Funciones puras (se prueban sin navegador) ---------- */

const FEMENINAS =
  /\b(dalia|elvira|ximena|paloma|salome|elena|lupe|beatriz|camila|catalina|larissa|marina|nuria|paulina|monica|helena|sabina|laura|lucia|valentina|renata|sofia|isabel|carlota|abril|estrella|irene|triana|vera|andrea|karla|emilia|tatiana|yolanda|maria|mariana|marisol|belkys|elsa|ines|soledad|google espanol)\b/;
const MASCULINAS =
  /\b(jorge|alvaro|pablo|raul|gerardo|tomas|jaime|diego|carlos|juan|alex|enrique|dario|gonzalo|mateo|gabriel|arnau|rodrigo|federico|lorenzo|emilio|cecilio|luciano|saul|sergio|manuel|andres|antonio|emmanuel|jose|alonso|liberto|yago|male|hombre)\b/;

/** Cuanto más alta, mejor: natural antes que femenina, femenina antes que región. */
export function puntuarVoz(voz: Pick<SpeechSynthesisVoice, 'name' | 'lang'>): number {
  const nombre = voz.name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  let puntos = 0;
  if (/natural|neural/.test(nombre)) puntos += 50;
  if (/online/.test(nombre)) puntos += 20;
  if (/premium|enhanced|mejorada/.test(nombre)) puntos += 15;
  if (/google/.test(nombre)) puntos += 10;
  if (FEMENINAS.test(nombre)) puntos += 30;
  if (MASCULINAS.test(nombre)) puntos -= 40;
  /* Desempate hacia el español neutro de América, como el del curso. */
  if (/^es[-_](mx|us|419)/i.test(voz.lang)) puntos += 3;
  return puntos;
}

export function ordenarVoces(voces: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  return voces
    .filter((v) => /^es\b/i.test(v.lang))
    .sort((a, b) => puntuarVoz(b) - puntuarVoz(a) || a.name.localeCompare(b.name));
}

/**
 * Deja el texto listo para decirse en voz alta.
 *
 * Los emojis de los títulos («📖 Teoría») se leerían como «libro
 * abierto Teoría», y las flechas y separadores como «flecha a la
 * derecha». Se quitan o se convierten en una pausa.
 */
export function prepararParaVoz(texto: string): string {
  return texto
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{20E3}]/gu, '')
    .replace(/\s*[→⟶►▶▸➜⇒·|]\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s,]+|[\s,]+$/g, '');
}

/**
 * Parte un texto largo en fragmentos de frase.
 *
 * Chrome corta en seco las locuciones de más de ~15 segundos, y
 * fragmentos cortos además permiten que pausar o cambiar de
 * velocidad retome casi donde se quedó.
 */
export function trocear(texto: string, maximo = 220): string[] {
  const frases = texto.split(/(?<=[.!?:;])\s+/).filter(Boolean);
  const trozos: string[] = [];

  for (const frase of frases) {
    if (frase.length <= maximo) {
      const ultimo = trozos.at(-1);
      if (ultimo && ultimo.length + frase.length + 1 <= maximo) trozos[trozos.length - 1] = `${ultimo} ${frase}`;
      else trozos.push(frase);
      continue;
    }
    /* Una frase demasiado larga se parte por palabras. */
    let actual = '';
    for (const palabra of frase.split(' ')) {
      if (actual && actual.length + palabra.length + 1 > maximo) {
        trozos.push(actual);
        actual = palabra;
      } else {
        actual = actual ? `${actual} ${palabra}` : palabra;
      }
    }
    if (actual) trozos.push(actual);
  }
  return trozos;
}
