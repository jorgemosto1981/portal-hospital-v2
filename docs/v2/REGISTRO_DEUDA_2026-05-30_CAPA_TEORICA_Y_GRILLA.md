# Registro de deuda — Capa teórica y Grilla Operativa

**Fecha:** 30 de mayo de 2026  
**Prioridad global:** **MUY IMPORTANTE — A DEFINIR** (arquitectura + producto)  
**Responsable sugerido:** épica capa teórica / multi-HLG + UX Grilla Operativa  
**Audiencia:** RRHH, jefatura, backend, frontend, QA

---

## Índice

| ID | Tema | Prioridad |
|----|------|-----------|
| **DEUDA-CT-001** | Orquestación única de materialización (tiempo + eventos) | **MUY IMPORTANTE — A DEFINIR** |
| **DEUDA-GO-001** | Calendario licencias: turno vacío (Titular, Oficina, Portería) | **ALTA — A INVESTIGAR** |
| **DEUDA-GO-002** | Sala Internación: paridad visual con Turnos Mensuales | **MEDIA — A DEFINIR** |

---

## DEUDA-CT-001 — Orquestación de materialización `asi_*` / `vis_*`

### Estado

**MUY IMPORTANTE — A DEFINIR** (sin implementación acordada ni cron mensual en producción).

### Problema (consenso de diseño, 30/05/2026)

Hoy la materialización del turno teórico se dispara desde **varios puntos** del código con la misma regla copiada (“mes actual + mes siguiente” según `new Date()`):

- Post-guardado HLg (`guardarRegistroLaboralTemporal`)
- Post-deshabilitar HLg (solo mes actual — inconsistencia **I2**)
- Aprobar / eliminar / cerrar plan (`materializarGrupoMes`)
- Callables RRHH `rematerializarPostCalendario` / `rematerializarPostRegimen`
- Scripts operativos (`materializar-grupo-mes.mjs`, etc.)

**No existe** disparo automático al **cambio de mes calendario**. Ejemplo: en mayo se materializa mayo+junio; **julio** solo aparece cuando en junio ocurre otro evento (guardar HLg, remat RRHH, script) — no el día 1/7.

El plan maestro [`PLAN_CAPA_TEORICA_ASISTENCIA_V2.md`](./PLAN_CAPA_TEORICA_ASISTENCIA_V2.md) §1D ya menciona un tercer disparador futuro: *job programado o lazy al primer acceso* — **pendiente de producto e implementación**.

### Dirección acordada (conceptual, sin codificar)

| Capa | Rol |
|------|-----|
| **Orquestador único** | Contrato: materializar `{ persona?, grupo?, periodo }` por `motivo` (hlg, plan, calendario, rollover, override, …) |
| **Reactiva** | HLg / plan / override → solo bounded contexts afectados |
| **Proactiva (tiempo)** | Job día 1 (o nightly): ventana deslizante mes actual + siguiente para HLg activos fijo/rotativo |
| **Masiva** | Cambio calendario institucional o `cfg_regimen_horario` → batch por grupo o régimen |
| **Híbrido obligatorio** | Planificado sigue necesitando evento de plan HABILITADO; el cron no reemplaza el circuito `plt_*` |

### Decisiones abiertas (A DEFINIR)

1. ¿El job mensual materializa **solo fijo/rotativo** o **todo el grupo** (incl. replan con plan ya habilitado)?
2. ¿Alcance hospital completo vs. grupos con HLg activo en el mes (costo Firestore)?
3. ¿Idempotencia / cola / reintentos centralizados vs. fire-and-forget actual?
4. ¿Lazy materialización al **primer acceso** a Grilla Operativa (Calendario) como complemento del cron?
5. ¿Unificar **I2** (deshabilitar HLg → también mes siguiente)?

### Referencias

- Motor: `functions/modules/asistencia/rdaTurnoTeoricoWorker.js`
- Disparos actuales: `functions/modules/catalogosLaborales.js`, `planesTurnoServicio.js`, `rematerializacion.js`
- Plan: [`PLAN_CAPA_TEORICA_ASISTENCIA_V2.md`](./PLAN_CAPA_TEORICA_ASISTENCIA_V2.md) §1D, hallazgos I1–I2
- Multi-HLG: [`PLAN_GRILLA_MULTI_HLG_V2.md`](./PLAN_GRILLA_MULTI_HLG_V2.md)

### Criterio de cierre (borrador)

- [ ] Documento de arquitectura aprobado (orquestador + políticas reactiva/proactiva/masiva)
- [ ] Julio (y mes N+1) existe sin depender de “tocar HLg” en mes N
- [ ] Un solo entrypoint invocado desde callables (sin duplicar ventana de meses)
- [ ] Métricas/logs: última materialización OK por `persona+gdt+periodo`

---

## DEUDA-GO-001 — Grilla Operativa · Calendario licencias · turno vacío

### Estado

**ALTA — PARCIALMENTE MITIGADO** (30/05/2026): lazy materialización al abrir calendario (`ensureMaterializacionVisMes` en `grillaMesAgenteCore.js`). UI muestra **NL** para `no_laborable`. Requiere deploy functions + hosting y re-aprobar o rematerializar Sala si `vis_*` ya quedó con datos viejos.

