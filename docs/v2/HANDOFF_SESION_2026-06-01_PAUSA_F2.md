# Handoff — Pausa implementación (F2 metadata)

**Fecha pausa:** 2026-06-01 (fin de sesión)  
**Rama:** `feat/epic-multi-hlg-fase1-execution` @ **`e349412`** (sincronizada con `origin`)  
**Producción:** https://portal-hospital-v2.web.app  
**SSoT retomar:** [`PENDIENTES_PROXIMA_SESION.md`](./PENDIENTES_PROXIMA_SESION.md) — sección **«PAUSA — retomar aquí»**

---

## Punto exacto de pausa

**Implementación detenida tras:** metadata de materialización en `vis_*` (entregable F2 **2.1** / O-P1-2 parcial).

**No iniciado en esta sesión (siguiente bloque F2):**

- O-P1-1 — Job Cloud Scheduler día 5 materialización M+1
- O-P1-3 — GSO mes M-1 solo lectura desde día 1
- F2.5–2.7 — plan usuario nuevo, rematerializar post-régimen UI, feriado masivo vía rango
- F1 Paso 4 QA formal (matriz §4.2 biblia Multi-HLG)
- Merge rama épica → `master` (decisión equipo)

---

## Commits de la sesión 01/06 (post-smoke F1)

| SHA | Resumen |
|-----|---------|
| `a44b83f` | Fix ticketera: HLg deshabilitada vigente en **fecha de corte inclusiva** |
| `6a4db61` | `materializarRango` + clip batch + wire alta/deshabilitar HLg |
| `04a9e5f` | Docs acta ticketera |
| `e349412` | Metadata `vis_*` (`ultimo_motivo`, `ultimo_rango_materializado`, purge) |

---

## Deploy prod ejecutados en sesión

| Bloque | Functions |
|--------|-----------|
| Ticketera HLg vigencia | `resolverContextoLaboralSolicitud`, validar/preview B·C, triggers LAO/B/C, `simularLaoPreview`, `listarArticulosIngresoAgente` |
| Laboral + materializar | `guardarRegistroLaboralTemporal`, `rrhhDeshabilitarHlg` |
| Metadata vis | `guardarRegistroLaboralTemporal`, `rrhhDeshabilitarHlg`, `listarVistaGrillaMesPorGrupo`, `obtenerVistaGrillaMesAgente` |

**Nota:** `planesTurnoServicio` / `rematerializacion` / `cambiosTurno` **no** redeployados en el último paquete; si RRHH materializa solo por plan mensual, conviene desplegar esas callables antes de confiar en metadata en esos flujos.

---

## Evidencia funcional cerrada (prod)

1. Smoke F1: cierre período Sala, purge HLg CHAPARRO, multicargo Oficina OK (acta en PENDIENTES).
2. Ticketera: selector grupo 01/06 con Portería; 02/06 sin Portería; Patrón C `sol_01KT1QEX2A6NP624ZC8TBMH24A`.

---

## Código nuevo (referencia rápida)

| Módulo | Rol |
|--------|-----|
| `functions/modules/shared/solicitudHlgVigencia.js` | Vigencia solicitud con corte inclusivo |
| `functions/modules/asistencia/materializarRango.js` | Materialización por rango YMD |
| `functions/modules/asistencia/visMaterializacionMetadata.js` | Campos `metadata.*` en `vis_*` |
| `scripts/audit-persona-grupos-fecha.mjs` | Auditoría grupos vigentes + período |

**Tests:** `functions/test/solicitudHlgVigencia.test.js`, `functions/test/visMaterializacionMetadata.test.js`

---

## Workspace local al pausar

Tras `firebase deploy`, el predeploy puede dejar **modificados** archivos en `functions/modules/shared/*` copiados desde `shared/` (sync). **No commitear** salvo cambio intencional en `shared/` + script sync.

```powershell
git checkout -- functions/modules/shared/antiguedadCalculator.js functions/modules/shared/calendarInstitucionalCore.js functions/modules/shared/fechaInstitucionalBa.js functions/modules/shared/fechaLaboralYmd.js functions/modules/shared/hlcOperativo.js functions/modules/shared/hlcVigenciaFecha.js functions/modules/shared/horarioInstitucionalDisplay.js functions/modules/shared/laoSaldosBolsa.js functions/modules/shared/laoVersionResolver.js functions/modules/shared/modoComputoCalendario.js functions/modules/shared/resolvePatronSaldo.js functions/modules/shared/solicitudElegibilidadLaboral.js functions/modules/shared/validarFechasArticulo.js
```

---

## Próxima sesión — orden sugerido

1. **Verificar metadata en prod** — tras alta/deshabilitar HLg o listar sector GSO, inspeccionar `vis_*.metadata.ultimo_motivo` y `ultimo_rango_materializado`.
2. **F2 O-P1-1** — callable + Scheduler materialización M+1 día 5 (§17.2.1 plan).
3. **F2 O-P1-3** — gates lectura GSO M-1 para usuario/jefe.
4. **F1** — Paso 4 QA matriz §4.2 si RRHH disponible.
5. **PR/merge** épica → `master` cuando el equipo apruebe.

---

## Piloto (IDs)

| Concepto | ID |
|----------|-----|
| MOSTO | DNI 28914247 · `per_01KQN9WXFXF69Z9DCT5YNJ3TFZ` |
| Portería | `gdt_01KQA9FVEW53JSNTPGX32NWQ5B` |
| Sala | `gdt_01KQA6QCA8TDQK9YBTHKYA4R2V` |
| CHAPARRO | DNI 27667499 · `per_01KR3HD24AMJ6YX3N7B3GPAZJ4` |
