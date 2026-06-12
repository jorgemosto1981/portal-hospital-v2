# Módulo Fichadas Reloj V2 — RFC diseño e implementación

**Estado:** Módulo **cerrado en `master`** (commit `ff779f6`): fases A–F, ABM relojes, **relojes universales** (`grupo_trabajo_id` null), roster global (`listarRosterParaFichadas`), caché `sessionStorage` en carga manual, asistente de máscaras en ABM.  
**Plan maestro:** `módulo_fichadas_reloj_551a3612.plan.md` (Cursor).  
**Relación:** [`MANUAL_CAPAS_ORQUESTACION_BORRADOR.md`](./MANUAL_CAPAS_ORQUESTACION_BORRADOR.md), [`CRITERIOS_ACEPTACION_GSO_CONFLICTOS_CAPAS_V2.md`](./CRITERIOS_ACEPTACION_GSO_CONFLICTOS_CAPAS_V2.md), [`EXPECTATIVAS_FICHADA_SALIDA_MOMENTANEA_V2.md`](./EXPECTATIVAS_FICHADA_SALIDA_MOMENTANEA_V2.md), US-15 capa 4 en `vis_*`.

---

### PREFACIO OBLIGATORIO DE ARQUITECTURA Y COSTOS (Módulo Fichadas V2)

#### §15.7 Reglas Estrictas de Austeridad Firestore

- **§15.2C — Criterio Único de Delta (Dirty Checking):** Solo se generará una escritura (Write) en Firestore si cambia el array `fichadas_reales` (normalizado) o el conjunto de `advertencias_fichada_abiertas`. Si el procesamiento de un TXT o el guardado de un modal de RRHH da marcas e indicaciones idénticas al snapshot actual, se ejecutará un early return (`write_skipped: true`) SIN modificar versiones, SIN consumir escrituras y SIN generar registros en `eventos_ticket` (`evt_*`). Implementar la lógica base en `shared/utils/fichadasDeltaCeldaDia.js`.

- **§15.2D — Techo de Seguridad (Batch safe max):** Se establece `FIRESTORE_BATCH_SAFE_MAX = 400` para inserciones masivas de marcas huérfanas (`fmh_*`). Ante lotes masivos (ej. test de 600 líneas huérfanas), el backend segmentará obligatoriamente en sub-batches de hasta 400 operaciones para evitar los límites físicos de Firestore. La reconciliación se particionará por documento de vista mensual (`vis_*`), nunca por línea individual.

- **§15.2A — Mecánica Transaccional Real (Read-before-write):** Toda transacción en Firestore abona obligatoriamente 1 lectura previa del documento `vis_*`. La optimización del patrón Map-Reduce en memoria radica en evitar N ciclos redundantes de lectura/escritura competitiva sobre el mismo documento de un agente en un mes, eliminando la contención de locks y reduciendo el costo físico de escrituras a 1 Write consolidado por agente/mes afectado.

#### §14. Especificación de UI: Abstracción de Datos para la Grilla del Jefe

- La grilla operativa del Jefe NO mostrará marcas horarias crudas, sino estados lógicos derivados de la alineación y auditoría (`OK`, `RRHH_PENDIENTE`, `RRHH_RESUELTO`, `ALERTA`) mediante `shared/utils/grillaFichadaEstadoJefe.js` evaluados en servidor.

- El flag `resuelto_rrhh: true` se persistirá estáticamente en `dias.{DD}` ante acciones manuales de RRHH para evitar sub-queries N+1 de logs/auditoría en la renderización masiva de la grilla mensual del Jefe.

---

## 1. Alcance por fases

| Fase | Entregable |
|------|------------|
| **A** | RFC + `fichadasValidacionMarcas.js` + `fichadasDeltaCeldaDia.js` + tests |
| **B** | `fichadasAlineacionTeoria.js`, callable `reconciliarMarcasHuerfanasReloj` |
| **C** (actual) | `guardarCapaFichadaDia` + `aplicarImportFichadasReloj` + índices `fmh_*` |
| **D** (actual) | UI import TXT + preview + bandeja huérfanas + enrolamiento |
| **E–F** | Carga manual, ABM grilla, semáforo Jefe |

## 2. Entradas capa 4

- **Import TXT** — máscara genérica `TTTTT DD/MM/YY HH:MM RRR CC` (tokens configurables en `cfg_reloj_biometrico` en fases posteriores).
- **Carga manual RRHH** — `/portal/rrhh/fichadas-carga-manual`.
- **ABM grilla RRHH** — `guardarCapaFichadaDia` desde modal día.

Destino v1: `vistas_grilla_mes_agente` → `dias.{DD}.fichadas_reales`. Solo RRHH escribe; período cerrado bloqueado.

## 3. Fase C — Callables (implementado)

