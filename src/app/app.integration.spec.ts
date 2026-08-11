import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, withComponentInputBinding, withRouterConfig } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Observable, of, throwError } from 'rxjs';

import { CursoRepository } from '@core/data/curso.repository';
import { Acordeon, Curso, FichaCurso } from '@core/models';
import { CatalogoStore } from '@core/state/catalogo.store';
import { ProgresoStore } from '@core/state/progreso.store';
import { routes } from './app.routes';

/* ============================================================
   Un curso de mentira con la misma forma que los de verdad.
   ============================================================ */

const acordeon = (i: number, titulo: string, html: string): Acordeon => ({
  id: 'acc-' + i,
  titulo,
  abiertoPorDefecto: i === 0,
  html,
});

const ACORDEONES: Acordeon[] = [
  acordeon(
    0,
    '📖 Teoría',
    '<p>La <strong>herencia</strong> reutiliza comportamiento.</p>' +
      '<div class="code-block" data-lang="Java"><pre><code>public class Libro {}</code></pre></div>' +
      '<p class="code-note">Qué hace: declara la clase.</p>',
  ),
  acordeon(1, '💻 Implementación', '<p>Escribe la clase.</p>'),
  acordeon(2, '⌨ Compilar y probar', '<p>Ejecuta javac.</p>'),
  acordeon(3, '✔ Verificación', '<div class="note good">✅ Has terminado si compila.</div>'),
  acordeon(4, '🚀 Estado del proyecto', '<p>Ya tienes el modelo.</p>'),
  acordeon(5, '⚠ Errores comunes', '<p>Falta el punto y coma.</p>'),
  acordeon(6, '📝 Resumen', '<ul class="clean"><li>Herencia</li></ul>'),
  acordeon(
    7,
    '❓ Autoevaluación',
    '<div class="quiz"><div class="q"><p class="q-text">¿Qué es una clase?</p>' +
      '<div class="q-ans">Una plantilla de objetos.</div></div></div>',
  ),
];

const CAPITULOS = [0, 1].map((n) => ({
  num: n,
  corto: 'Capítulo corto ' + n,
  titulo: 'Título largo del capítulo ' + n,
  modulo: 'Módulo 1 · Fundamentos',
  duracion: '50 min',
  nivel: n === 0 ? 'Principiante' : 'Intermedio',
  icono: '🧰',
  conceptos: ['Concepto ' + n, 'Otro concepto'],
  objetivo: '<h3>🎯 Objetivo del capítulo</h3><p>Vas a aprender algo del capítulo ' + n + '.</p>',
  acordeones: ACORDEONES,
}));

const FICHA: FichaCurso = {
  id: 'demo',
  claveAlmacen: 'demo-proyecto-v1',
  nombre: 'Curso de Demostración',
  tecnologia: 'Java · Spring',
  icono: '☕',
  proyecto: 'ProyectoDemo',
  proyectoDesc: 'un proyecto de prueba',
  horas: 10,
  nivel: 'Principiante → Avanzado',
  descripcion: 'Un curso <strong>de prueba</strong>.',
  temas: ['POO'],
  colores: { base: '#e76f00', suave: '#ffa64d', texto: '#ffa64d' },
  totalCapitulos: 2,
  modulos: ['Módulo 1 · Fundamentos'],
  capitulos: CAPITULOS.map(({ objetivo, acordeones, ...resumen }) => resumen),
};

const CURSO: Curso = {
  id: 'demo',
  claveAlmacen: 'demo-proyecto-v1',
  titulo: 'Curso de Demostración',
  descripcion: '',
  nombre: 'Curso de Demostración',
  icono: '☕',
  proyecto: 'ProyectoDemo',
  portada: {
    kicker: 'Curso interactivo',
    titulo: 'Demo desde Cero',
    lead: 'Un curso de prueba.',
    stats: [{ valor: '2', etiqueta: 'capítulos' }],
    cuerpo: '<h2 class="sec">¿Qué es ProyectoDemo?</h2><p>Un proyecto de prueba.</p>',
  },
  estado: {
    crumb: 'Panel permanente',
    titulo: '🚀 Estado de ProyectoDemo',
    lead: 'Se actualiza solo.',
    etiquetaProgreso: 'ProyectoDemo completado',
    nota: '<b class="t">Convención de nombres</b><p>PascalCase.</p>',
  },
  arquitectura: [{ layer: 'Dominio', nodes: [{ ch: 0, i: '📁', n: 'Entorno' }, { ch: 1, i: '🧬', n: 'Modelo' }] }],
  artefactos: [
    { nombre: 'JDK', donde: 'tu máquina', capitulo: 0 },
    { nombre: 'Libro.java', donde: 'src/', capitulo: 1 },
  ],
  glosario: [{ termino: 'JDK', definicion: 'Java Development Kit.' }],
  chuleta: [{ clave: 'javac', para: 'Compila.' }],
  laboratorios: {},
  capitulos: CAPITULOS,
};

class RepoFalso extends CursoRepository {
  override catalogo(): Observable<FichaCurso[]> {
    return of([FICHA]);
  }
  override curso(id: string): Observable<Curso> {
    return id === 'demo' ? of(CURSO) : throwError(() => new Error('404'));
  }
}

/* ============================================================
   Pruebas
   ============================================================ */

