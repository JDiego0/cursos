# CURSOS · Guía de construcción

Este repositorio es una **aplicación Angular** que sirve siete cursos interactivos. Un curso = un
proyecto continuo repartido en capítulos, con teoría y práctica en el mismo sitio.

La guía tiene dos mitades y conviene no mezclarlas:

- **Los principios pedagógicos y la anatomía de un capítulo (§1 y §5–§8) no han cambiado** con la
  migración. Describen el contenido, y el contenido es lo que da valor al repositorio.
- **El motor sí ha cambiado por completo (§2–§4).** Antes era un `<script>` copiado ocho veces;
  ahora es una aplicación Angular con una sola implementación de todo.

---

## 0. Estructura del repositorio

```
CURSOS/
├─ src/app/
│  ├─ core/          Modelos, acceso a datos, stores, servicios · sin UI
│  ├─ shared/        Componentes, directivas y tuberías reutilizables
│  ├─ layout/        Barra superior, menú lateral, telón
│  └─ features/      panel · curso · laboratorio · no-encontrado
├─ public/contenido/ El contenido, generado · un JSON por curso
├─ herramientas/     migrar-contenido.js (extrae y valida)
└─ legacy/           Los 8 HTML originales · fuente del contenido
```

Reglas de dependencia entre capas, en un solo sentido:

```
features ──► shared ──► core
```

`core` no importa de `shared` ni de `features`. `shared` no importa de `features`. Un feature no
importa de otro. Si te hace falta romperlo, lo que falta es una pieza en `core` o en `shared`.

Cursos existentes:

| Curso | Proyecto guía | Capítulos |
|---|---|---|
| `algoritmia` | **AlgoNaka**, playbook de patrones | 25 |
| `java` | **LibroTech**, gestión de librería | 25 |
| `react` | **CineNaka**, catálogo de cine | 25 |
| `python` | **NakaData**, plataforma de datos | 25 |
| `angular` | **NakaGym**, gestión de gimnasio | 24 |
| `ia` | **NakaDesk**, copiloto interno | 22 |
| `azure` | **NakaShop**, tienda online | 12 |

---

## 1. Principios pedagógicos (no negociables)

1. **Un solo proyecto continuo, no ejercicios sueltos.** Todo el curso construye un mismo producto
   con nombre propio (NakaShop, LibroTech). Cada capítulo añade una pieza y **reutiliza** todo lo
   anterior. Si un capítulo no aporta nada al proyecto, está mal planteado.
2. **Teoría y práctica en el mismo capítulo.** Primero *qué es, para qué sirve y por qué existe*;
   inmediatamente después, cómo se implementa en el proyecto.
3. **No dar nada por sabido.** Nivel de entrada = principiante absoluto. Los términos técnicos se
   explican la primera vez que aparecen y quedan recogidos en el glosario.
4. **Explicar el *por qué*, no sólo el *qué*.** Cada paso de una lista y cada parámetro de un
   comando lleva su justificación (`*Por qué:* …`, `**--name** · …`).
5. **Continuidad explícita.** Cada capítulo cierra con "qué acabamos de construir", "qué parte del
   proyecto representa" y "por qué era necesario antes de continuar", y adelanta la pieza siguiente.
6. **Verificable.** El alumno debe poder comprobar objetivamente que terminó el capítulo
   (`✅ Has terminado el capítulo si…`).
7. **Honestidad técnica.** Se avisa de costos, de lo que no tiene deshacer, de lo que queda fuera
   del alcance y de los atajos que en producción no se usarían.
8. **Español neutro, tuteo, tono directo.** Analogías cotidianas (la pizza para IaaS/PaaS/SaaS).
   Sin relleno, sin motivación vacía, sin "¡felicidades!".

---

## 2. El motor · qué te da ya hecho

Nada de esto se reimplementa por curso. Existe una sola vez y sirve para los siete:

| Pieza | Dónde |
|---|---|
| Progreso, capítulos completados, «Continuar», reinicio, copia de seguridad | `core/state/progreso.store.ts` |
| Catálogo, agrupación por módulos, totales | `core/state/catalogo.store.ts` |
| Carga del contenido y caché | `core/data/http-curso.repository.ts` |
| Buscador incremental con `<mark>`, atajo `/`, flechas y `Enter` | `core/services/busqueda.service.ts` + `shared/components/buscador` |
| Resaltado de sintaxis de 7 familias de lenguajes | `core/services/resaltador.service.ts` |
| Tema claro/oscuro persistente | `core/services/tema.service.ts` |
| Cabecera del capítulo, chips, progreso por acordeones, navegación ‹ › | `features/curso/capitulo` |
| Cabecera y botón *Copiar* de los bloques de código, autoevaluación desplegable | `shared/directives/contenido.directive.ts` |
| Menú lateral, telón en móvil, botón de volver arriba | `layout/` |