| Callable | Archivo core |
|----------|----------------|
| `guardarCapaFichadaDia` | [`fichadasCapaDiaCore.js`](../../functions/modules/fichadas/fichadasCapaDiaCore.js) |
| `aplicarImportFichadasReloj` | mismo + map-reduce §15.2A |
| `reconciliarMarcasHuerfanasReloj` | Fase B |

**Índices:** [`firebase-v2/firestore.indexes.json`](../../firebase-v2/firestore.indexes.json) — compuesto `fichadas_marca_huerfana` (reconciliación + bandeja).

## 4. Fase B — Alineación teórica (implementado)

| Artefacto | Descripción |
|-----------|-------------|
| [`fichadasAlineacionTeoria.js`](../../shared/utils/fichadasAlineacionTeoria.js) | Proximidad greedy a anclas `rda_*`, rebucket nocturnidad D+1→D, `NOCTURNIDAD_AMBIGUA` |
| [`reconciliarMarcasHuerfanasCore.js`](../../functions/modules/fichadas/reconciliarMarcasHuerfanasCore.js) | Query indexada `fmh_*`, merge en memoria, transacción por `vis_*`, dirty check |
| Callable `reconciliarMarcasHuerfanasReloj` | Solo RRHH; payload `reloj_id`, `numero_tarjeta`, `persona_id`, `grupo_trabajo_id` |

```bash
npm run test:fichadas-modulo
```

## 5. Fase A — Parser y validación (implementado)

### 5.1 Módulos `shared/utils/`

| Archivo | Responsabilidad |
|---------|-----------------|
| [`fichadasValidacionMarcas.js`](../../shared/utils/fichadasValidacionMarcas.js) | Parse línea TXT, zona `America/Argentina/Buenos_Aires`, duplicados `MARCA_DUPLICADA_PROBABLE`, agrupación map-reduce por clave `vis_*` |
| [`fichadasDeltaCeldaDia.js`](../../shared/utils/fichadasDeltaCeldaDia.js) | Dirty check §15.2C, `FIRESTORE_BATCH_SAFE_MAX`, segmentación de batches |

Sincronización a Functions: `node scripts/sync-shared-to-functions.mjs`.

### 5.2 Tests Fase A

```bash
npm run test:fichadas-faseA
```

## 6. Modelo celda día (`vis_*`) — resumen

| Campo | Uso |
|-------|-----|
| `fichadas_reales` | Capa 4 activa |
| `fichadas_borradas` | Bajas lógicas (RRHH) |
| `advertencias_fichada_abiertas` | Códigos abiertos → `RRHH_PENDIENTE` |
| `resuelto_rrhh` | Flag persistido post-auditoría RRHH |
| `fichadas_reales_version` | Concurrencia optimista |

## 7. Colecciones nuevas (Fases B–C)

`cfg_reloj_biometrico`, `reloj_persona_enrolamiento`, `fichadas_import_lote`, `fichadas_marca_huerfana`.

---

## 8. Go-live backend (post-merge PR #4)

Orden obligatorio en Firebase (índices antes que callables que consultan `fmh_*`):

```bash
git checkout master
git pull origin master
npm run test:fichadas-modulo
npm run firebase:deploy:firestore
npm run firebase:deploy:functions -- --only functions:listarColeccion,functions:guardarCapaFichadaDia,functions:aplicarImportFichadasReloj,functions:reconciliarMarcasHuerfanasReloj,functions:previsualizarImportFichadasReloj,functions:listarMarcasHuerfanasReloj,functions:descartarMarcaHuerfanaReloj,functions:guardarEnrolamientoRelojPersona,functions:guardarCfgRelojBiometrico,functions:listarRosterParaFichadas
```

Verificar en consola Firestore que los índices de `fichadas_marca_huerfana` estén **Enabled** antes del deploy de functions.

## 9. Fase D — UI RRHH (implementado)

| Ruta | Pantalla |
|------|----------|
| `/portal/rrhh/fichadas-import` | Subida TXT, preview, checkboxes duplicados, apply |
| `/portal/rrhh/fichadas-relojes` | ABM `cfg_reloj_biometrico` (callable `guardarCfgRelojBiometrico`) |
| `/portal/rrhh/fichadas-huerfanas` | Bandeja `fmh_*` índice `(reloj_id, estado, fecha_ymd)` |
| `/portal/rrhh/fichadas-enrolamiento` | Alta `rpe_*` + reconciliar |

| Callable | Notas |
|----------|--------|
| `previsualizarImportFichadasReloj` | 0 I/O Firestore; enrolamiento vía payload cliente |
| `listarMarcasHuerfanasReloj` | Query indexada bandeja |
| `descartarMarcaHuerfanaReloj` | `DESCARTADA` + motivo |
| `guardarEnrolamientoRelojPersona` | `rpe_*` + `reconciliarMarcasHuerfanasReloj` |

Deploy Fase D (añadir a §8):

```bash
npm run firebase:deploy:functions -- --only functions:previsualizarImportFichadasReloj,functions:listarMarcasHuerfanasReloj,functions:descartarMarcaHuerfanaReloj,functions:guardarEnrolamientoRelojPersona
```

