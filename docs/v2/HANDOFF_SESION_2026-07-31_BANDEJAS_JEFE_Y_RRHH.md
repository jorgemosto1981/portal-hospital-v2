# Handoff — Bandejas de jefe y RRHH + Art. 64 config-driven

**Fecha pausa de sesión:** 2026-07-31 ~11:10 ART  
**Cierre de foco del proyecto:** 2026-08-21 → [`CIERRE_PAUSA_PROYECTO_2026-08-21.md`](./CIERRE_PAUSA_PROYECTO_2026-08-21.md)  
**Rama:** `develop` @ `642c9ba` (incluye este handoff) — **commiteado y pusheado**  
**Sesión anterior:** [`HANDOFF_ART64_PROD_2026-07-30.md`](./HANDOFF_ART64_PROD_2026-07-30.md)

---

## Resumen ejecutivo

Sesión larga con tres bloques encadenados:

1. **Bandeja del jefe** — reforma visual ("Bandeja de Evaluación") y N1 de escalabilidad de lectura.
2. **Art. 64** — la modalidad y los saldos dejan de ser hardcode y salen de cfg; etiquetas neutras mientras jefatura no decide.
3. **Bandeja RRHH** — detalle legible, trazabilidad de la resolución, veredicto del motor bajo demanda y filtros que cubren todo el catálogo de estados.

El **429 de prod** que bloqueaba la sesión anterior **se destrabó solo** (era cuarentena Cloud Run/GFE, no un bug). Todo quedó desplegado en dev y prod.

---

## 1. Bandeja del jefe — reforma visual

Commit `f2496f0`.

La bandeja le mostraba al jefe un volcado técnico del documento. Se separó en dos vistas:

- `EXPAND_FILAS_TECNICAS` — base para RRHH, auditoría médica y junta (ids, catálogos, patrón de saldo).
- `EXPAND_FILAS_JEFE` — solo lo que necesita para decidir. Sin ids, sin códigos de catálogo, sin patrón de saldo.

Cambios concretos:

| Antes | Ahora |
|---|---|
| "Bandeja — revisión jefe" | "Bandeja de Evaluación" |
| Sin descripción | "Evaluá las solicitudes de los agentes a tu cargo y decidí si las autorizás o las rechazás." |
| "Etiqueta artículo" | "Solicitud" |
| Grupo ancla por id | Nombre del grupo (`grupo_trabajo_ancla_label`, resuelto en backend con caché) |
| `sol_id` visible en el chip colapsado | Oculto para el jefe, visible para RRHH |
| "Estado / vista", "Usuario (nombre o DNI)" | "Estados", "Nombre"; bloque de filtros más compacto |
| Modalidad 64 con `con_goce` por defecto | Arranca vacío: "Seleccione modalidad del Artículo 64" |
| Motivo siempre visible y opcional | Solo aparece en 64-B sin goce, toma de conocimiento o rechazo, y ahí es obligatorio |

Se eliminó la línea "Si elegís 64-B sin goce: justificativo obligatorio y doble confirmación."

**Paginación:** ya existía (10 por página, cursor real, lazy load). No se tocó.

---

## 2. Escalabilidad de lectura de la bandeja del jefe (N1)

RFC: [`RFC_BANDEJA_JEFE_ESCALABILIDAD_LECTURA_V2.md`](./RFC_BANDEJA_JEFE_ESCALABILIDAD_LECTURA_V2.md)

### Diagnóstico

`listarSolicitudesBandejaJefe` escanea hasta `SCAN_LIMIT = 400` documentos y resuelve la cadena de autorización **por fila**, en serie.

Corrección importante sobre el diagnóstico inicial: el truncado **no era aleatorio**. Como los ids son ULID y Firestore ordena por `__name__` cuando no hay `orderBy`, el recorte era determinístico pero **sobre el eje equivocado**: cortaba por fecha de alta, no por `fecha_desde`, que es lo que el jefe ve ordenado en pantalla. El sesgo golpeaba a las licencias futuras cargadas recientemente.

### Aplicado (aprobado explícitamente)

- **Memoización + concurrencia acotada** (`CONCURRENCIA_RESOLUCION = 10`):
  - `functions/modules/shared/asyncMapLimite.js` — `map` async con límite, preserva orden.
  - `functions/modules/shared/solicitudAutorizacionCache.js` — cachés por invocación (`hlgPorPersona`, `hlgPorGrupo`, `grupoTrabajo`, `cadena`). Memoiza **la promesa**, no el valor: dos llamadas concurrentes comparten un solo viaje a Firestore, y si falla se libera la clave para no cachear el error.
  - Tests: `functions/test/asyncMapLimiteYCacheAutorizacion.test.js`.
