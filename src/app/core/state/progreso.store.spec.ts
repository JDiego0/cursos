import { TestBed } from '@angular/core/testing';

import { FichaCurso } from '@core/models';
import { CatalogoStore } from './catalogo.store';
import { ProgresoStore } from './progreso.store';

/** Ficha mínima con los capítulos 0..n-1. */
function ficha(id: string, clave: string, capitulos: number): FichaCurso {
  return {
    id,
    claveAlmacen: clave,
    nombre: id,
    tecnologia: '',
    icono: '📘',
    proyecto: '',
    proyectoDesc: '',
    horas: 1,
    nivel: '',
    descripcion: '',
    temas: [],
    colores: { base: '#000', suave: '#000', texto: '#000' },
    totalCapitulos: capitulos,
    modulos: ['M1'],
    capitulos: Array.from({ length: capitulos }, (_, n) => ({
      num: n,
      corto: 'Cap ' + n,
      titulo: 'Capítulo ' + n,
      modulo: 'M1',
      duracion: '30 min',
      nivel: 'Principiante',
      icono: '📘',
      conceptos: [],
    })),
  };
}

const FICHAS = [ficha('java', 'java-librotech-v1', 4), ficha('angular', 'angular-nakagym-v1', 3)];

describe('ProgresoStore', () => {
  let store: ProgresoStore;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        ProgresoStore,
        {
          provide: CatalogoStore,
          useValue: {
            fichas: () => FICHAS,
            ficha: (id: string) => FICHAS.find((f) => f.id === id),
          },
        },
      ],
    });
    store = TestBed.inject(ProgresoStore);
  });

  it('lee el esquema «completed / last» de los cursos legacy', () => {
    localStorage.setItem(
      'java-librotech-v1',
      JSON.stringify({ completed: ['cap-0', 'cap-2'], last: 'cap-3' }),
    );
    store.releer();

    const p = store.de('java');
    expect(p.hechos).toEqual([0, 2]);
    expect(p.ultimo).toBe(3);
    expect(p.pct).toBe(50);
    expect(p.tocado).toBe(true);
  });

  it('lee el esquema «hechos / ultimo» que usaba el curso de Angular', () => {
    localStorage.setItem(
      'angular-nakagym-v1',
      JSON.stringify({ hechos: ['cap-1'], ultimo: 'cap-1' }),
    );
    store.releer();

    const p = store.de('angular');
    expect(p.hechos).toEqual([1]);
    expect(p.ultimo).toBe(1);
  });

  it('descarta capítulos que ya no existen en el temario', () => {
    localStorage.setItem(
      'java-librotech-v1',
      JSON.stringify({ completed: ['cap-1', 'cap-99'], last: 'cap-42' }),
    );
    store.releer();

    const p = store.de('java');
    expect(p.hechos).toEqual([1]);
    expect(p.ultimo).toBeNull();
  });

  it('conserva las claves que no son suyas al escribir', () => {
    localStorage.setItem(
      'java-librotech-v1',
      JSON.stringify({ completed: [], code: { 'lab-0': { python: 'mi código' } }, theme: 'light' }),
    );
    store.releer();
    store.alternarCapitulo('java', 1);

    const guardado = JSON.parse(localStorage.getItem('java-librotech-v1')!);
    expect(guardado.completed).toEqual(['cap-1']);
    expect(guardado.code['lab-0'].python).toBe('mi código');
    expect(guardado.theme).toBe('light');
  });

  it('normaliza al esquema nuevo y elimina el antiguo al escribir', () => {
    localStorage.setItem('angular-nakagym-v1', JSON.stringify({ hechos: ['cap-0'] }));
    store.releer();
    store.alternarCapitulo('angular', 2);

    const guardado = JSON.parse(localStorage.getItem('angular-nakagym-v1')!);
    expect(guardado.completed).toEqual(['cap-0', 'cap-2']);
    expect(guardado.hechos).toBeUndefined();
  });

  it('continúa por el último visitado si aún está pendiente', () => {
    localStorage.setItem(
      'java-librotech-v1',
      JSON.stringify({ completed: ['cap-0'], last: 'cap-2' }),
    );
    store.releer();
    expect(store.capituloParaContinuar('java')).toBe(2);
  });

  it('continúa por el primer pendiente si el último ya está hecho', () => {
    localStorage.setItem(
      'java-librotech-v1',
      JSON.stringify({ completed: ['cap-0', 'cap-1'], last: 'cap-1' }),
    );
    store.releer();
    expect(store.capituloParaContinuar('java')).toBe(2);
  });

  it('agrega el progreso global de todos los cursos', () => {
    localStorage.setItem('java-librotech-v1', JSON.stringify({ completed: ['cap-0', 'cap-1'] }));
    localStorage.setItem('angular-nakagym-v1', JSON.stringify({ completed: ['cap-0'] }));
    store.releer();

    const g = store.global();
    expect(g.capitulosHechos).toBe(3);
    expect(g.capitulosTotales).toBe(7);
    expect(g.cursosEnCurso).toBe(2);
    expect(g.cursosCompletados).toBe(0);
  });

  it('marca un curso como completado cuando no queda ninguno pendiente', () => {
    localStorage.setItem('angular-nakagym-v1', JSON.stringify({ completed: ['cap-0', 'cap-1', 'cap-2'] }));
    store.releer();
    expect(store.estadoDe('angular')).toBe('completado');
  });

  it('exporta e importa manteniendo el formato del panel legacy', () => {
    localStorage.setItem('java-librotech-v1', JSON.stringify({ completed: ['cap-3'] }));
    store.releer();

    const copia = store.exportar();
    expect(JSON.parse(copia).panel).toBe('cursos-panel-v1');

    store.reiniciarTodo();
    expect(store.de('java').set.size).toBe(0);

    const r = store.importar(copia);
    expect(r.ok).toBe(true);
    expect(r.restaurados).toBe(1);
    expect(store.de('java').hechos).toEqual([3]);
  });

  it('ignora claves desconocidas al importar', () => {
    const copia = JSON.stringify({ datos: { 'curso-inventado-v1': '{"completed":["cap-0"]}' } });
    const r = store.importar(copia);

    expect(r.ok).toBe(false);
    expect(localStorage.getItem('curso-inventado-v1')).toBeNull();
  });

  it('recuerda qué acordeones se han leído, sin desmarcarlos', () => {
    store.marcarAcordeonLeido('java', 1, 0);
    store.marcarAcordeonLeido('java', 1, 3);
    store.marcarAcordeonLeido('java', 1, 0);

    const leidos = store.acordeonesLeidos('java', 1);
    expect([...leidos].sort()).toEqual([0, 3]);
    expect(store.acordeonesLeidos('java', 2).size).toBe(0);
  });
});
