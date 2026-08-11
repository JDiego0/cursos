/* ============================================================
   API pública del intérprete y del modo servidor real.

   Los dos módulos son JavaScript vendorizado: vienen tal cual del
   curso de algoritmia y no se reescriben. Este archivo declara su
   superficie para que el resto de la aplicación, que sí está en
   TypeScript estricto, los use con tipos.
   ============================================================ */

/** Un error del programa del alumno, ya traducido al español. */
export interface ErrorAlgoLab {
  name: string;
  message: string;
  line?: number;
}

/** Resultado de ejecutar un programa entero. */
export interface ResultadoEjecucion {
  ok: boolean;
  /** Todo lo que el programa imprimió. */
  output: string;
  error: ErrorAlgoLab | null;
  /** Pasos consumidos; sirve de tope contra bucles infinitos. */
  steps: number;
  ms: number;
}

/** Resultado de un caso de prueba concreto. */
export interface CasoProbado {
  args: unknown[];
  expected: unknown;
  got: unknown;
  ok: boolean;
  error?: ErrorAlgoLab;
}

/** Resultado de pasar la solución por todos los casos. */
export interface ResultadoPruebas {
  ok: boolean;
  passed: number;
  total: number;
  results: CasoProbado[];
  error: ErrorAlgoLab | null;
}

/** Lo que el intérprete espera saber de un ejercicio. */
export interface EspecificacionLab {
  fn: string | { py: string; java: string; js: string };
  cases?: [unknown[], unknown][];
  compare?: 'set';
}

export type LenguajeLab = 'python' | 'java' | 'javascript';

export declare const AlgoLab: {
  run(codigo: string, lang: LenguajeLab): ResultadoEjecucion;
  test(codigo: string, lang: LenguajeLab, spec: EspecificacionLab): ResultadoPruebas;
  same(a: unknown, b: unknown): boolean;
  sortDeep(v: unknown): unknown;
  version: string;
};
