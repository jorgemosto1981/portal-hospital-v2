# RFC — Escalabilidad de lectura en bandeja jefe (retiro de `SCAN_LIMIT`)

**Estado:** propuesta · sin implementar · **2026-07-31**
**Ámbito:** `listarSolicitudesBandejaJefe` (lectura). No cambia estados, Rules ni el acto de decisión.
**Relacionado:** [`RFC_TICKETERA_AUTORIZACION_TOMA_CONOCIMIENTO_V2.md`](./RFC_TICKETERA_AUTORIZACION_TOMA_CONOCIMIENTO_V2.md) (cadena de autorización, snapshot A2) · [`RFC_SOLICITUD_GRUPOS_TRABAJO_INVOLUCRADOS_V2.md`](./RFC_SOLICITUD_GRUPOS_TRABAJO_INVOLUCRADOS_V2.md) (precedente `array-contains`) · [`SOLICITUD_ARTICULO_AUTORIZACION_CAMPOS_V2.md`](./SOLICITUD_ARTICULO_AUTORIZACION_CAMPOS_V2.md)

---

## 1. Problema

`listarSolicitudesBandejaJefe` resuelve la visibilidad **después** de leer, no en la query.

La rama de pendientes pide **todas** las solicitudes en revisión del hospital (`estado_solicitud_id == cfg_esa_en_revision_jefe`), sin filtro por jefe, con `.limit(SCAN_LIMIT)` donde `SCAN_LIMIT = 400`. Recién ahí, documento por documento y **en serie**, llama a `revisorVeSolicitudEnBandejaJefe` → `resolverCadenaAutorizacion`, que no tiene caché.

Costo por solicitud evaluada:

| Paso | Ops Firestore |
|------|----------------|
| `loadHlgRowsPorPersona(titular)` | 1 query |
| `loadHlgRowsPorGrupo(ancla)` | 1 query |
| Por cada nivel de escalamiento (hasta `MAX_DEPTH_ESCALAMIENTO = 10`) | 1 query + 1 `get` |

Piso de **2 queries por solicitud**, hasta ~22 con escalamiento profundo, todas secuenciales. Con la ventana llena son entre 800 y varios miles de round trips para pintar una página de 10 ítems.

Consecuencias, en orden de gravedad:

1. **Costo O(pendientes del hospital)** para mostrar el trabajo de **un** jefe.
2. **Latencia** creciente con la actividad global, con riesgo de timeout del callable. `SCAN_LIMIT` no es un parámetro de negocio: es el parche que evita esto.
3. **Truncado sobre el eje equivocado.** La query no lleva `orderBy`, y Firestore ordena por defecto por ID de documento ascendente. Como los ids son `sol_<ULID>` y el ULID es lexicográficamente ordenable por timestamp, el recorte conserva de forma **determinística las 400 pendientes más antiguas por fecha de alta**. El problema es que la bandeja ordena y pagina por **`fecha_desde`**, que es otro eje: una solicitud creada hoy para una licencia próxima puede quedar fuera del recorte aunque debiera aparecer primera en la página. No es pérdida impredecible, es un sesgo predecible contra las altas recientes.

