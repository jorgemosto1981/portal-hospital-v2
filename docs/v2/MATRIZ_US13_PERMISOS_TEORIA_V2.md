# Matriz US-13 — Permisos sobre capa teórica (rol × acción × pantalla)

Estado: **validado funcionalmente** vía [`CHECKLIST_VALIDACION_RRHH_US13_PERMISOS_TEORIA.md`](./CHECKLIST_VALIDACION_RRHH_US13_PERMISOS_TEORIA.md) (G1–G7, 2026-06-08).  
Guía implementación US-13 (go-live día 1 con reglas estrictas — G7).

## Referencias normativas

| Documento | Uso |
| :--- | :--- |
| [`CRITERIOS_ACEPTACION_GSO_CONFLICTOS_CAPAS_V2.md`](./CRITERIOS_ACEPTACION_GSO_CONFLICTOS_CAPAS_V2.md) | US-13 P1; §6.2.1 canales; **Q9-1 = B** (plan vs override) |
| [`ANALISIS_APP_VS_CRITERIOS_GSO_CONFLICTOS_V2.md`](./ANALISIS_APP_VS_CRITERIOS_GSO_CONFLICTOS_V2.md) | Gap documental US-13 |

## Objetivo US-13

Unificar **quién** puede ejecutar **qué acto** que altera la **capa 1** (teoría: `vis_*` / `rda_*`, `tipo_dia`, materialización) en **qué pantalla**, con la misma regla en **UI** y **Cloud Functions**.

## Política oficial G1–G7 (SSoT — 2026-06-08)

Resumen normativo cerrado en [`CHECKLIST_VALIDACION_RRHH_US13_PERMISOS_TEORIA.md`](./CHECKLIST_VALIDACION_RRHH_US13_PERMISOS_TEORIA.md). Ante duda de producto o soporte, **este bloque + checklist** prevalecen hasta nuevo acta.

| ID | Regla |
| :--- | :--- |
| **G1** | Mes **habilitado**: cambios de **diseño** → plan (revertir → editar → aprobar). Override solo **3 urgencias**: ausencia con menos de 48 h; permuta guardia semana en curso; pico demanda espontáneo. |
| **G2** | Gestión turno solo **superior jerárquico** del agente en el `gdt`; UI alineada al servidor (sin botones que fallen al guardar). |
| **G3** | **Un rol RRHH** (GSO + plan + C10). Código: `esRrhhOperativo` = `tokenHasRrhhLaborAccess` ∨ `tokenHasRrhhAccess`. |
| **G4** | **Titular** sin override; consulta + trámites; jefe/RRHH ejecutan teoría. |
| **G5** | Listar equipo puede rematerializar (**Q9-5**); **US-11** + ⚠️; sin modal de confirmación. |
| **G6** | Solo **jefe del servicio** guarda y envía plan mensual (C1/C2). |
| **G7** | **Go-live día 1:** reglas estrictas desde el primer uso; capacitación en onboarding (Plan vs Grilla + urgencias G1). |

**Implementación:** Fase A `web/src/features/grilla/teoriaPermisosGso.js` + Vitest (TDD) → Fase B UI → Fase C callables.

---

## Roles en la matriz (columnas)

En código no hay un enum único «rol GSO». Se usan estas columnas:

| Columna | Señal típica | Claims / helpers |
| :--- | :--- | :--- |
| **Titular** | Agente consultando su mes | `persona_id`; portal `isPortalRoleUsuario` |
| **Jefe** | Gestión equipo en GSO / plan | `tiene_subordinados` o `CFG_JEFE` (UI); jerarquía HLG (backend override) |
| **RRHH** *(producto, post-G3 checklist)* | Un solo rol institucional — GSO, plan, C10 | En UI/matriz: columna única. En código jun 2026 aún hay dos claims → Fase A: `esRrhhOperativo` = `tokenHasRrhhLaborAccess` **∨** `tokenHasRrhhAccess` |
| ~~RRHH labor / admin~~ | *Solo trazabilidad as-built* | Ver filas técnicas en tablas ventanas si hace falta auditar functions |

**Decisión RRHH (2026-06-08, G3 Opción B):** ver [`CHECKLIST_VALIDACION_RRHH_US13_PERMISOS_TEORIA.md`](./CHECKLIST_VALIDACION_RRHH_US13_PERMISOS_TEORIA.md) § G3. Implementación: unificar gates UI; alinear callables donde hoy solo miran un claim.

---

## Canales que cambian capa 1 (eje «acción»)

Identificadores internos para capacitación, tests y módulo compartido futuro.