### Semilla dev (reloj testigo)

```bash
ALLOW_FIRESTORE_SEED_V2=true npm run seed:fichadas-reloj
```

Crea `rel_hospital_central_01` (política configurable) y `rel_hospital_central_02` (`BLOQUEAR_APLICAR`). TXT de humo: `scripts/dev/fixtures/fichadas-import-smoke.txt`. Variable `FICHADAS_SEED_GDT_ID` (default `gdt_seed_demo_cfg`).

**PR #5 (Fase D):** base apilada `feature/modulo-fichadas-faseC` hasta merge de PR #4; luego `git rebase origin/master` y retarget a `master`.

## 10. Fase E — Carga manual (implementado)

| Ruta | Comportamiento |
|------|----------------|
| `/portal/rrhh/fichadas-carga-manual` | Teclado Persona→Fecha→Ingreso→Egreso; `useRelojConfigCache` §15.1B; query `?persona_id&fecha_ymd&gdt_id` |

- Callable: `guardarCapaFichadaDia` (`AGREGAR_MARCAS` / undo `REEMPLAZAR_MARCAS`, `CARGA_MANUAL`).
- Tests: `web/src/features/fichadas/cargaManual/fichadasCargaManualUtils.test.js`.

## 11. Gate Fase F (cierre)

| Entrega | Detalle |
|---------|---------|
| Enlace grilla RRHH | Celda «Manual» + modal → `/portal/rrhh/fichadas-carga-manual?persona_id&fecha_ymd&gdt_id` |
| ABM modal RRHH | `DiaGrillaFichadaRrhhPanel` → `guardarCapaFichadaDia` (`AGREGAR_MARCAS`, `BORRAR_FILA`, `BORRAR_CAPA`); historial `fichadas_borradas` lazy |
| Semáforo Jefe | `shared/utils/grillaFichadaEstadoJefe.js` + `grillaVisSanitizeGso` en listado GSO; badge en celda; modal abstracto sin horas ni ABM |
| Tests | `grillaFichadaEstadoJefe.test.js`, `grillaVisSanitizeGso.test.js` en `npm run test:fichadas-modulo` |

---

## 12. Checklist de certificación en marcha blanca (smoke test)

Para validar la integridad del módulo completo tras el despliegue en cualquier entorno (staging/producción), QA o infraestructura ejecuta este protocolo de tres pasos.

**Suite automatizada previa:** `npm run test:fichadas-modulo` (32 tests, incl. `cfgRelojBiometricoCore`, parser, map-reduce, semáforo jefe).

**Hosting de referencia:** [https://portal-hospital-v2.web.app](https://portal-hospital-v2.web.app)

### 12.1 Validación del fierro universal y asistente de máscaras

- **Ruta:** `/portal/rrhh/fichadas-relojes`
- **Acción:** Crear o editar un dispositivo. Dejar el campo «Grupo de trabajo» vacío (opción *Universal*).
- **Prueba del playground:** En el panel de ayuda, pegar la línea testigo `998231206261430001` y la máscara `TTTTTDDMMYYHHMMRRR`. Verificar extracción en vivo (tarjeta `99823`, hora `14:30`). Presionar «Usar esta máscara en el formulario» y guardar.
- **Éxito:** `guardarCfgRelojBiometrico` responde OK y el listado muestra el tag **Universal**.

### 12.2 Procesamiento masivo e inyección dinámica (lote mezclado)

- **Ruta:** `/portal/rrhh/fichadas-import`
- **Acción:** Seleccionar el reloj universal y arrastrar un `.txt` con tarjetas de distintos sectores (ej. Guardia y Terapia). Previsualizar y aplicar el lote.
- **Éxito:** `aplicarImportFichadasReloj` resuelve `gdtDestino` por enrolamiento (`rpe_*`). Las marcas no se agrupan en un sector ficticio del reloj; impactan en los `vis_*` de cada servicio según el grupo del agente.

### 12.3 Carga manual sin latencia (roster global en caché)

- **Ruta:** `/portal/rrhh/fichadas-carga-manual`
- **Acción:** Seleccionar el reloj universal. En DevTools → Network, verificar **una** llamada a `listarRosterParaFichadas` con scope global (`grupo_trabajo_id: GLOBAL` o equivalente).
- **Prueba de tipeo:** Escribir en el campo Persona; las sugerencias del typeahead deben ser instantáneas (filtro en memoria).
- **Éxito:** Tras la carga inicial, la UI usa `sessionStorage` (`roster_fichadas_GLOBAL`) sin round-trip por tecla. Guardado en ráfaga con Enter; `Ctrl+Z` deshace el último ítem de la cola de sesión vía `REEMPLAZAR_MARCAS`.

---

**Tablero cerrado.** Repositorio `master` (`ff779f6`), tests fichadas 32/32, functions en `southamerica-east1`, hosting actualizado. Documento de referencia para validación rápida en producción.
