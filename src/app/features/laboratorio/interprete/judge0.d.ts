import { CasoProbado, LenguajeLab } from './algo-lab';

/** Lo que devuelve Judge0 tras ejecutar el programa de verdad. */
export interface RespuestaRemota {
  /** Motor real: «Python 3.13.2», «Java · JDK 17.0.6»… */
  motor: string;
  salida: string;
  error: string;
  estado: string;
  ms: number;
}

export declare const JUDGE0: {
  url: string;
  lenguajes: Record<LenguajeLab, { id: number; nombre: string }>;
  msTimeout: number;
};

export declare const MARCA_OK: string;
export declare const MARCA_ERR: string;

/** Envía el código al servicio. Lanza `Error` con mensaje en español. */
export declare function ejecutarRemoto(codigo: string, lang: LenguajeLab): Promise<RespuestaRemota>;

/**
 * Envuelve la solución del alumno en un programa que recorre los
 * casos e imprime cada resultado marcado. Devuelve `null` si no
 * consigue construirlo (en Java, si no encuentra el `main`).
 */
export declare function programaDePrueba(
  codigo: string,
  lang: LenguajeLab,
  fn: string,
  casos: [unknown[], unknown][],
): string | null;

/** Interpreta la salida marcada y la compara con lo esperado. */
export declare function leerResultados(
  salida: string,
  casos: [unknown[], unknown][],
  compare?: 'set',
): CasoProbado[];