| ID | Canal (acta §6.2.1) | Callable / proceso principal | Rematerializa |
| :--- | :--- | :--- | :---: |
| **C1** | Guardar borrador plan | `guardarPlanTurnoServicio` | No (hasta habilitar) |
| **C2** | Enviar plan | `enviarPlanTurnoServicio` | No |
| **C3** | Aprobar / habilitar plan | `aprobarPlanTurnoServicio` | **Sí** (grupo) |
| **C4** | Rechazar plan | `rechazarPlanTurnoServicio` | No |
| **C4b** | Revertir habilitado → `EN_REVISION` | `revertirPlanTurnoServicio` | No (teoría vigente hasta nueva habilitación) |
| **C5** | Override puntual | `registrarCambioTurno`, `eliminarOverrideTurno` | Sí (día) |
| **C6** | Batch F-UX (cobertura / reemplazo / adicional) | `aplicarBatchAsistencia` | Sí |
| **C7** | HLg / régimen / calendario / purge | `catalogosLaborales`, jobs purge | Sí (forward) |
| **C8** | Listar grilla equipo (efecto observador) | `listarVistaGrillaMesPorGrupo` → `materializarGrupoMes` | **Sí** (si worker corre) |
| **C8t** | Vista titular lazy | `obtenerVistaGrillaMesAgente` | **Sí** (lazy) |
| **C9** | Rematerialización admin / día 5 | `ejecutarMaterializacionVentanaDia5`, scripts remat | **Sí** |
| **C10** | Cerrar período liquidación | `cerrarPeriodoLiquidacion` | Bloquea escritura jefe (no borra teoría) |

**Acta Q9-1:** cambio **oficial** del mes → **C4b + C1–C3**; **C5/C6** solo excepciones operativas urgentes (no sustituye huecos de planificación).

---

## Ventanas globales GSO (aplican a C5, C6, UI gestión turno)

| Condición | Titular | Jefe | RRHH labor | RRHH admin (override) |
| :--- | :---: | :---: | :---: | :---: |
| Mes **M-1** desde día 1 del mes actual | ⛔ | ⛔ | ✅ | ✅* |
| Período **cerrado** 🔒 | ⛔ | ⛔ | ✅ | ✅* |
| Mes actual/futuro abierto | 👁† | ✅‡ | ✅ | ✅ |

\* `assertOverrideAuth` usa `tokenHasRrhhAccess`, no solo labor.  
† Titular: consulta; mutación vía C5 solo si backend permite actor === target.  
‡ Jefe: requiere `puedeGestionarTurnoEnGrilla` + `gsoPermiteEscritura`.

| Código | Mensaje / origen |
| :--- | :--- |
| `ASI-GSO-001` | Ventana M-1 — `grillaGsoSoloLectura.js` |
| `ASI-PER-001` / período cerrado | `assertPeriodoNoCerrado` en `assertGrillaGsoEscrituraEnFecha` |

**Implementación:**

- Backend: `functions/modules/asistencia/grillaGsoSoloLectura.js`
- Frontend espejo: `web/src/features/grilla/grillaGsoSoloLectura.js`
- Listado: `gso_solo_lectura` en respuesta de `listarVistaGrillaMesPorGrupo`
- Día: `obtenerCapaTeoricaDia` → `gso_escritura`; modales A/B/C → `soloLecturaDesdeGsoEscrituraApi`

---

## Matriz maestra (rol × canal × pantalla)

Leyenda: **✅** permitido (con condiciones) · **👁** solo lectura / consulta · **⛔** bloqueado · **⚠** delta acta vs as-built

Columnas **Gate UI** y **Callable** describen el estado **jun 2026** en `master` (~`v2.6.3-gso-us6`).

