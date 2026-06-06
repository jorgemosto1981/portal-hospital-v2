# Handoff de sesión — 30 de mayo de 2026 (punto exacto de continuación)

**Proyecto:** `portal-hospital-v2`  
**Rama de trabajo habitual:** `feat/epic-multi-hlg-fase1-execution` (verificar con `git branch` al retomar)  
**Firebase:** `portal-hospital-v2` · región functions `southamerica-east1`  
**Audiencia:** Jorge / equipo dev / QA piloto MOSTO

---

## 1. Resumen ejecutivo de la sesión

En esta sesión se cerró un bloque grande de **épica Multi-HLG + capa teórica + Turnos Mensuales + Grilla Operativa**, con deploy de **Cloud Functions** y **Hosting** al final.

| Área | Qué se hizo |
|------|-------------|
| **HLg (datos laborales)** | VAL-HLG-014 error solape mismo grupo; VAL-HLG-017 régimen inactivo; VAL-HLG-018 no cambiar régimen en edición; solape/W003 excluyen `activo: false`; tests en `hlgValidacionesCore.js` |
| **Turnos Mensuales (producto)** | Criterio: sin agentes planificados → **Ver equipo** (solo lectura); con planificados → **Crear Turno**; backend `[PLT-017]` al crear plan sin planificados; `hay_agentes_planificados` en `listarContextoPlanGrupo` |
| **Editor Crear Turno** | Paleta solo regímenes planificados; etiquetas de turno (no IDs técnicos); pincel solo si hay filas planificadas |
| **Materialización `asi_*` / `vis_*`** | Deuda **DEUDA-CT-001** documentada (orquestador único + job mensual — A DEFINIR); fix foto plan en aprobar; normalizar `no_laborable`; lazy materialización al abrir calendario |
| **Grilla Operativa · Calendario** | Titular = **N calendarios apilados** (un cargo vigente por bloque, sin selector); UI **NL** para no laborable; deploy web |
| **Deploy** | Functions: **OK** (`Deploy complete!` 30/05). Hosting: ver §6 (ejecutado al cierre de esta sesión) |

---

## 2. Punto exacto para la próxima sesión

### 2.1 Estado operativo esperado tras deploy web

1. **Turnos Mensuales:** grupo 100 % fijo/rotativo → tarjeta **Ver equipo**; con planificados → **Crear Turno**.
2. **Calendario licencias → Titular (mi caso):** al abrir el modal, **varios calendarios verticales** (Oficina, Portería, Sala, etc.) sin combo de grupo.
3. **Backend:** al abrir calendario sin `vis_*`, **materialización lazy** por persona+gdt+mes.
4. **Sala Internación (plan HABILITADO):** tras re-aprobar o `materializar-grupo-mes.mjs`, días **NL** del régimen fijo no deben volverse todo **F** en `vis_*`.

### 2.2 QA inmediato recomendado (piloto MOSTO — DNI 28914247)

| # | Caso | Dónde | Resultado esperado |
|---|------|-------|-------------------|
| 1 | Titular mayo 2026 | Grilla Operativa → Calendario → Titular | 3+ bloques (Oficina, Portería, Sala…) con horarios/licencias |
| 2 | Oficina / Portería | Mismo modal | Ya no “vacío” si HLg vigente (lazy mat) |
| 3 | Sala junio | Plan aprobado vs calendario | NL ≠ F según régimen CHAPARRO/MOSTO |
| 4 | Grupo solo fijo | Turnos Mensuales | **Ver equipo**, sin guardar plan |
| 5 | Sala con planificados | Turnos Mensuales | **Crear Turno** si hay LOKITO u otro planificado |

Scripts útiles:

```bash
node scripts/verificar-vis-mes-agente.mjs --persona=per_01KQN9WXFXF69Z9DCT5YNJ3TFZ --gdt=gdt_... --periodo=2026-06
node scripts/materializar-grupo-mes.mjs --gdt=gdt_01KQA6QCA8TDQK9YBTHKYA4R2V --periodo=2026-06
```

### 2.3 Pendientes de épica (sin cerrar en esta sesión)

