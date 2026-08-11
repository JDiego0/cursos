import { Injectable, inject, signal } from '@angular/core';

import { AlmacenamientoService } from '@core/services/almacenamiento.service';
import { CatalogoStore } from '@core/state/catalogo.store';
import { LenguajeLab } from './interprete/algo-lab';

/** Cómo se guardan los laboratorios dentro del registro del curso. */
interface RegistroLab {
  /** id de ejercicio → lenguaje → código escrito. */
  code?: Record<string, Partial<Record<LenguajeLab, string>>>;
  lang?: LenguajeLab;
  remoto?: boolean;
  [otras: string]: unknown;
}

export const LENGUAJES: { id: LenguajeLab; nombre: string }[] = [
  { id: 'python', nombre: '🐍 Python' },
  { id: 'java', nombre: '☕ Java' },
  { id: 'javascript', nombre: '🟨 JavaScript' },
];

/**
 * Preferencias y código de los laboratorios.
 *
 * El lenguaje elegido y el interruptor ⚡ son **globales**: si
 * cambias a Java en un ejercicio, los demás te esperan en Java. Por
 * eso son signals de este servicio y no estado de cada componente.
 *
 * El código escrito se guarda dentro del mismo registro de
 * `localStorage` del curso, bajo la clave `code`, exactamente como
 * lo hacía el curso original: quien ya tenía soluciones a medias las
 * encuentra donde las dejó.
 */
@Injectable({ providedIn: 'root' })
export class LaboratorioService {
  private readonly almacen = inject(AlmacenamientoService);
  private readonly catalogo = inject(CatalogoStore);

  readonly lenguaje = signal<LenguajeLab>('python');
  readonly remoto = signal(false);

  private cursoCargado: string | null = null;

  /** Lee las preferencias guardadas del curso. Idempotente. */
  cargarPreferencias(cursoId: string): void {
    if (this.cursoCargado === cursoId) return;
    this.cursoCargado = cursoId;

    const registro = this.leer(cursoId);
    if (registro?.lang && LENGUAJES.some((l) => l.id === registro.lang)) {
      this.lenguaje.set(registro.lang);
    }
    this.remoto.set(registro?.remoto === true);
  }

  elegirLenguaje(cursoId: string, lenguaje: LenguajeLab): void {
    this.lenguaje.set(lenguaje);
    this.escribir(cursoId, (r) => {
      r.lang = lenguaje;
    });
  }

  alternarRemoto(cursoId: string, activo: boolean): void {
    this.remoto.set(activo);
    this.escribir(cursoId, (r) => {
      r.remoto = activo;
    });
  }

  /** Código guardado de un ejercicio, o `undefined` si nunca se tocó. */
  codigoGuardado(cursoId: string, labId: string, lenguaje: LenguajeLab): string | undefined {
    return this.leer(cursoId)?.code?.[labId]?.[lenguaje];
  }

  guardarCodigo(cursoId: string, labId: string, lenguaje: LenguajeLab, codigo: string): void {
    this.escribir(cursoId, (r) => {
      const todos = r.code ?? {};
      todos[labId] = { ...todos[labId], [lenguaje]: codigo };
      r.code = todos;
    });
  }

  /** Olvida el código de un ejercicio para volver al de partida. */
  olvidarCodigo(cursoId: string, labId: string, lenguaje: LenguajeLab): void {
    this.escribir(cursoId, (r) => {
      if (r.code?.[labId]) delete r.code[labId][lenguaje];
    });
  }

  /* ---------- Interno ---------- */

  private clave(cursoId: string): string | null {
    return this.catalogo.ficha(cursoId)?.claveAlmacen ?? null;
  }

  private leer(cursoId: string): RegistroLab | null {
    const clave = this.clave(cursoId);
    return clave ? this.almacen.leerJson<RegistroLab>(clave) : null;
  }

  /** Fusiona sobre el registro del curso: el progreso no se toca. */
  private escribir(cursoId: string, cambio: (registro: RegistroLab) => void): void {
    const clave = this.clave(cursoId);
    if (!clave) return;
    const registro = this.almacen.leerJson<RegistroLab>(clave) ?? {};
    cambio(registro);
    this.almacen.escribirJson(clave, registro);
  }
}
