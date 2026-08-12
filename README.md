# CURSOS

Aplicación **Angular** que reúne ocho cursos interactivos. Cada curso construye **un solo
proyecto** de principio a fin, capítulo a capítulo, y guarda tu progreso en el navegador.

| Curso | Proyecto | Capítulos |
|---|---|---|
| Algoritmia y Lógica · Python · Java · JS | **AlgoNaka**, tu playbook de patrones | 25 |
| Java desde Cero · Spring Boot | **LibroTech**, gestión de una librería | 25 |
| React desde Cero · Vite · TypeScript | **CineNaka**, catálogo de cine | 25 |
| Python desde Cero · pandas · FastAPI | **NakaData**, plataforma de datos | 25 |
| Angular desde Cero · TypeScript · RxJS | **NakaGym**, gestión de un gimnasio | 24 |
| IA para Desarrolladores · LLMs · n8n | **NakaDesk**, copiloto de un equipo | 22 |
| Docker y Kubernetes · Compose · Helm | **NakaTicket**, venta de entradas | 22 |
| Azure desde Cero · CLI | **NakaShop**, tienda en la nube | 12 |

**180 capítulos · ~209 horas de estudio.**

---

## Empezar

```bash
npm install
npm start          # http://localhost:4200
```

Para publicarlo:

```bash
npm run build      # deja el resultado en dist/cursos-app/browser/
```

La carpeta `dist/cursos-app/browser/` es estática y se sirve desde cualquier sitio (GitHub Pages,
Netlify, un `nginx`, `npx serve`). La aplicación usa **rutas con almohadilla**
(`#/curso/java/capitulo/3`), así que **no hace falta configurar reescrituras** en el servidor.

> **Nota:** al ser una aplicación compilada, `index.html` ya **no** se abre con doble clic: los
> navegadores bloquean los módulos de JavaScript sobre `file://`. Necesita un servidor estático,
> aunque sea `npx serve dist/cursos-app/browser`. Los archivos autocontenidos de antes siguen en
> `legacy/` para quien los necesite (ver más abajo).

---

## Estructura

```
CURSOS/
├─ src/
│  ├─ index.html                  Documento anfitrión
│  ├─ main.ts                     Arranque
│  ├─ styles.css                  Sistema de diseño global
│  └─ app/
│     ├─ app.ts / app.config.ts / app.routes.ts
│     ├─ core/                    Sin UI · se carga una vez
│     │  ├─ models/               Interfaces del dominio
│     │  ├─ data/                 ACCESO A DATOS · CursoRepository
│     │  ├─ state/                LÓGICA DE NEGOCIO · CatalogoStore, ProgresoStore
│     │  ├─ services/             Tema, almacenamiento, resaltador, buscador, portapapeles
│     │  └─ rutas.ts              Constructores de enlaces
│     ├─ shared/                  PRESENTACIÓN reutilizable
│     │  ├─ components/           acordeon · anillo-progreso · buscador · volver-arriba
│     │  ├─ directives/           contenido (hidrata el HTML de los capítulos)
│     │  └─ pipes/                htmlSeguro · htmlLimpio · nivelClase · estadoCurso
│     ├─ layout/                  Shell: barra superior, menú lateral, telón
│     └─ features/                Una carpeta por área, todas diferidas
│        ├─ panel/                Portada · progreso global
│        ├─ curso/                Portada del curso · capítulo · estado · glosario
│        ├─ laboratorio/          Editor + intérprete (sólo algoritmia)
│        └─ no-encontrado/
├─ public/contenido/              Contenido generado · un JSON por curso
├─ herramientas/
│  ├─ migrar-contenido.js         legacy/*.html → public/contenido/*.json (+ validación)
│  └─ generar-catalogo.js         Sólo para el panel legacy
└─ legacy/                        Los 8 archivos HTML originales, intactos
```

### Las capas y quién puede llamar a quién

```
   features  ──────►  shared  ──────►  core
      │                                 ▲
      └─────────────────────────────────┘

   core     no importa nada de shared ni de features
   shared   no importa nada de features
   features no importa de otro feature
```

`core` no sabe que existe una interfaz; `shared` no sabe qué se está mostrando; un feature no
depende de otro. Si alguna vez necesitas romper una de estas tres reglas, lo que falta es una pieza
en `core` o en `shared`.

---