| ID | Pantalla principal | Titular | Jefe | RRHH labor | RRHH admin | Callable (auth) | Gate UI (archivo) | Delta / notas |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- | :--- | :--- |
| **C1** | `PlanTurnoServicioPage` / `GrillaMensualEditor` | ⛔ | ✅ | ⛔ | ✅ | `guardarPlanTurnoServicio` — `assertPlanAuth(..., "guardar")` | Editor si `BORRADOR` / `EN_REVISION` | Cualquier **HLG vigente** en `gdt`, no solo jefe editor |
| **C2** | Idem | ⛔ | ✅ | ⛔ | ✅ | `enviarPlanTurnoServicio` — `assertPlanAuth(..., "enviar")` | Botón enviar en editor | — |
| **C3** | `BandejaAprobaciones` / callable | ⛔ | ✅§ | ⛔ | ✅ | `aprobarPlanTurnoServicio` — `assertPlanAprobarORechazar` | Bandeja jefe si autorizador elegible | § No usa `assertPlanAuth("aprobar")` (claim `tiene_subordinados`); usa cadena jerárquica |
| **C4** | Bandeja | ⛔ | ✅§ | ⛔ | ✅ | `rechazarPlanTurnoServicio` — idem C3 | Idem | Creador del plan no puede aprobar/rechazar |
| **C4b** | RRHH plan / acciones plan | ⛔ | ⛔ | ⛔ | ✅ | `revertirPlanTurnoServicio` — `assertRrhh` | UI RRHH | Clave para **Q9-1** antes de editar mes oficial |
| **C5** | `DiaGrillaDetalleModal` → `GestionTurnoDiaShell` | ⚠ | ✅‡ | ✅ | ✅ | `registrarCambioTurno` — `assertOverrideAuth` + `assertPeriodoEditable` | `puedeGestionarTurnoEnGrilla` | **⚠ Q9-1:** UI no distingue «táctico» vs «oficial» en mes HABILITADO |
| **C6** | Modales A/B/C + outbox panel | ⛔ | ✅‡ | ✅ | ✅ | `aplicarBatchAsistencia` — `assertOverrideAuth` por persona | `tieneCapabilityGestionTurno` | Mismos gates que C5 |
| **C7** | Datos laborales (fuera GSO) | ⛔ | ⛔ | ⛔ | ✅ | `catalogosLaborales` — `assertEscrituraLaboral` / `assertRrhh` | N/A GSO | Mensaje 📅 US-5 post-purge |
| **C8** | `GrillaMesEquipoTabla` / `GrillaMesLicenciasPanel` | 👁 | 👁 | 👁 | 👁 | `listarVistaGrillaMesPorGrupo` — `assertAgenteConPersonaId` + rol portal | Sin gate «remat» | **Q9-5:** efecto colateral; US-11 toast |
| **C8t** | `GrillaMesTitularCalendario` | 👁 | — | 👁 | 👁 | `obtenerVistaGrillaMesAgente` | Titular propio | Lazy materialización |
| **C9** | Admin / jobs | ⛔ | ⛔ | ⚠ | ✅ | Varios — `assertRrhh` | — | Definir lista cerrada en implementación |
| **C10** | `GrillaPeriodoLiquidacionAccionesRrhh` | ⛔ | ⛔ | ⛔ | ✅ | `cerrarPeriodoLiquidacion` — `assertRrhh` | Acciones RRHH en grilla | Tras C10, jefe ⛔ en C5/C6 vía `assertPeriodoEditable` |

### Lectura / consulta plan (no cambia capa 1 hasta habilitar)

| Acción | Pantalla | Titular | Jefe | RRHH admin | Callable | Notas |
| :--- | :--- | :---: | :---: | :---: | :--- | :--- |
| Listar / contexto plan | Plan / grilla | ⛔ | ✅ | ✅ | `listarPlanesTurnoServicio`, `listarContextoPlanGrupo` — `assertPlanAuth(..., "leer")` | Miembro HLG del grupo |
| Vista plan mensual | Editor | ⛔ | ✅ | ✅ | `obtenerVistaPlanTurnoServicio` | — |

---

## Pantallas GSO — acciones de usuario (US-14 encaje)

| Pantalla | Archivo ancla | Acciones | Rol | Gate actual |
| :--- | :--- | :--- | :--- | :--- |
| Grilla mes (equipo / sector) | `GrillaMesLicenciasPanel.jsx`, `GrillaMesEquipoTabla.jsx` | Ver celdas, ⚠️, ⏳, abrir modal | Todos con acceso listado | `evaluarSoloLecturaCeldaGso`, `incompletoPlan` |
| Grilla titular | `GrillaMesTitularCalendario.jsx` | Ver propio mes | Titular | Sin gestión turno en panel |
| Detalle día | `DiaGrillaDetalleModal.jsx` | (1) Bandeja solicitud | Quien ya gestiona ticket | Enlace existente |
| Detalle día | Idem | (2) Ajustar turno | Jefe / RRHH | `puedeGestionarTurno` && !`soloLectura` |
| Detalle día | Idem | (3) Corregir plan | Jefe / RRHH UI | `puedeCorregirPlan={esJefe \|\| esRrhh}` → deep-link plan |
| Gestión turno | `GestionTurnoDiaShell.jsx` | Wizard override | Jefe / RRHH | `grillaGestionTurnoCapabilities.js` |
| Cobertura / cambio propio / adicional | `ModalCoberturaParcial.jsx`, `ModalCambioTurnoPropio.jsx`, `ModalTurnoAdicional.jsx` | C5/C6 | Jefe / RRHH | `soloLecturaDesdeGsoEscrituraApi(gso_escritura)` |

**US-16 (P0):** celda blanca — prohibido operar (override/cobertura); rayado incompleto visible pero sin C5/C6 hasta plan.

---

## Reglas de autorización backend (resumen técnico)

