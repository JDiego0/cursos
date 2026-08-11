import { Routes } from '@angular/router';

/**
 * Mapa de rutas de la aplicación.
 *
 * Cada área es un `loadChildren`: el paquete inicial sólo lleva el
 * cromo y el panel; el visor de cursos y, dentro de él, el
 * laboratorio de código (que arrastra un intérprete de 4.000 líneas)
 * se descargan la primera vez que hacen falta.
 */
export const routes: Routes = [
  {
    path: '',
    loadChildren: () => import('@features/panel/panel.routes').then((m) => m.rutasPanel),
  },
  {
    path: 'curso/:cursoId',
    loadChildren: () => import('@features/curso/curso.routes').then((m) => m.rutasCurso),
  },
  {
    path: '**',
    loadComponent: () =>
      import('@features/no-encontrado/no-encontrado.component').then((m) => m.NoEncontradoComponent),
  },
];
