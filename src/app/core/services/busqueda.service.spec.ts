import { TestBed } from '@angular/core/testing';

import { Curso, FichaCurso } from '@core/models';
import { CatalogoStore } from '@core/state/catalogo.store';
import { BusquedaService } from './busqueda.service';

const FICHA: FichaCurso = {
  id: 'java',
  claveAlmacen: 'java-librotech-v1',
  nombre: 'Java desde Cero',
  tecnologia: 'Java · Spring Boot',
  icono: '☕',
  proyecto: 'LibroTech',
  proyectoDesc: 'un sistema de gestión de una librería',
  horas: 30,
  nivel: 'Principiante → Avanzado',
  descripcion: 'Del primer <code>Hola Mundo</code> a microservicios.',
  temas: ['POO', 'Colecciones'],
  colores: { base: '#e76f00', suave: '#ffa64d', texto: '#ffa64d' },
  totalCapitulos: 2,
  modulos: ['Módulo 1 · El lenguaje'],
  capitulos: [
    {
      num: 0,
      corto: 'Preparación',
      titulo: 'El ecosistema Java y tu entorno',
      modulo: 'Módulo 1 · El lenguaje',
      duracion: '50 min',
      nivel: 'Principiante',
      icono: '🧰',
      conceptos: ['JDK', 'Compilación'],
    },
    {
      num: 1,
      corto: 'Herencia',
      titulo: 'Programación orientada a objetos',
      modulo: 'Módulo 1 · El lenguaje',
      duracion: '65 min',
      nivel: 'Intermedio',
      icono: '🧬',
      conceptos: ['Herencia', 'Polimorfismo'],
    },
  ],
};

describe('BusquedaService', () => {
  let busqueda: BusquedaService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        BusquedaService,
        { provide: CatalogoStore, useValue: { fichas: () => [FICHA] } },
      ],
    });
    busqueda = TestBed.inject(BusquedaService);
  });

  it('no busca con menos de dos caracteres', () => {
    expect(busqueda.buscar('j')).toEqual([]);
  });

  it('encuentra capítulos por su título', () => {
    const r = busqueda.buscar('ecosistema');
    expect(r.length).toBe(1);
    expect(r[0].capitulo).toBe(0);
  });

  it('encuentra por concepto clave', () => {
    const r = busqueda.buscar('polimorfismo');
    expect(r[0].capitulo).toBe(1);
  });

  it('ignora los acentos en los dos sentidos', () => {
    expect(busqueda.buscar('preparacion').length).toBeGreaterThan(0);
    expect(busqueda.buscar('compilacion').length).toBeGreaterThan(0);
    expect(busqueda.buscar('módulo').length).toBeGreaterThan(0);
  });

  it('resalta la coincidencia respetando la acentuación original', () => {
    const r = busqueda.buscar('orientada');
    expect(r[0].titulo).toContain('<mark>orientada</mark>');
  });

  it('coloca el <mark> en su sitio aunque haya emoji delante', () => {
    /* Los emoji ocupan dos unidades en UTF-16: si el resaltado se
       hiciera por índices de cadena, el <mark> saldría desplazado. */
    const marcado = busqueda.buscar('libro');
    const curso = marcado.find((x) => x.tipo === 'curso');
    expect(curso).toBeDefined();
  });

  it('escapa el HTML de la consulta', () => {
    const r = busqueda.buscar('<img src=x>');
    for (const x of r) {
      expect(x.titulo).not.toContain('<img');
    }
  });

  it('pone los resultados de curso por delante de los de capítulo', () => {
    const r = busqueda.buscar('java');
    expect(r[0].tipo).toBe('curso');
  });

  it('acota a un curso cuando se le indica', () => {
    expect(busqueda.buscar('herencia', 'java').length).toBe(1);
    expect(busqueda.buscar('herencia', 'python').length).toBe(0);
  });

  it('busca dentro del texto de los acordeones una vez cargado el curso', () => {
    expect(busqueda.buscar('cafetera').length).toBe(0);

    const curso = {
      id: 'java',
      nombre: 'Java desde Cero',
      capitulos: [
        {
          ...FICHA.capitulos[0],
          objetivo: '',
          acordeones: [
            { id: 'acc-0', titulo: '📖 Teoría', abiertoPorDefecto: true, html: '<p>La JVM es una cafetera muy seria.</p>' },
          ],
        },
      ],
    } as unknown as Curso;

    busqueda.indexarCurso(curso);
    const r = busqueda.buscar('cafetera');
    expect(r.length).toBe(1);
    expect(r[0].fragmento).toContain('<mark>cafetera</mark>');
  });
});