| ID | Prioridad | Tarea |
|----|-----------|--------|
| **DEUDA-CT-001** | **MUY IMPORTANTE — A DEFINIR** | Orquestador único materialización + job rollover mes (ver `REGISTRO_DEUDA_2026-05-30_CAPA_TEORICA_Y_GRILLA.md`) |
| **DEUDA-GO-002** | MEDIA — A DEFINIR | Paridad visual calendario equipo vs Turnos Mensuales |
| **PR → master** | ALTA | PR `feat/epic-multi-hlg-fase1-execution` + QA matriz §4.2 |
| **QA §4.2** | ALTA | Ítems 2, 3, 6, 8, 9 + `audit-vis-junio-2026.mjs` |
| **Deploy piloto** | Si datos viejos | Re-aprobar plan junio Sala o rematerializar scoped |

### 2.4 Lo que NO hacer al retomar (anti-patrones)

- No reintroducir fusión global `vis_*` / `capa_teorica` raíz.
- No asumir que julio se materializa solo al cambiar de mes (aún no hay cron — DEUDA-CT-001).
- No desplegar solo functions sin hosting si se prueba UI de Titular o Turnos Mensuales.

---

## 3. Inventario de cambios por archivo (detalle técnico)

### 3.1 Backend — Functions

| Archivo | Cambio |
|---------|--------|
| `functions/modules/laboral/hlgValidacionesCore.js` | **Nuevo** — lógica pura HLg (solape, W003, 014, 017, 018) |
| `functions/test/catalogosHlgValidaciones.test.js` | **Nuevo** — 6 tests HLg |
| `functions/modules/catalogosShared.js` | Integra validaciones; elimina W002 |
| `functions/modules/catalogosLaborales.js` | Post-HLg materializa mes actual + siguiente |
| `functions/modules/asistencia/planesTurnoServicio.js` | `hay_agentes_planificados`; `[PLT-017]`; imports contexto |
| `functions/modules/asistencia/rdaTurnoTeoricoWorker.js` | `normalizarTipoDiaMaterializacion`; `resolucionDesdeFotoPlan`; plan primero al materializar; fix `planCacheFoto` |
| `functions/modules/shared/grillaMesAgenteCore.js` | `ensureMaterializacionVisMes`; `leerVistaGrillaMesAgente`; lazy en lectura `vis_*` |

### 3.2 Frontend — Web

| Archivo | Cambio |
|---------|--------|
| `web/src/pages/jefe/PlanTurnoServicioPage.jsx` | Tarjetas Ver equipo / Crear Turno; `modoVistaEquipo`; contexto paralelo |
| `web/src/pages/jefe/planes/GrillaMensualEditor.jsx` | Paleta planificados; modo vista equipo; footer solo Cerrar |
| `web/src/pages/jefe/planes/planGrillaRegimenUtils.js` | Utilidades régimen fijo/rotativo/planificado |
| `web/src/features/grilla/useGrillaMesVista.js` | Titular: carga **todos** los `gdt` vigentes → `titularCalendarios[]` |
| `web/src/features/grilla/GrillaMesLicenciasPanel.jsx` | Modal titular: calendarios apilados; sin selector grupo |
| `web/src/features/grilla/GrillaMesTitularCalendario.jsx` | NL / F / horarios; título en sección padre |
| `web/src/features/grilla/grillaMesEquipoDisplay.js` | Texto **NL** en celdas `no_laborable` |
| `web/src/features/grilla/GrillaMesEquipoTabla.jsx` | `tipo_dia` correcto en modal |
| `web/src/pages/DatosLaborales.jsx` + `formLogic.js` + `LaboralFormHlgFields.jsx` + `utils.js` | HLg validaciones UI; régimen bloqueado en edición; solape mismo grupo |

### 3.3 Documentación

