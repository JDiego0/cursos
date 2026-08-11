import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { CatalogoStore } from '@core/state/catalogo.store';

/**
 * Impide entrar en un curso que no está en el catálogo.
 *
 * Sin esto, una dirección antigua o mal escrita
 * (`#/curso/kotlin/capitulo/3`) provocaría una petición a un JSON
 * inexistente y una pantalla rota. Como el catálogo se carga al
 * arrancar, la comprobación es inmediata y no hace falta esperar.
 */
export const cursoExisteGuard: CanActivateFn = (ruta) => {
  const catalogo = inject(CatalogoStore);
  const router = inject(Router);

  const id = ruta.paramMap.get('cursoId');
  if (id && catalogo.ficha(id)) return true;

  return router.createUrlTree(['/'], { queryParams: { desconocido: id } });
};