**Antes de escribir código nuevo, comprueba que no está ya aquí.** El motor legacy estaba duplicado
ocho veces; el objetivo de la migración fue precisamente que eso no vuelva a pasar.

---

## 3. Reglas técnicas de la aplicación

- **Componentes `standalone`, sin `NgModule`.** Angular 21.
- **`ChangeDetectionStrategy.OnPush` en todos los componentes**, y aplicación **zoneless**: la
  reactividad son *signals*, no Zone.js.
- **Nada de estado en variables sueltas.** Estado derivado = `computed`. Efectos secundarios =
  `effect`. Estado que se comparte = un store de `core/state/`.
- **Los parámetros de ruta llegan como `input()`** (`withComponentInputBinding`), no suscribiéndose
  a `ActivatedRoute`.
- **Rutas con almohadilla** (`withHashLocation`), para poder publicar el build en una carpeta
  estática sin reescrituras en el servidor.
- **Todo feature se carga con `loadChildren` / `loadComponent`.** El paquete inicial son ~97 kB
  transferidos; que siga siendo así.
- **Un servicio con estado de una pantalla se declara en `providers` de su ruta**, no en `root`
  (ver `CursoActualStore`): se destruye al salir y no arrastra el megabyte del curso anterior.
- **Los colores nunca se escriben literales en un componente.** Salen de los tokens de
  `src/styles.css`. El acento de cada curso lo pone el atributo `data-curso` del `<html>`.
- **Nombres en español**, como el resto del repositorio, salvo la API de Angular.
- **Comentarios que expliquen el porqué**, no el qué. El código ya dice lo que hace.

### Dónde van los estilos

- **`src/styles.css`** — tokens, reset, tipografía y **las clases del contenido** (`.note`, `.card`,
  `.code-block`, `.quiz`, `.diagram`, `.goal`…). Tienen que ser globales: el contenido entra por
  `[innerHTML]` y la encapsulación de vistas de Angular no lo alcanza.
- **`*.component.css`** — todo lo demás. Si el estilo es de un componente, va con el componente.

---

## 4. El contenido · de dónde sale y cómo se toca

El contenido no está en las plantillas. Vive en `public/contenido/<curso>.json`, y hoy se genera a
partir de los HTML de `legacy/`:

```
legacy/cursos/java.html  ──[ node herramientas/migrar-contenido.js ]──►  public/contenido/java.json
```

Cada capítulo del JSON es:

```json
{
  "num": 5,
  "titulo": "Herencia, polimorfismo y clases abstractas",
  "corto": "Herencia y polimorfismo",
  "modulo": "Módulo 2 · Programación orientada a objetos",
  "duracion": "65 min", "nivel": "Intermedio", "icono": "🧬",
  "conceptos": ["Herencia", "super", "Polimorfismo"],
  "objetivo": "<h3>🎯 Objetivo del capítulo</h3>…",
  "acordeones": [{ "id": "acc-0", "titulo": "📖 Teoría", "abiertoPorDefecto": true, "html": "…" }]
}
```

**Para tocar un capítulo:** edítalo en su HTML de `legacy/cursos/` y vuelve a ejecutar
`node herramientas/migrar-contenido.js`. El script valida lo extraído y falla si algo no cumple las
reglas de §5.

**Para añadir un curso nuevo:** créalo en `legacy/cursos/<tema>.html` copiando el más parecido
(`java.html` es la referencia), añade su entrada al array `CURSOS` de `legacy/index.html` y sus
colores `--b-<id>`, `--s-<id>`, `--c-<id>` a **`src/styles.css`** (más las variantes `-rgb` y la
regla `html[data-curso="<id>"]`). Después, `node herramientas/migrar-contenido.js`.

> El día que el contenido se edite directamente en los JSON, `legacy/` y `herramientas/`
> desaparecen y este apartado se queda en una línea. Mientras tanto, la fuente de la verdad del
> contenido es el HTML de `legacy/`.

**El contenido tiene que ser inerte.** Se inyecta con `[innerHTML]`, así que no puede llevar
`<script>`, manejadores `on*` ni enlaces `javascript:`. El validador lo comprueba.

---

## 5. Anatomía de un capítulo

Un capítulo son sus metadatos, una caja de objetivo y **exactamente ocho acordeones**. El progreso
del capítulo se calcula sobre ese ocho, así que no es negociable.

### Metadatos (todos obligatorios)