- **`orderBy("fecha_desde")`** en las queries de pendientes e histórico, para que el truncado caiga sobre el mismo eje que se muestra.
- **Índices compuestos** desplegados y verificados en estado READY (`firebase-v2/firestore.indexes.json`):
  - `solicitudes_articulo (estado_solicitud_id ASC, fecha_desde ASC)`
  - `solicitudes_articulo (jefe_revision_persona_id ASC, estado_solicitud_id ASC, fecha_desde ASC)`

**Deuda consciente:** la memoización de N1 es un paliativo. Cuando entre N2 (query filtrada + cursores de Firestore) pierde sentido y se retira. Está anotado en el RFC.

### Auditoría de snapshots (cierre del punto 5.4 del RFC)

Script: `scripts/seed-v2/auditar-snapshot-autorizadores.mjs`. Commit `757ca04`.

Resultado en prod:

- **Ningún** `sol_*` en `en_revision_jefe` carece de `autorizadores_elegibles_ids`. El miedo al backfill no tenía sustento.
- Aparecieron **2 documentos** con `autorizadores_elegibles_ids` vacío pero `autorizacion_rrhh_sustituta = true`. Es un estado de negocio válido: la escalación se agotó sin autorizador elegible y RRHH sustituye.

**Consecuencia:** N3 (refrescar snapshots ante cambios de jerarquía) **no es opcional** y va **antes** que N2. Si no, un jefe que adquiere permisos después del alta no ve el trámite. El RFC quedó reordenado con esa prioridad.

---

## 3. Art. 64 — modalidad y saldos desde cfg

Commits `2c592b3`, `610d24e`, `bf5d365`, `71682a4`.

### El problema

La UI del jefe tenía "64-A" y "64-B" hardcodeados. Con los pares de ½ carga eso es directamente incorrecto: el escalafón define qué par le toca a cada agente.

### Backend

- `itemListaBandejaJefe` ahora emite el par resuelto: `articulo_familia_64`, `articulo_id_con_goce` / `_sin_goce` y sus códigos y nombres. Prioriza el snapshot del alta; solo cae a cfg si falta.
- **Callable nuevo** `obtenerResumenSaldoFamilia64Jefe` — saldo del titular para que el jefe decida con información. Expone datos de un tercero, así que la compuerta reusa `revisorVeSolicitudEnBandejaJefe`, la misma regla que decide qué ve en su bandeja.
- La validación bloqueante de saldo **ya existía** en `aplicarModalidad64EnTx` (`SALDO_64B_INSUFICIENTE`), incluido el retorno de días a la bolsa con goce al cruzar. **No se duplicó**: el front solo evita el intento y muestra el mismo mensaje.

### Front

- `useSaldoFamilia64Jefe` + `Familia64SaldoJefe` — carga **bajo demanda** con un botón "Ver saldo disponible". No suma lecturas por fila.
- El select de modalidad se arma con los códigos reales del par.
- Aprobar queda deshabilitado si el cruce a sin goce no tiene saldo.

### Saldo "previo" al trámite

El alta ya reserva los días de la bolsa con goce, así que el jefe veía 4 días para un pedido de 1 sobre un saldo de 5. No estaba mal, pero confundía. El callable ahora devuelve `con_goce_disponible_previo` / `sin_goce_disponible_previo`, que suman de vuelta los días reservados por **este** trámite. El texto quedó: *"Total disponible, sin contar la reserva de este trámite. Si aprobás la solicitud se descuentan N días de la modalidad que elijas."*

### Etiquetas neutras de la familia 64

El nombre en cfg trae la modalidad ("ASUNTOS PARTICULARES **CON GOCE DE HABERES**") y el código la letra ("64**-A**"). Mostrarlas antes de que jefatura decida adelanta una decisión que no se tomó.

`shared/utils/familia64Chip.js` (+ test) saca:
- el sufijo de modalidad del nombre,
- la letra del código,
- el calificador del par entre paréntesis ("(Personal ½ carga)"), porque el escalafón ya define cuál le toca y solo alarga la etiqueta.

Se aplica en el chip de alta del agente y en las bandejas de jefe y RRHH, siempre **condicionado** a que la modalidad no esté decidida. Una vez resuelta se muestra el artículo real.

### Incidente: "no veo el chip 64 en prod con Lokito"