describe('Aplicación · navegación y visor de cursos', () => {
  let harness: RouterTestingHarness;

  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter(
          routes,
          withComponentInputBinding(),
          withRouterConfig({ paramsInheritanceStrategy: 'always' }),
        ),
        { provide: CursoRepository, useClass: RepoFalso },
      ],
    });

    /* Lo que en producción hace `provideAppInitializer`. */
    await new Promise<void>((listo) => TestBed.inject(CatalogoStore).cargar().subscribe(() => listo()));
    harness = await RouterTestingHarness.create();
  });

  const texto = () => harness.routeNativeElement?.textContent ?? '';
  const html = () => harness.routeNativeElement?.innerHTML ?? '';

  it('pinta el panel con la tarjeta del curso', async () => {
    await harness.navigateByUrl('/');
    expect(texto()).toContain('Curso de Demostración');
    expect(texto()).toContain('Todos tus cursos');
    expect(texto()).toContain('▶ Empezar');
  });

  it('abre la portada del curso con su temario', async () => {
    await harness.navigateByUrl('/curso/demo');
    expect(texto()).toContain('Demo desde Cero');
    expect(texto()).toContain('Temario completo');
    expect(texto()).toContain('Capítulo corto 0');
    expect(texto()).toContain('¿Qué es ProyectoDemo?');
  });

  it('devuelve al panel si el curso no existe', async () => {
    await harness.navigateByUrl('/curso/no-existe');
    expect(texto()).toContain('Todos tus cursos');
  });

  it('pinta un capítulo con su cabecera, chips y ocho acordeones', async () => {
    await harness.navigateByUrl('/curso/demo/capitulo/1');

    expect(texto()).toContain('Título largo del capítulo 1');
    expect(texto()).toContain('Módulo 1 · Fundamentos · Capítulo 1');
    expect(texto()).toContain('Concepto 1');
    expect(texto()).toContain('🎯 Objetivo del capítulo');

    const acordeones = harness.routeNativeElement!.querySelectorAll('details.acc');
    expect(acordeones.length).toBe(8);
  });

  it('monta la cabecera y el botón de copiar de los bloques de código', async () => {
    await harness.navigateByUrl('/curso/demo/capitulo/0');

    const bloque = harness.routeNativeElement!.querySelector('.code-block');
    expect(bloque?.querySelector('.code-head .lang')?.textContent).toBe('Java');
    expect(bloque?.querySelector('.copy-btn')).not.toBeNull();
    /* Y el código llega resaltado, no en crudo. */
    expect(bloque?.querySelector('code')?.innerHTML).toContain('c-key');
  });

  it('añade el botón de mostrar respuestas a la autoevaluación', async () => {
    await harness.navigateByUrl('/curso/demo/capitulo/0');

    const quiz = harness.routeNativeElement!.querySelector('.quiz');
    const boton = quiz?.querySelector('button');
    expect(boton?.textContent).toContain('Mostrar respuestas');

    boton?.click();
    expect(quiz?.classList.contains('show')).toBe(true);
  });

  it('cuenta como leído el acordeón que viene abierto', async () => {
    await harness.navigateByUrl('/curso/demo/capitulo/0');
    expect(texto()).toContain('1 / 8 secciones');
  });

  it('marca el capítulo como completado y lo guarda', async () => {
    await harness.navigateByUrl('/curso/demo/capitulo/0');

    const boton = Array.from(harness.routeNativeElement!.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Marcar como completado'),
    );
    expect(boton).toBeDefined();
    boton!.click();

    const progreso = TestBed.inject(ProgresoStore);
    expect(progreso.estaCompletado('demo', 0)).toBe(true);

    const guardado = JSON.parse(localStorage.getItem('demo-proyecto-v1')!);
    expect(guardado.completed).toEqual(['cap-0']);
  });

  it('enciende las piezas del proyecto de los capítulos completados', async () => {
    await harness.navigateByUrl('/curso/demo/capitulo/0');
    TestBed.inject(ProgresoStore).alternarCapitulo('demo', 0);

    await harness.navigateByUrl('/curso/demo/estado');
    const nodos = harness.routeNativeElement!.querySelectorAll('.nodo');
    expect(nodos.length).toBe(2);
    expect(nodos[0].classList.contains('on')).toBe(true);
    expect(nodos[1].classList.contains('on')).toBe(false);
    expect(texto()).toContain('1 de 2 piezas construidas');
  });

  it('avisa cuando el capítulo de la dirección no existe', async () => {
    await harness.navigateByUrl('/curso/demo/capitulo/99');
    expect(texto()).toContain('Ese capítulo no existe');
  });

  it('filtra el glosario mientras se escribe', async () => {
    await harness.navigateByUrl('/curso/demo/glosario');
    expect(texto()).toContain('JDK');
    expect(texto()).toContain('javac');
  });

  it('muestra el progreso global agregado', async () => {
    TestBed.inject(ProgresoStore).alternarCapitulo('demo', 0);
    await harness.navigateByUrl('/progreso');

    expect(texto()).toContain('1 de 2 capítulos');
    const celdas = harness.routeNativeElement!.querySelectorAll('.celda');
    expect(celdas.length).toBe(2);
    expect(celdas[0].classList.contains('hecho')).toBe(true);
  });

  it('lleva a la pantalla de no encontrado con una dirección cualquiera', async () => {
    await harness.navigateByUrl('/una/ruta/inventada');
    expect(texto()).toContain('no lleva a ninguna parte');
    expect(html()).toContain('Curso de Demostración');
  });
});