| Atributo | Uso |
|---|---|
| `data-num` | número del capítulo (0-based; el 0 es siempre preparación del entorno) |
| `data-title` | título largo, con el proyecto dentro |
| `data-short` | título corto para el menú y la navegación |
| `data-module` | `Módulo N · Nombre`; agrupa el menú. **Capítulos consecutivos del mismo módulo deben ir juntos** |
| `data-time` | `30 min`, `1 h 10 min` |
| `data-level` | `Principiante` / `Intermedio` / `Avanzado` (colorea el chip: lv1/lv2/lv3) |
| `data-icon` | un emoji |
| `data-concepts` | conceptos clave separados por `\|`; alimentan chips y buscador |

### La caja de objetivo

```html
<div class="goal">
  <h3>🎯 Objetivo del capítulo</h3>
  <p>Vas a entender …</p>
  <p><strong>Qué construimos hoy:</strong> …</p>
</div>
```

### Los 8 acordeones · siempre estos, siempre en este orden

| # | `summary` | Contenido |
|---|---|---|
| 1 | `📖 Teoría` (`open`) | `<h3>` numerados, analogías, `.diagram`, `.grid` de `.card`, `.note`. Cierra con **`<h3>Cómo se relaciona con el capítulo anterior</h3>`** |
| 2 | **Vía A de implementación** | `🖥 Implementación desde Azure Portal` / `💻 Implementación en LibroTech` |
| 3 | **Vía B de implementación** | `⌨ Implementación desde Azure CLI` / `⌨ Compilar, ejecutar y probar` |
| 4 | `✔ Verificación` | Cómo comprobar por las dos vías + `.note.good` con `✅ Has terminado el capítulo si…` |
| 5 | `🚀 Estado del proyecto` | *Qué acabamos de construir* · *Qué parte del proyecto representa* · `.diagram` del estado actual con `Siguiente pieza ▶ Capítulo N: …` · *Por qué era necesario antes de continuar* |
| 6 | `⚠ Errores comunes` | Tabla de 5–7 filas: **Problema** \| **Causa y solución** (con mensajes de error literales) |
| 7 | `📝 Resumen` | `ul.clean` de 5–7 ideas clave + `.note.good` "⭐ Buenas prácticas y recomendaciones" |
| 8 | `❓ Autoevaluación` | `.quiz` con **exactamente 5** `.q` (`.q-text` + `.q-ans`) |

Los dos acordeones de implementación son la única parte que cambia de nombre entre cursos: son
**las dos vías de hacer lo mismo** propias de la tecnología (GUI vs consola, código vs ejecución).
Elige el par al diseñar el curso y **mantenlo idéntico en todos los capítulos**.

Las preguntas de autoevaluación son de **aplicación, no de definición**: plantean un escenario
("tu job falla con este error, ¿qué falta?") y la respuesta explica el razonamiento completo.

---

## 6. Biblioteca de componentes de contenido

Estas clases están en `src/styles.css` y funcionan dentro del HTML de cualquier acordeón. **No
inventes componentes nuevos sin añadirlos ahí.**

| Clase | Para qué |
|---|---|
| `.note` | aviso neutro · `.note.tip` (violeta) · `.note.good` (verde) · `.note.warn` (ámbar) · `.note.bad` (rojo). Título con `<b class="t">` |
| `.code-block` + `data-lang` | bloque de código; la aplicación le añade cabecera, resaltado y botón *Copiar* |
| `.code-note` | explicación **inmediatamente después** de un bloque de código |
| `.diagram` | diagrama ASCII monoespaciado |
| `.grid.g2` / `.g3` / `.g4` + `.card` (`.tag`, `.svc`) | comparativas de conceptos |
| `ol.steps` | pasos numerados de una GUI, con círculos |
| `ul.clean` | listas con `▸` |
| `.tbl-wrap` + `<table>` | cualquier tabla (da scroll horizontal en móvil) |
| `.quiz` / `.q` / `.q-text` / `.q-ans` | autoevaluación |
| `.hint` / `.sol` | pistas progresivas y solución bajo demanda (laboratorios) |
| `.lab` + `data-lab` | hueco donde se monta un laboratorio de código |
| `h2.sec`, `.lead`, `.chip`, `.badge`, `.btn` | tipografía y controles |

### Reglas de los bloques de código

```html
<div class="code-block" data-lang="Azure CLI">
<pre><code>az group create \
  --name rg-nakashop-dev \
  --location eastus</code></pre>
</div>
<p class="code-note">
  <b>Qué hace:</b> crea el contenedor lógico del proyecto.<br>
  <b><code>--name</code></b> · el nombre del grupo; único dentro de la suscripción.<br>
  <b>Resultado esperado:</b> un JSON con <code>"provisioningState": "Succeeded"</code>.
</p>
```