## El contenido de los cursos

Los 135.000 renglones de contenido no están dentro de los componentes: viven en
`public/contenido/<curso>.json` y los descarga `CursoRepository` cuando abres un curso. Cada
capítulo es un objeto con sus metadatos, su caja de objetivo y sus **ocho acordeones**.

```
public/contenido/
├─ catalogo.json      56 kB   fichas de los 7 cursos + temario de los 158 capítulos
├─ java.json         950 kB   el curso entero
├─ react.json        1,2 MB
└─ …
```

El catálogo se carga al arrancar (es pequeño y lo necesitan el menú, el buscador y el progreso).
Cada curso se descarga **una sola vez**, la primera que lo abres.

### Regenerar el contenido

```bash
node herramientas/migrar-contenido.js
```

Relee `legacy/cursos/*.html`, vuelve a extraer el contenido y **valida** que cumple las reglas del
proyecto: ocho acordeones por capítulo, numeración correlativa, módulos que agrupan capítulos
consecutivos, `ARCH` y `RESOURCES` apuntando a capítulos que existen, ningún `<script>` ni manejador
`on*` en el contenido, todos los bloques de código con `data-lang` y todos los laboratorios
referenciados presentes. Si algo falla lo dice y termina con código de salida 1.

---

## Cómo funciona el progreso

Se guarda en el `localStorage` del navegador, **bajo la misma clave que usaban los cursos antiguos**
(`java-librotech-v1`, `react-cinenaka-v1`…). Es decir: si ya estudiabas con los HTML sueltos, abres
la aplicación y encuentras tu avance donde lo dejaste.

- **Por navegador y por perfil.** Si estudias en Chrome, la aplicación abierta en Firefox marcará 0 %.
- **No viaja con los archivos.** Usa *Exportar progreso* en la vista **Progreso global**; el formato
  del volcado es el mismo del panel antiguo, así que las copias viejas se importan sin tocarlas.
- **El código de los laboratorios** se guarda en la misma clave, por ejercicio y por lenguaje.
  *Reiniciar progreso* también lo borra.

---

## El laboratorio de código (curso de algoritmia)

Cada capítulo trae un ejercicio que se resuelve en la propia página, en **Python, Java o
JavaScript**, con un intérprete propio escrito en JavaScript
(`src/app/features/laboratorio/interprete/algo-lab.js`, unas 4.300 líneas). Funciona sin conexión y
sin servidor.

El interruptor **⚡ Servidor real** manda el código a [Judge0](https://judge0.com) para ejecutarlo en
un Python 3.13, un Java 17 y un Node 22 auténticos. Es la **única** funcionalidad que toca la red, y
cumple tres condiciones: viene **desactivada**, no se contacta con nadie al cargar la página, y si el
servicio desapareciera el laboratorio seguiría funcionando entero con el intérprete local.

Todo esto se carga con `import()` diferido: los seis cursos que no tienen laboratorio nunca
descargan ni el componente ni el intérprete.

---

## Pruebas

```bash
npm test           # 45 pruebas
```

Cubren lo que más duele si se rompe:

- **`ProgresoStore`** — los dos esquemas de `localStorage` de los cursos antiguos, el descarte de
  capítulos que ya no existen, la fusión que conserva el código de los laboratorios al escribir, y
  la compatibilidad de las copias de seguridad.
- **`ResaltadorService`** — que el código no se altere, que se escape el HTML, y que `//` y `#` sean
  o no comentario según el lenguaje.
- **`BusquedaService`** — búsqueda sin acentos y `<mark>` bien colocado aun con emoji por medio.
- **Integración** — se monta la aplicación de verdad y se navega: panel, portada, capítulo con sus
  ocho acordeones, hidratación de los bloques de código, marcar como completado, estado del
  proyecto, glosario y rutas inexistentes.

---

## `legacy/`

Los ocho archivos originales (`index.html` y `cursos/*.html`) siguen ahí, **sin tocar**. Se abren con
doble clic, funcionan sin servidor y comparten las claves de `localStorage` con la aplicación
Angular, así que puedes ir y venir sin perder el progreso.

Son además la **fuente de la que se extrae el contenido**: hoy se edita el curso en su HTML y se
regenera el JSON. Cuando el contenido pase a editarse directamente en los JSON, `legacy/` y
`herramientas/` podrán borrarse.
