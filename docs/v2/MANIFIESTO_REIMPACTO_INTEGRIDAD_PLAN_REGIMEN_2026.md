# Manifiesto de re-impacto — integridad plan ↔ régimen ↔ calendario

**Fecha:** 2026-06-06  
**Estado:** **✅ CERRADO** — R0–R3 validados en prod · audit US-17 **0 huecos**  
**Contexto:** desconexión auditada US-17 (135 huecos; plan vs `resolverDiaConPreCarga` vs UI) — remediado  
**Acta cierre:** [`HANDOFF_SESION_2026-06-06_CIERRE_US17_REMEDIACION.md`](./HANDOFF_SESION_2026-06-06_CIERRE_US17_REMEDIACION.md)

---

## 1. Principio rector

**SSoT de celda:** `resolverDiaConPreCarga` (+ calendario institucional cuando `impacta_calendario_institucional !== false`).

El plan mensual es **foto derivada server-side**, no documento editable manualmente para regímenes **fijo/rotativo**.

---

## 2. Problema (diagnóstico cerrado)

| Capa | Falla |
|------|--------|
| cfg fijo | `turno_id` null con horario presente |
| Editor web | `generarGrillaDesdeRegimen` sin calendario; subtítulo horarios = unión de catálogo |
| Guardar | `tipo_dia` del cliente pisa `no_laborable` por feriado |
| US-9 | Lee plan crudo; no aplica resolución canonical |
| GSO | Materialización OK; plan y audit desincronizados |

Estado incoherente ejemplo (15/06/2026): `tipo_dia: laborable`, `turno_id: null`, `es_feriado: true`.

---

## 3. Arquitectura objetivo

```
HLg + cfg_regimen + calendario → resolverDiaConPreCarga → plan.agentes[].dias → US-9 / habilitar
```

- **Fijo/rotativo:** servidor regenera todo el mes; cliente solo lectura.
- **Planificado:** jefe edita; servidor aplica calendario y valida US-9.
- **Audit US-17:** misma regla que habilitación.

---

## 4. Cambios por capa (sin compat)

| ID | Capa | Entrega |
|----|------|---------|
| **R0** | Backend | ✅ `enriquecerAgentesDiasPlan`: resolución manda; feriado → `no_laborable`; inferencia `turno_id` desde régimen cuando falte en cfg |
| **R1** | Datos cfg | Parcial — inferencia server-side cubre cfg sin `turno_id`; migración cfg opcional |
| **R2** | Ops | ✅ `scripts/reimpact-plan-mensual-r2.mjs` — re-derivar planes mensuales (`HABILITADO` + `BORRADOR`) |
| **R3** | Ops | ✅ Re-audit 2026-06-06: `total_huecos_celdas = 0` (5 planes HABILITADO) |
| **R4** | QA | ✅ Oficina jun/jul + Sala may/jun/jul — habilitados sin huecos; mayo Sala flujo rechazo→aprobar validado |
| **R5** | UI | Parcial — editor omite huecos fijo/rotativo; `PlanTurnoServicioPage` Enviar/Editar BORRADOR; contador página pendiente alinear |

---

## 5. Reimpacto (ejecutado 2026-06-06)

- Remediación vía **R0 + R2 + flujo RRHH** (no fila a fila manual salvo planificados con deuda real).
- Script R2: regenerar `agentes[].dias` con resolver → persistir (sobrescribe legacy).
- Materialización GSO para fijo: sin rematerialización masiva obligatoria (worker ya usa resolver).

---

## 6. Criterios de done

1. `plan.agentes[].dias` ≡ resolución canonical (± excepciones futuras explícitas).
2. US-17: `total_huecos_celdas = 0` en prod.
3. 15/06/2026 Oficina: `no_laborable` + `es_feriado: true` para fijos.
4. Habilitar plan Oficina jun-2026 pasa US-9 sin edición manual fila a fila.

---

## 7. Riesgos aceptados

- Sobrescritura de fotos de plan ya habilitados (aceptado).
- Planes planificados con deuda real siguen bloqueando US-9 hasta corrección en editor.

---

## 8. Referencias

- [`PLAN_VUELO_US17_INVENTARIO_PLANES.md`](./PLAN_VUELO_US17_INVENTARIO_PLANES.md)
- [`HANDOFF_SESION_2026-06-05_PAUSA_US17_CIERRE.md`](./HANDOFF_SESION_2026-06-05_PAUSA_US17_CIERRE.md)
- [`PLAN_REGIMEN_HORARIO_V2.md`](./PLAN_REGIMEN_HORARIO_V2.md) § feriados

**Última actualización:** 2026-06-06 — R0–R4 cerrados; R5 parcial.