Dos causas, ninguna era un bug del circuito:

1. **Lokito en prod y en dev son personas distintas.** Prod `per_01KQQJA5Q1VKBTJ74RHQ0HSHSB` es `CFG_ESC_01_PROFESIONAL` (½ carga); dev `per_01KXK214PYGN9W38CZR4SMV3XW` es `CFG_ESC_02_ADMINISTRACION`. El sistema hacía lo correcto, mostraba el par de ½ carga.
2. **Lokito en prod no tenía check-in de bolsas Art. 64** para el ciclo. Se hizo durante la sesión.

De ahí salió la decisión de neutralizar la etiqueta en **todos** los pares, no solo el ADMIN.

---

## 4. Bandeja RRHH

Commit `2803b59`. Ruta: `/portal/rrhh/solicitudes-articulo` — menú **Funciones RRHH → "Bandeja solic."**

Ojo: hay **dos** ítems de menú con la etiqueta "Bandeja solic.", uno bajo ROL JEFE y otro bajo Funciones RRHH.

### Dónde caen los trámites del jefe

| Decisión del jefe | Estado | ¿La ve RRHH de entrada? |
|---|---|---|
| Aprueba con goce | `cfg_esa_aprobada` | Sí, como toma de conocimiento pendiente |
| Aprueba sin goce | `cfg_esa_aprobada` (mismo estado) | Sí, ídem |
| Rechaza | `cfg_esa_rechazada` | No en la vista por defecto; hay que ir a "Rechazadas" o "Todas" |

Con goce y sin goce terminan en el **mismo estado**. Lo que cambia es el documento: el cruce reescribe `articulo_id` y `codigo_grilla` al artículo sin goce.

### Detalle podado

Se sacaron: estado de catálogo, ID artículo, código grilla, nombre artículo, patrón de saldo, ID titular y modo bandeja RRHH. Se resolvieron a nombre: grupo de trabajo, autorizadores elegibles y jefe que cerró (con fallback al id si el grupo no tiene nombre, para no perder trazabilidad).

"Etiqueta artículo" pasó a llamarse **"Solicitud"**, por coherencia con la bandeja del jefe. *Es el único cambio que no se pidió explícitamente; se puede revertir.*

"Motivo (opcional)" → **"Detalles (opcional)"**. Cuando el motor registró advertencias sigue diciendo "Notas de RRHH", que es cuando el campo cambia de sentido.

### Trazabilidad de la resolución

`functions/modules/shared/solicitudTrazabilidadResolucion.js` + `web/src/features/solicitudes/BandejaRrhhTrazabilidad.jsx`.

Se arma con lo que ya guarda el documento, **sin tocar `eventos_ticket`**. Aparece solo si hay algo que contar:

- **Cruce de modalidad** (`cruce_modalidad_64`): "Jefatura resolvió sin goce: el trámite pasó de 64-A a 64-B", con los días movidos entre bolsas. Sin esto RRHH veía un 64-B sin forma de saber que nació como 64-A.
- **Derivación a Art. 77-0** (`art_77_0_derivada_id`): botón para saltar al trámite derivado, y desde el 77-0 el camino de vuelta al rechazo que lo originó (`origen_rechazo_sol_id`). El salto filtra por DNI del titular y vista "Todas", porque el relacionado casi siempre está en otro estado.
- **Derivación fallida** (`art_77_0_derivacion_pendiente`): aviso en rojo con el código de error. Ese caso hoy quedaba invisible y significa que la inasistencia **no** se registró.

**Nota:** `modalidad_goce_jefe` sigue sin viajar al ítem de RRHH. La modalidad se infiere del artículo final y del motivo de jefatura, que en sin goce es obligatorio. Si se quiere el dato explícito, hay que agregarlo al ítem del backend y una fila al detalle.

### Veredicto del motor bajo demanda

El `motor_snapshot` viajaba completo para las diez filas de cada página aunque nadie lo mirara.

- Salió del listado. Ahora van solo dos flags: `motor_tiene_veredicto` y `motor_tiene_advertencias`.
- **Callable nuevo** `obtenerVeredictoMotorSolicitudRrhh` — trae el snapshot de a uno al desplegar el bloque.
- `shared/utils/motorSnapshotFlags.js` (sincronizado a functions) es ahora la única fuente de `esSnapshotMotorV2` / `snapshotTieneAdvertencias`; `laoAuditoriaDisplayUtils.js` los re-exporta.
- El **aviso de advertencias queda siempre visible**, plegado o no: es el motivo para abrir el bloque. Lo que se difiere es el detalle pesado.

