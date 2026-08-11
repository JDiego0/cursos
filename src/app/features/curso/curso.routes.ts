import { Routes } from '@angular/router';

import { cursoExisteGuard } from './curso-existe.guard';
import { CursoActualStore } from './curso-actual.store';

/**
 * Rutas del visor de cursos.
 *
 * `CursoActualStore` se declara aquí y no en `root`: vive mientras
 * dure la visita a un curso y se destruye al volver al panel, junto
 * con el megabyte de contenido que tenía cargado.
 */
export const rutasCurso: Routes = [
  {
    path: '',
    canActivate: [cursoExisteGuard],
    providers: [CursoActualStore],
    loadComponent: () =>
      import('./curso-shell/curso-shell.component').then((m) => m.CursoShellComponent),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./portada/portada.component').then((m) => m.PortadaComponent),
      },
      {
        path: 'estado',
        loadComponent: () =>
          import('./estado-proyecto/estado-proyecto.component').then(
            (m) => m.EstadoProyectoComponent,
          ),
      },
      {
        path: 'capitulo/:num',
        loadComponent: () =>
          import('./capitulo/capitulo.component').then((m) => m.CapituloComponent),
      },
      {
        path: 'glosario',
        loadComponent: () =>
          import('./glosario/glosario.component').then((m) => m.GlosarioComponent),
      },
    ],
  },
];
