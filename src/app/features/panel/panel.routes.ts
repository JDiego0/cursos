import { Routes } from '@angular/router';

/**
 * Rutas del panel. La vista de portada y la de progreso global
 * comparten menú lateral, así que cuelgan de un mismo contenedor.
 */
export const rutasPanel: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./panel-shell/panel-shell.component').then((m) => m.PanelShellComponent),
    children: [
      {
        path: '',
        title: 'Panel de cursos',
        loadComponent: () => import('./inicio/inicio.component').then((m) => m.InicioComponent),
      },
      {
        path: 'progreso',
        title: 'Progreso global · Panel de cursos',
        loadComponent: () =>
          import('./progreso-global/progreso-global.component').then(
            (m) => m.ProgresoGlobalComponent,
          ),
      },
    ],
  },
];