### Filtros por estado — cobertura completa

Faltaban **tres estados del catálogo**: `pendiente_clasificacion_medica`, `esperando_dictamen_junta` y `aprobada_pendiente_aplicacion`. No estaban en ninguna vista ni en la query, así que esos trámites eran invisibles incluso en "Todos". También se les dio etiqueta legible, igual que a "Rechazada", que antes mostraba el id crudo del catálogo.

Se agregó `ESTADO_SOLICITUD_ESPERANDO_DICTAMEN_JUNTA` a `solicitudesArticuloEstados.js`; vivía como literal suelto en seis archivos.

Selector agrupado con `optgroup`:

| Grupo | Vistas |
|---|---|
| Pendiente de RRHH | lo que espera una acción mía · TC pendiente · **huérfanas** · legacy |
| Seguimiento por estado | en jefatura · **circuito médico** · aprobadas · pendientes de aplicación · con TC registrada · rechazadas |
| Sin filtrar | todas las presentadas |

Dos vistas nuevas: **huérfanas** (cierre sustituto RRHH, antes mezcladas dentro de "pendientes" sin forma de aislarlas) y **circuito médico**.

`estadosQueryPorVista` hace que **cada vista consulte solo sus estados**. Antes casi todas traían el mismo bloque de tres y descartaban en memoria, lo que le comía lugar al tope de escaneo de 400. El borrador queda afuera a propósito: no salió del agente.

### Chips

Nombre y DNI pasaron a cuerpo grande; el `sol_id` bajó a su propio renglón chico en itálica. Se eliminó el prop `variant` de `BandejaSolicitudResumenFilas`: la jerarquía grande quedó de base para todas las bandejas, así que auditoría médica y junta también la heredan.

---

## Estado de despliegue

| Capa | dev (`portal-hospital-v2-dev`) | prod (`portal-hospital-v2`) |
|---|---|---|
| Functions | Listo | Listo |
| Hosting | https://portal-hospital-v2-dev.web.app | https://portal-hospital-v2.web.app |
| Índices Firestore | READY | READY |

Functions desplegadas de forma **selectiva** (`--only functions:nombre,...`).

Callables nuevos de la sesión, ambos con `run.invoker` para `allUsers` verificado en los dos proyectos:

- `obtenerResumenSaldoFamilia64Jefe`
- `obtenerVeredictoMotorSolicitudRrhh`

> **No correr `firebase deploy --only functions` completo.** Aborta porque `listarColeccionesCfgBatch` existe en remoto y no en el código local. Sigue sin resolverse desde la sesión anterior.

---

## Commits de la sesión (`develop`)

| Hash | Mensaje |
|---|---|
| `f2496f0` | feat(bandeja-jefe): vista de evaluacion sin datos tecnicos y lectura acotada (N1) |
| `2c592b3` | feat(art64): resolver la modalidad 64 desde cfg y mostrar saldo al jefe |
| `610d24e` | fix(art64): quitar la modalidad de la etiqueta en todos los pares 64 |
| `bf5d365` | fix(art64): sacar el calificador del par de la etiqueta del chip |
| `71682a4` | fix(bandeja-jefe): neutralizar tambien el codigo del articulo 64 sin decidir |
| `757ca04` | docs(rfc-bandeja-jefe): cerrar 5.4 con auditoria y poner N3 antes que N2 |
| `2803b59` | feat(bandeja-rrhh): detalle legible, trazabilidad de resolucion y filtros completos |

---

## Pendientes

### Prioritario

1. **N3 del RFC antes que N2.** La auditoría mostró casos reales de `autorizacion_rrhh_sustituta = true`. Sin refrescar snapshots ante cambios de jerarquía, N2 abre un bache de visibilidad.
2. **Verificación funcional en prod** de la bandeja RRHH. Las vistas "huérfanas" y "circuito médico" van a salir vacías si no hay trámites en esos estados: eso es correcto, no una falla.

### Conocido, no bloqueante

3. **Test obsoleto** `modoListadoArticulosIngreso` ("mvp por defecto") falla: `ARTICULO_IDS_MVP` está vacío, así que `modoListadoArticulosIngreso()` devuelve `"catalogo"` y el test espera `"mvp"` de una configuración vieja. **No es una regresión.** Suite: 598/599.
4. **`listarColeccionesCfgBatch`** en remoto sin código local — decidir si se borra o se reincorpora.
5. **`docs/v2/seeds/p4_art1619/ART16_19_P44_SPECS.json`** quedó modificado **sin commitear** (60 inserciones / 30 borrados). Viene de antes de esta sesión y es de otra línea de trabajo; se dejó fuera a propósito. **No se sincroniza a la otra PC.**
6. **`modalidad_goce_jefe` no llega a RRHH** — ver sección de trazabilidad.
7. Renombre de "Etiqueta artículo" a "Solicitud" en RRHH: no se pidió explícitamente, revisar si se conserva.