> **Nota de revisión (2026-07-31):** una versión previa de este RFC describía (3) como “resultado no determinístico / pérdida silenciosa”. Es incorrecto: el orden por defecto de Firestore es por `__name__` ascendente ([doc oficial](https://firebase.google.com/docs/firestore/query-data/order-limit-data)) y con ids ULID eso equivale a orden cronológico de alta. El recorte es determinístico; lo que está mal es que el eje de truncado (alta) no coincide con el de presentación (`fecha_desde`). Esto **baja** la urgencia de N2 y refuerza a N1 como primer paso.

Las ramas de historial (`aprobados_por_mi` / `rechazados_por_mi`) **sí** filtran por `jefe_revision_persona_id == revisor`, por lo que solo heredan los problemas de orden y paginación, no el de costo.

---

## 2. Por qué hoy no se usa el snapshot

El doc `sol_*` ya persiste desde el trigger de alta (`buildAutorizacionSnapshotFields`):

`autorizadores_elegibles_ids[]` · `grupo_autorizacion_id` · `escalamiento_jerarquico_ids[]` · `autorizacion_rrhh_sustituta`

La bandeja RRHH y `revisorPuedeAutorizarJerarquico` ya lo leen directo. La bandeja jefe **deliberadamente lo ignora** y recalcula en vivo, para contemplar que la jerarquía (HLg) haya cambiado después del alta.

Ese requisito es legítimo, pero hoy se paga en el camino más caliente (listar) cuando el punto donde realmente importa es el acto de decidir — y ahí ya está cubierto: `resolverDecisionJefeSolicitud` llama a `revalidarRevisorEnAutorizadores`, que recalcula en vivo y corta con `PERMISOS_JERARQUICOS_CAMBIADOS`.

---

## 3. Propuesta

Tres niveles independientes, aplicables en orden.

### N1 — Memoizar y paralelizar (interno, sin cambio de contrato)

- Caché por invocación de `loadHlgRowsPorGrupo` y `loadHlgRowsPorPersona`.
- Caché de la cadena completa con clave `titular|ancla|fecha`.
- Resolver los documentos con **concurrencia acotada** (p. ej. 10) en vez de `for...of` secuencial.

Muchas solicitudes pendientes comparten grupo ancla y fecha, así que las queries HLg repetidas colapsan de cientos a decenas. No cambia ningún resultado observable; solo tiempo y costo. Es reversible y no requiere índices ni migración.

### N2 — Filtrar por el jefe en Firestore (núcleo del RFC)

Reemplazar el escaneo global por:

```
where estado_solicitud_id == cfg_esa_en_revision_jefe
where autorizadores_elegibles_ids array-contains <revisorPersonaId>
[where fecha_desde >= min] [where fecha_desde <= max]
orderBy fecha_desde
startAfter <cursor>  limit <page_size>
```

- El costo pasa a ser proporcional al trabajo **de ese jefe**.
- `SCAN_LIMIT` se elimina por innecesario.
- La paginación deja de ser un `slice` en memoria (`paginarBandejaOrdenada`) y pasa a cursor real de Firestore. El orden se vuelve determinístico.
- Las huérfanas siguen fuera de la bandeja jefe sin código extra: `autorizacion_rrhh_sustituta: true` implica `autorizadores_elegibles_ids: []`, así que nunca matchean.

**Exactitud:** sobre los ≤10 documentos de la página ya recortada, mantener `resolverCadenaAutorizacion` en vivo. Costo fijo por página, independiente del volumen, conservando la semántica actual para el caso "perdió el permiso".

Índices nuevos (`firebase-v2/firestore.indexes.json`), siguiendo el precedente de `grupos_trabajo_involucrados_ids`:

```json
{
  "collectionGroup": "solicitudes_articulo",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "autorizadores_elegibles_ids", "arrayConfig": "CONTAINS" },
    { "fieldPath": "estado_solicitud_id", "order": "ASCENDING" },
    { "fieldPath": "fecha_desde", "order": "ASCENDING" }
  ]
},
{
  "collectionGroup": "solicitudes_articulo",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "jefe_revision_persona_id", "order": "ASCENDING" },
    { "fieldPath": "estado_solicitud_id", "order": "ASCENDING" },
    { "fieldPath": "fecha_desde", "order": "ASCENDING" }
  ]
}
```

### N3 — Refrescar el snapshot ante cambios de jerarquía

N2 deja un hueco: un jefe que **gana** permiso después del alta no aparece en `autorizadores_elegibles_ids` y por lo tanto no vería el trámite. Hoy el recálculo en vivo lo cubre.

Cierre propuesto: recalcular y reescribir el snapshot de las solicitudes en `en_revision_jefe` cuando cambia el HLg o la estructura de GDT que las afecta. Hay precedente de resolución de cadena fuera del alta en `calcularJefesPendientesConocimientoPaseGdt`. Alternativa de menor esfuerzo: barrido programado sobre `en_revision_jefe` (volumen acotado por definición).

**N2 no debería desplegarse sin N3** o sin aceptar explícitamente el hueco.

---

## 4. Impacto

| Capa | Impacto |
|------|---------|
| Estados / máquina de trámite | Ninguno |
| Firestore Rules | Ninguno (callable con admin) |
| Schema `sol_*` | Ninguno campo nuevo; N3 reescribe campos existentes |
| Índices | 2 nuevos (N2) |
| Contrato callable | `page_info` se mantiene; ver §5 sobre `total_filtrado` |
| UI | Sin cambios (`useBandejaJefeSolicitudes` ya pagina de a 10 por cursor) |

---

## 5. Puntos abiertos

Investigados el 2026-07-31. Estado: **R** resuelto · **A** abierto.

### 5.1 `total_filtrado` — R (decisión de producto pendiente)

Hoy sale de contar el arreglo completo en memoria; con cursores reales no hay total exacto gratis. `firebase-admin ^13.6.0` **sí** soporta la agregación `count()`, que resuelve el "N de M" con una query aparte y barata. No hay uso previo de `count()` en el repo, sería el primero. Alternativas sin costo extra: mostrar solo "cargados N" o dejar `total_filtrado: null`.

### 5.2 Filtro `usuario` (Nombre) — R (con costo)

**No** se puede empujar a la query. `personas` no tiene campo de nombre normalizado y Firestore no hace búsqueda por substring (solo prefijo, sobre un campo indexado). El precedente del repo, `buscarPersonasCheckinRrhh`, resuelve el mismo problema **con el mismo patrón**: escanea 450 docs de `personas` ordenados por id y filtra `includes()` en memoria, devolviendo un flag `truncado`.

Opciones, en orden de preferencia:

| Opción | Qué implica |
|--------|-------------|
| **(b) Paginación consciente del filtro** | Mantener el post-filtro pero iterar páginas por cursor hasta llenar la página pedida o agotar el stream. Sin cambio de schema. Costo proporcional a las coincidencias. **Recomendada.** |
| (a) Resolver Nombre → `titular_persona_id in [...]` | Reusa el patrón de `dni`, pero la resolución sigue siendo un escaneo de `personas` y topea en 30 valores (ver 5.3). |
| (c) Campo normalizado en `personas` | Habilita prefijo real, pero es cambio de schema + backfill, y **no** cubre substring (“loko” no matchea “Lokito” salvo por prefijo). RFC aparte. |

### 5.3 `array-contains` + `in` — R (viable, con tope)

Verificado en la [doc oficial](https://firebase.google.com/docs/firestore/query-data/queries): la restricción es *"at most one `array-contains` clause per disjunction"* y *"can't combine `array-contains` with `array-contains-any`"*. Combinar `array-contains` con un `in` **sobre otro campo** es válido. El límite real es de **30 disyunciones en forma normal disyuntiva**, así que `titular_persona_id in [...]` no puede exceder 30 valores. Para `dni` alcanza de sobra (`resolverPersonaIdsPorDni` ya usa `.limit(5)`); para Nombre no es suficiente, lo que refuerza la opción (b) de 5.2.

### 5.4 Backfill del snapshot — A

Sigue abierto: hay que confirmar que no queden `sol_*` en `en_revision_jefe` anteriores al snapshot A2 sin `autorizadores_elegibles_ids`. Requiere script de auditoría de solo lectura contra `-dev` y prod antes de activar N2.

### 5.5 Ventana activa — A

`fecha_desde_min/max` pasa de filtro en memoria a rango en la query. Con rango sobre `fecha_desde` el primer `orderBy` debe ser ese mismo campo, lo cual coincide con el orden deseado. Validar contra `periodosVentanaJefe()`.

---

## 6. Secuencia recomendada

Con 5.1–5.3 resueltos y el diagnóstico de §1 corregido:

1. **N1 ahora.** Es el que ataca el problema dominante real (costo y latencia), es reversible y no toca contrato, índices ni datos.
2. **Arreglo puntual del eje de truncado.** Mientras N2 no exista, agregar `orderBy("fecha_desde")` a la query de pendientes alinea el recorte con el eje de presentación. Requiere índice `(estado_solicitud_id ASC, fecha_desde ASC)`. Cambia el sesgo de "altas recientes" a "licencias más lejanas", que es el correcto para una cola que se procesa por fecha de licencia.
3. **N2 + N3 juntos**, con 5.4 cerrado previamente y la opción (b) de 5.2 implementada.

**Advertencia de reuso:** el código de N1 es en buena medida *descartable* si N2 aterriza, porque la revalidación en vivo pasaría a correr sobre ≤10 documentos por página, donde el caché por invocación aporta poco. Se justifica igual por el alivio inmediato y el bajo riesgo, no como escalón hacia N2.

### 6.1 Estado de implementación (2026-07-31, rama `develop`, entorno `-dev`)

Aprobado y aplicado el paso 1 + paso 2. N2 y N3 quedan **en stand-by** pendientes de 5.4.

| Pieza | Archivo | Nota |
|-------|---------|------|
| Caché por invocación | `functions/modules/shared/solicitudAutorizacionCache.js` (nuevo) | 4 mapas: `hlgPorPersona`, `hlgPorGrupo`, `grupoTrabajo`, `cadena`. Memoiza la **promesa**, no el valor, para deduplicar llamadas concurrentes sobre la misma clave. |
| Concurrencia acotada | `functions/modules/shared/asyncMapLimite.js` (nuevo) | `map` asíncrono con tope de tareas en vuelo, preserva el orden de entrada. |
| Enhebrado del caché | `functions/modules/shared/solicitudAutorizacionJerarquicaCore.js` | `cache` es un parámetro **opcional** en `resolverCadenaAutorizacion`, `resolverAutorizadoresElegiblesEnGrupo`, `escalarGrupoPadre` y `loadGrupoTrabajo`. Sin él, el comportamiento es idéntico al anterior: ningún otro consumidor cambia. |
| Uso en la bandeja | `functions/modules/shared/solicitudBandejaJefeCore.js` | Un caché por llamada al callable; filtros baratos separados en `pasaFiltrosBaratos()` antes de gastar lecturas; resolución del lote con `CONCURRENCIA_RESOLUCION = 10`. |
| `orderBy("fecha_desde")` | idem | En ambas ramas: pendientes e historial. |
| Índices | `firebase-v2/firestore.indexes.json` | `(estado_solicitud_id, fecha_desde)` y `(jefe_revision_persona_id, estado_solicitud_id, fecha_desde)`. Desplegados en `-dev`, estado `READY`. |
| Tests | `functions/test/asyncMapLimiteYCacheAutorizacion.test.js` (nuevo) | Orden preservado, tope de concurrencia, deduplicación en vuelo, no cachear errores. |

Puntos a tener presentes:

- **El resultado memoizado se comparte** entre llamadas. Los consumidores deben tratar la cadena devuelta como inmutable; hoy ninguno la muta.
- **`orderBy` filtra por existencia del campo.** Los `sol_*` sin `fecha_desde` válida quedan fuera de la query, pero ya quedaban fuera antes por la guarda en memoria (`/^\d{4}-\d{2}-\d{2}$/`), así que el conjunto efectivo no cambia.
- `paginarBandejaOrdenada` y el orden final en memoria no se tocaron: el `orderBy` sólo alinea **qué** 400 documentos entran al lote.

Pendiente de medición: latencia y lecturas por invocación en `-dev` contra la línea de base, para cuantificar el alivio.

---

## 7. Fuera de alcance

- Bandejas RRHH, auditoría médica y junta (misma familia de problema; se tratan aparte si N2 prospera).
- Cambiar la semántica de quién autoriza (`resolverCadenaAutorizacion` no se toca).
- Deploy a producción: primero `-dev`, con acta.
