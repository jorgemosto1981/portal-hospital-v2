# Módulo Fichadas Reloj V2 — RFC diseño e implementación

**Estado:** Fase C en curso (`feature/modulo-fichadas-faseC`). Fases A–B aprobadas.  
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
| **D–F** | UI relojes, carga manual, ABM grilla, semáforo Jefe |

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

*Documento vivo: las secciones 4–5 se expandirán en Fases B–C según el plan maestro.*