---

## Retomar desde otra PC

```bash
git clone https://github.com/jorgemosto1981/portal-hospital-v2.git
cd portal-hospital-v2
git checkout develop
git pull

npm install
npm install --prefix web
npm install --prefix functions
```

Desarrollo contra el backend de dev:

```bash
npm run dev:web:dev     # Vite --mode v2-dev → http://localhost:5173
```

Verificación antes de tocar nada:

```bash
node scripts/sync-shared-to-functions.mjs
node --test functions/test/*.test.js    # esperado: 598/599 (ver pendiente 3)
npm run lint --prefix web
npm run build:web
```

Deploys:

```bash
# functions, SIEMPRE selectivo
npx firebase deploy --project portal-hospital-v2-dev --only functions:nombre1,functions:nombre2

# hosting
npm run build:web:dev && npx firebase deploy --project portal-hospital-v2-dev --only hosting
npm run build:web     && npx firebase deploy --project portal-hospital-v2     --only hosting
```

Si un callable nuevo devuelve un CORS raro en el browser, casi siempre es un 403 de IAM disfrazado:

```bash
gcloud run services add-iam-policy-binding <nombre-en-minuscula-con-guiones> \
  --project=portal-hospital-v2 --region=southamerica-east1 \
  --member="allUsers" --role="roles/run.invoker"
```

---

## Archivos clave tocados

### Backend

- `functions/modules/shared/solicitudBandejaJefeCore.js` — par 64, label de grupo, N1, `orderBy`
- `functions/modules/shared/solicitudBandejaRrhhCore.js` — ítem con nombres, trazabilidad, flags del motor, estados por vista
- `functions/modules/shared/solicitudTrazabilidadResolucion.js` *(nuevo)*
- `functions/modules/shared/asyncMapLimite.js` *(nuevo)*
- `functions/modules/shared/solicitudAutorizacionCache.js` *(nuevo)*
- `functions/modules/shared/familia64Config.js` *(nuevo, sesión previa)*
- `functions/modules/shared/solicitudesArticuloEstados.js` — estado de junta
- `functions/onCall/solicitudes/obtenerResumenSaldoFamilia64Jefe.js` *(nuevo)*
- `functions/onCall/solicitudes/obtenerVeredictoMotorSolicitudRrhh.js` *(nuevo)*

### Compartido

- `shared/utils/familia64Chip.js` *(nuevo, + test)*
- `shared/utils/motorSnapshotFlags.js` *(nuevo)*
- `scripts/sync-shared-to-functions.mjs` — ambos agregados a la lista de sync

### Front

- `web/src/pages/BandejaJefeSolicitudes.jsx`, `web/src/pages/BandejaRrhhSolicitudes.jsx`
- `web/src/features/solicitudes/BandejaJefeSolicitudDetalle.jsx`, `BandejaRrhhSolicitudDetalle.jsx`
- `web/src/features/solicitudes/BandejaRrhhTrazabilidad.jsx` *(nuevo)*
- `web/src/features/solicitudes/BandejaRrhhMotorAuditoria.jsx` — plegable + lazy
- `web/src/features/solicitudes/useSaldoFamilia64Jefe.js`, `useVeredictoMotorRrhh.js` *(nuevos)*
- `web/src/features/solicitudes/Familia64SaldoJefe.jsx` *(nuevo)*
- `web/src/features/solicitudes/familia64Label.js` *(nuevo)*
- `web/src/features/solicitudes/bandejaSolicitudExpandDatos.js`, `bandejaSolicitudesFormat.js`, `BandejaSolicitudResumenFilas.jsx`
- `web/src/features/solicitudes/useBandejaRrhhSolicitudes.js` — grupos de filtro, `aplicarFiltrosCon`

### Scripts

- `scripts/seed-v2/auditar-snapshot-autorizadores.mjs` *(nuevo)* — auditoría del punto 5.4 del RFC
- `scripts/seed-v2/patch-familia64-pares-prod.mjs`, `sync-familia64-pares-dev.mjs`, `seed-saldo-familia64-dev.mjs`