| Función | Archivo | Regla resumida |
| :--- | :--- | :--- |
| `assertPlanAuth` | `functions/modules/shared/helpers.js` | RRHH bypass; else HLG vigente en `grupoId`; `aprobar`/`rechazar` en helper exigen `tiene_subordinados` (callables reales usan `assertPlanAprobarORechazar`) |
| `assertPlanAprobarORechazar` | `planAutorizacionJerarquica.js` | RRHH; no creador; no huérfano sin RRHH; actor ∈ `autorizadores_elegibles_ids` |
| `assertOverrideAuth` | `helpers.js` | RRHH (`tokenHasRrhhAccess`); actor === target; o nivel jerárquico mayor en grupo común |
| `assertGrillaGsoEscrituraEnFecha` | `grillaGsoSoloLectura.js` | RRHH labor bypass ventana; `assertPeriodoNoCerrado`; M-1 |
| `resolverEscrituraGsoDia` | Idem | Devuelve `escritura_habilitada`, códigos `ASI-GSO-001`, período cerrado |

---

## Brechas priorizadas (delta → US-13 implementación)

| # | Tema | Acta / producto | As-built | Acción sugerida |
| :---: | :--- | :--- | :--- | :--- |
| **G1** | Plan vs override (Q9-1) | Mes HABILITADO + corrección estructural → C4b + editor | Jefe puede C5/C6 si `gso_escritura` | Gate UI + mensaje; opcional bloqueo callable salvo flag «urgencia» |
| **G2** | Jefe UI vs jerarquía | Superior del agente | UI: `esJefe` por claim; backend: niveles HLG | Unificar en util compartido `puedeActoTeoria(...)` |
| **G3** | Dos RRHH | **Cerrado:** un rol RRHH (Opción B) | Labor vs Access en código | Fase A: `esRrhhOperativo`; revisar callables |
| **G4** | Titular override | **Cerrado:** no (Opción A) | `assertOverrideAuth` permite self hoy | Fase C: rechazar actor === titular salvo RRHH |
| **G5** | C8 sin permiso remat | **Cerrado:** Q9-5 (A) | Listar = remat + US-11 | Sin modal confirmación; matiz idempotente v2 |
| **G6** | `guardar`/`enviar` plan | **Cerrado:** solo superior del `gdt` (A) | Cualquier HLG del grupo | Endurecer `assertPlanAuth` + UI plan |
| **G7** | Go-live | **Cerrado:** reglas estrictas día 1 | Sin usuarios en prod aún | Fase A–C sin modo permisivo; onboarding con copy G1 |

---

## Checklist validación RRHH

**Documento de reunión (completar con RRHH):** [`CHECKLIST_VALIDACION_RRHH_US13_PERMISOS_TEORIA.md`](./CHECKLIST_VALIDACION_RRHH_US13_PERMISOS_TEORIA.md) — ítems **G1–G7**, tabla de urgencias override, confirmación Q9-2/Q9-6 y acta de cierre.

Resumen de preguntas abiertas:

| ID | Tema |
| :--- | :--- |
| **G1** | Plan vs override en mes HABILITADO (Q9-1) + lista «urgencia operativa» |
| **G2** | Superior jerárquico vs claim «jefe» en UI |
| **G3** | RRHH labor vs RRHH admin (planes, revertir, GSO) |
| **G4** | Titular: ¿override sobre sí mismo? |
| **G5** | Materializar al listar equipo (Q9-5) |
| **G6** | Quién guarda/envía plan (HLG vs solo jefe) |
| **G7** | Go-live día 1 (G7); sin pre-campaña |

---

## Fases de implementación propuestas (post-validación)

1. **Fase A — SSoT en código (solo lectura):** módulo `web/src/features/grilla/teoriaPermisosGso.js` (o nombre acordado) + tests vitest alineados a `grillaGsoSoloLectura.test.js` (functions).
2. **Fase B — UI:** `grillaGestionTurnoCapabilities`, `DiaGrillaDetalleModal`, `PlanTurnoServicioPage` consumen la misma API que los tests.
3. **Fase C — Callables:** mensajes unificados; opcional validación G1 en `registrarCambioTurno` / batch.
4. **Fase D — Capacitación:** export PDF o slide desde esta matriz + §6.2.1 del acta.

---

## Historial del documento

| Fecha | Cambio |
| :--- | :--- |
| 2026-06-08 | Borrador inicial relevamiento US-13 (post US-6/7/11, prod `v2.6.3-gso-us6`) |
| 2026-06-08 | Checklist reunión RRHH → [`CHECKLIST_VALIDACION_RRHH_US13_PERMISOS_TEORIA.md`](./CHECKLIST_VALIDACION_RRHH_US13_PERMISOS_TEORIA.md) |
| 2026-06-08 | G1–G3 cerrados en checklist; columna RRHH unificada (G3) |
| 2026-06-08 | G1–G7 cerrados; § Política oficial SSoT; commit documental US-13 |