- `<pre><code>` **pegado al margen izquierdo** (el `textContent` se copia tal cual).
- `data-lang` es descriptivo y puede incluir la ruta del archivo:
  `Java · com/librotech/model/Libro.java`, `YAML · .github/workflows/deploy.yml`, `Salida`,
  `Terminal`, `XML · pom.xml`. Decide además el perfil del resaltador (ver `REGLAS` en
  `resaltador.service.ts`): `Salida` y `Texto` no se colorean, y eso es deliberado.
- **Todo bloque de código va seguido de `.code-note`** con: *Qué hace*, cada flag/parámetro
  relevante, y *Resultado esperado*.
- `<` y `>` dentro de texto HTML (tablas, notas) van escapados: `&lt;sufijo&gt;`.

---

## 7. Datos del curso, más allá de los capítulos

| Dato | Qué es | Regla |
|---|---|---|
| `arquitectura` (`ARCH`) | Capas del proyecto, de abajo arriba. Cada nodo lleva el capítulo que lo construye | **Todo capítulo aporta ≥1 nodo** |
| `artefactos` (`RESOURCES`) | Tabla de artefactos: qué es, dónde vive, en qué capítulo | **Todo capítulo aporta ≥1 fila** |
| `glosario` | 40–60 términos, en orden de aparición en el curso | Cubre todo el vocabulario introducido |
| `chuleta` | 12–20 comandos o atajos transversales | Sirven en cualquier capítulo |
| `portada` | Héroe, 4 cifras y cuerpo libre | La primera cifra es el nº de capítulos |
| `estado` | Cabecera del panel del proyecto y convención de nombres | — |
| `laboratorios` (`LABS`) | Sólo `algoritmia` | Cada `data-lab` del contenido tiene su entrada |

---

## 8. Diseño del temario

- **Capítulo 0 = preparación del entorno** + plano del proyecto (incluye un `.diagram` con la tabla
  `CAPÍTULO → PIEZA QUE AÑADIMOS`). Siempre.
- **Último capítulo = entrega y cierre**: despliegue/CI-CD o arquitectura avanzada, y —si el curso
  cuesta dinero— **cómo borrarlo todo**.
- Progresión de dificultad reflejada en `data-level`: `Principiante` en el primer tercio,
  `Intermedio` en el segundo, `Avanzado` al final.
- Módulos de 2–5 capítulos con nombre temático (`Módulo 1 · Fundamentos`, `Módulo 4 · Datos`…).
- Rango recomendado: **12 capítulos** (curso corto, ~9 h) a **25 capítulos** (curso completo, ~30 h).
- Un capítulo = 40–75 min de estudio.

### Volumen esperado

| Métrica | Curso corto (azure) | Curso completo (java) |
|---|---|---|
| Líneas de contenido por capítulo | ~500 | ~750 |
| Bloques de código por capítulo | ~10 | ~17 |
| Preguntas de autoevaluación | 5 por capítulo | 5 por capítulo |
| Diagramas ASCII | ~2–3 por capítulo | ~2 por capítulo |
| Entradas de glosario | 51 | 58 |

Un capítulo muy por debajo de esto está incompleto: falta teoría, faltan errores comunes o falta el
*por qué* de los comandos.

---

## 9. Checklist antes de dar algo por terminado

### Contenido

- [ ] `node herramientas/migrar-contenido.js` termina en `✓` y sin avisos que importen.
- [ ] Los 8 acordeones existen en **todos** los capítulos, con los mismos títulos y en el mismo orden.
- [ ] Cada capítulo tiene ≥1 nodo en `ARCH` y ≥1 fila en `RESOURCES`.
- [ ] Cada `.code-block` tiene `data-lang` y va seguido de `.code-note`.
- [ ] Verificación de cada capítulo termina en `.note.good` con `✅ Has terminado el capítulo si…`.
- [ ] Teoría de cada capítulo cierra con "Cómo se relaciona con el capítulo anterior".
- [ ] Estado del proyecto de cada capítulo adelanta la pieza siguiente.
- [ ] Glosario y chuleta cubren todo el vocabulario introducido.
- [ ] Todos los términos técnicos se explican la primera vez que aparecen.

### Aplicación

- [ ] `npm test` en verde.
- [ ] `npm run build` sin errores ni avisos, y el paquete inicial sigue por debajo de los 500 kB.
- [ ] Ningún componente sin `OnPush`; ningún servicio con estado de pantalla en `root`.
- [ ] Ningún color literal fuera de `src/styles.css`.
- [ ] Tema claro **y** oscuro revisados: nada ilegible.
- [ ] Responsive a 900 px y 620 px: menú lateral, rejillas, tablas y diagramas con scroll.
- [ ] El buscador encuentra términos del primer y del último capítulo.
- [ ] Reiniciar el progreso deja la aplicación limpia.