### Síntoma (UI)

En **Grilla Operativa → pestaña Calendario licencias**, al abrir tarjetas de:

| Tarjeta | Comportamiento reportado |
|---------|---------------------------|
| **Titular (mi caso)** | Turno vacío — no carga datos |
| **Oficina PERSONAL** | Turno vacío — no carga datos |
| **Portería** | Turno vacío — no carga datos |

Captura de referencia: pantalla de selección de tarjetas (mes anterior / actual / próximo) con las cuatro filas visibles; el fallo se manifiesta **al abrir** la grilla mensual del modal.

### Contexto técnico (hipótesis, no cerrada)

- Lectura vía `useGrillaMesVista` + documentos `vis_*` scoped por `gdt_*` (`buildVisDocumentId` 3 args).
- Oficina / Portería son **multicargo fijo** del piloto (MOSTO): pueden faltar `vis_*` si no hubo materialización post-HLg para ese `gdt` y período, o si el cliente pide `gdt` incorrecto.
- **Titular (mi caso)** usa `resolverGrupoIdInicial` sobre `gruposEquipo` — si el grupo inicial no coincide con el cargo que tiene `vis_*`, la grilla puede verse vacía.
- Relación con **DEUDA-CT-001**: huecos de materialización (mes siguiente sin job) agravan “sin turno” en calendario.

### Piloto de referencia

| Campo | Valor |
|-------|--------|
| Usuario | MOSTO — DNI 28914247 — `per_01KQN9WXFXF69Z9DCT5YNJ3TFZ` |
| HLg Oficina | `hlg_01KQPW6YH9T31JBQHYKGXWH5RW` (fijo Lun–Mié) |
| HLg Portería | `hlg_01KQYMY313QPZQ957WQZZYRX4K` (fijo Jue–Vie) |
| Sala (contraste) | `gdt_01KQA6QCA8TDQK9YBTHKYA4R2V` — **sí muestra datos** |

### Verificación sugerida (QA / ops)

1. `node scripts/verificar-vis-mes-agente.mjs` — MOSTO × Oficina/Portería × mayo/junio 2026.
2. Si faltan docs: `materializar-grupo-mes.mjs` por `gdt` y período.
3. Revisar en red qué `grupo_trabajo_id` envía el callable al abrir cada tarjeta.

### Criterio de cierre (borrador)

- [ ] Titular, Oficina y Portería muestran turno teórico coherente con régimen en mes actual y próximo
- [ ] Causa raíz documentada (datos vs. bug lectura `gdt` vs. materialización)
- [ ] Caso en matriz §4.2 multi-HLG o anexo Grilla Operativa

### Código UI relacionado

- `web/src/features/grilla/GrillaMesLicenciasPanel.jsx`
- `web/src/features/grilla/useGrillaMesVista.js`
- `web/src/pages/GrillaOperativa.jsx`

---

## DEUDA-GO-002 — Sala Internación · paridad visual con Turnos Mensuales

### Estado

**MEDIA — A DEFINIR** (UX / producto).

### Síntoma

**Sala Internación 1** en Calendario licencias **sí es visible y carga**, pero la grilla detallada **no mantiene el formato visual** de la pantalla **Turnos Mensuales** (paleta, celdas, horarios, densidad, leyendas — a confirmar en comparación lado a lado).

### Dirección posible (A DEFINIR)

- ¿Reutilizar componentes de `GrillaMensualEditor` / `PlanGrillaAprobadaTable` en modo solo lectura?
- ¿O alinear tokens CSS y celdas en `GrillaMesEquipoTabla` / `GrillaMesTitularCalendario` sin unificar flujos de edición?

### Referencias

- Turnos Mensuales: `web/src/pages/jefe/PlanTurnoServicioPage.jsx`, `GrillaMensualEditor.jsx`
- Calendario: `GrillaMesEquipoTabla.jsx`, `GrillaMesTitularCalendario.jsx`

### Criterio de cierre (borrador)

- [ ] Criterios de paridad visual acordados con RRHH/jefatura (checklist)
- [ ] Sala Internación cumple checklist en mes actual + próximo

---

## Historial

| Fecha | Evento |
|-------|--------|
| 2026-05-30 | Alta DEUDA-CT-001 (orquestación — MUY IMPORTANTE A DEFINIR) por acuerdo de diseño |
| 2026-05-30 | Alta DEUDA-GO-001 / GO-002 por reporte Grilla Operativa + Calendario (captura piloto) |
| 2026-05-30 | Fix materialización: foto plan prioritaria + normalizar `no_laborable`; lazy `vis_*`; UI NL en calendario |
| 2026-05-30 | Titular: N calendarios por cargo sin selector (`useGrillaMesVista` + `GrillaMesLicenciasPanel`) |
| 2026-05-30 | Handoff cierre: [`HANDOFF_SESION_2026-05-30_CONTINUACION.md`](./HANDOFF_SESION_2026-05-30_CONTINUACION.md) |

---

*Mantenimiento:* actualizar este registro al cerrar cada ítem; enlazar PR y commits en la tabla de historial.