| Archivo | Rol |
|---------|-----|
| `docs/v2/REGISTRO_DEUDA_2026-05-30_CAPA_TEORICA_Y_GRILLA.md` | DEUDA-CT-001, GO-001, GO-002 |
| `docs/v2/PLAN_CAPA_TEORICA_ASISTENCIA_V2.md` | Enlace deuda CT-001 |
| `docs/v2/PLAN_GRILLA_MULTI_HLG_V2.md` | §7bis deuda registrada |
| `docs/v2/HANDOFF_SESION_2026-05-29_MATERIALIZACION_PLAN_VS_HLG.md` | Contexto incidente CHAPARRO |
| `docs/v2/HANDOFF_SESION_2026-05-29_CIERRE_MULTI_HLG.md` | Cierre limpieza `asi_*` |

---

## 4. Criterios de producto acordados (recordatorio)

### Turnos Mensuales

- **Sin plan mensual** y **sin agentes planificados** en el mes → **Ver equipo** (grilla derivada del régimen, sin circuito `plt_*`).
- **Con ≥1 planificado** → **Crear Turno** / enviar / aprobar.
- Backend bloquea alta de plan mensual sin planificados: `[PLT-017]`.

### Materialización automática (estado actual, no futuro)

- Disparadores: guardar HLg (mes actual + siguiente), aprobar plan, remat RRHH, scripts, **lazy al abrir calendario**.
- **No hay cron** día 1 → DEUDA-CT-001.

### Multi-HLG Opción A

- Un `vis_*` por `persona + mes + gdt_*`.
- Plan > HLg dentro del `gdt` del plan al materializar con `planCache`.

---

## 5. Piloto de referencia (IDs)

| Concepto | ID / valor |
|----------|------------|
| Persona MOSTO | `per_01KQN9WXFXF69Z9DCT5YNJ3TFZ` · DNI 28914247 |
| Sala Internación 1 | `gdt_01KQA6QCA8TDQK9YBTHKYA4R2V` |
| Plan junio 2026 piloto | `plt_01KSSPY2H5EZA925FQP4S1G2XW` |
| HLg Oficina MOSTO | `hlg_01KQPW6YH9T31JBQHYKGXWH5RW` |
| HLg Portería MOSTO | `hlg_01KQYMY313QPZQ957WQZZYRX4K` |
| Períodos materializados scoped (Sala) | `2026-05`, `2026-06` |

---

## 6. Deploy realizado en cierre de sesión

| Componente | Comando | Estado |
|------------|---------|--------|
| **Functions** | `npm run firebase:deploy:functions` | ✅ `Deploy complete!` (30/05, con retries 429) |
| **Hosting (web)** | `cd web && npm run build` + `firebase deploy --only hosting --project portal-hospital-v2` | ✅ `Deploy complete!` |

**URLs:**

- Hosting: https://portal-hospital-v2.web.app  
- Consola Firebase: https://console.firebase.google.com/project/portal-hospital-v2/overview

---

## 7. Comandos útiles al retomar

```bash
# Rama y estado
git status
git branch

# Tests HLg (sin Firebase colgado)
cd functions && npm test -- catalogosHlgValidaciones.test.js

# Build + hosting
cd web && npm run build
cd .. && firebase deploy --only hosting --project portal-hospital-v2

# Functions (si hubo cambios solo backend)
npm run firebase:deploy:functions
```

---

## 8. Historial de decisiones de la sesión (cronológico)

1. Usuario confirmó criterio Turnos Mensuales: plan solo si hay planificados.
2. Análisis materialización mes actual+siguiente sin cron → DEUDA-CT-001 registrada.
3. Reporte calendario vacío (Oficina/Portería) y NL→F en Sala al HABILITAR → fixes materialización + UI.
4. Usuario pidió Titular = calendarios apilados sin selector.
5. Deploy functions OK.
6. Cierre: handoff + deploy web.

---

## 9. Primera acción sugerida próxima sesión

1. Hard refresh portal (Ctrl+F5).
2. Ejecutar checklist §2.2 con MOSTO en mayo/junio.
3. Si Sala sigue con todo F: `materializar-grupo-mes.mjs` junio scoped o re-aprobar plan.
4. Abrir PR a `master` si QA verde.

---

*Documento generado al cierre de sesión 30/05/2026. Mantener sincronizado con `REGISTRO_DEUDA_2026-05-30_CAPA_TEORICA_Y_GRILLA.md` y plan maestro Multi-HLG.*
