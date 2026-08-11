import { provideHttpClient, withFetch } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import {
  provideRouter,
  withComponentInputBinding,
  withHashLocation,
  withInMemoryScrolling,
  withRouterConfig,
} from '@angular/router';

import { CursoRepository } from '@core/data/curso.repository';
import { HttpCursoRepository } from '@core/data/http-curso.repository';
import { CatalogoStore } from '@core/state/catalogo.store';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),

    /* Sin Zone.js: toda la reactividad de la aplicación son signals,
       así que no hace falta parchear el navegador para detectar
       cambios. Menos JavaScript y menos comprobaciones por evento. */
    provideZonelessChangeDetection(),

    provideHttpClient(withFetch()),

    provideRouter(
      routes,
      /* Rutas con almohadilla (#/curso/java/capitulo/3).
         Dos razones: mantiene la forma de URL que ya tenían los
         cursos (#cap-3) y, sobre todo, permite publicar el build en
         cualquier carpeta estática sin configurar reescrituras en el
         servidor, que es lo más parecido al «se abre y funciona» de
         los archivos originales. */
      withHashLocation(),
      /* Los parámetros de ruta llegan a los componentes como `input()`. */
      withComponentInputBinding(),
      /* `always` para que `:cursoId`, que está en la ruta padre, llegue
         también a los hijos (`capitulo/:num` y compañía). */
      withRouterConfig({ paramsInheritanceStrategy: 'always' }),
      withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' }),
    ),

    /* Acceso a datos: la aplicación pide `CursoRepository` y recibe
       la implementación sobre JSON estáticos. Para hablar con una API
       real basta con cambiar esta línea. */
    { provide: CursoRepository, useClass: HttpCursoRepository },

    /* El catálogo se carga antes de pintar nada: es pequeño y lo
       necesitan el menú, el buscador y el progreso. A cambio, ningún
       componente tiene que contemplar el caso «todavía no ha llegado». */
    provideAppInitializer(() => inject(CatalogoStore).cargar()),
  ],
};
