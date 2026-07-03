# Handoff — Cierre sesión 2026-07-03 · UAT VERDE épica P4 bandeja auditor médica

> **RETOMAR AQUÍ:** merge `feat/1919-p4-visor-auditor` → `master` + commit fixes sesión 03-jul + firma acta RRHH.  
> **UAT bandeja P0/P2/P3:** **VERDE** · caso `sol_01KWKTC9BD5BJQ37TMAGADN1XR`  
> **Índice:** [`PENDIENTES_PROXIMA_SESION.md`](./PENDIENTES_PROXIMA_SESION.md) · Brechas: [`BRECHAS_FUNCIONALES_BANDEJA_AUDITOR_MEDICA_P4_V2.md`](./BRECHAS_FUNCIONALES_BANDEJA_AUDITOR_MEDICA_P4_V2.md)

**Proyecto:** `portal-hospital-v2`  
**Rama:** `feat/1919-p4-visor-auditor` (local: fixes 03-jul **sin commit** al cierre doc)  
**Base remota:** `92cb14e` + `b0186af` (handoff pausa 02-jul)  
**Piloto:** https://portal-hospital-v2.web.app · `portal-hospital-v2` · `southamerica-east1`  
**Titular UAT:** MOSTO, JORGE ANTONIO — DNI 28914247 — `per_01KQN9WXFXF69Z9DCT5YNJ3TFZ`

---

## 1. Veredicto UAT — **VERDE**

| Bloque | Caso / evidencia | Resultado |
|--------|------------------|-----------|
| **§6.1** Visor certificado P0 | `sol_01KWKTC9BD5BJQ37TMAGADN1XR` — `j.jpg` | ✅ |
| **§6.2/P2** Selector artículo imputado | Solo Art. **14** y **16** (sin 64-A tras fix) | ✅ |
| **§6.3** Preview normativo dinámico | Art. 14: 32 d, 19 d previos, tramos 16/100 + 16/60; Art. 16 aviso CIE-10 | ✅ |
| **§6.4** Clasificación + grilla | Favorable auditor → junta → `cfg_esa_aprobada`; modal día 6 ago-2026: **14 — ENFERMEDAD DE CORTA DURACION** | ✅ |
| **GSO multi-sector** | Banner “Licencia gestionada en otro sector (Oficina PERSONAL)” en Sala | ✅ esperado |
| **Historial consumo detallado** en preview | `sol_01KWKVW4SED7ETGKPDMB61ES8Q` — 51 d + acordeón 3 filas | ✅ **Opción A cerrada** |

### Solicitud canónica de cierre UAT

| Campo | Valor |
|-------|--------|
| **sol_id** | `sol_01KWKTC9BD5BJQ37TMAGADN1XR` |
| **Alta** | 2026-07-03 |
| **Reposo** | 2026-07-23 → 2026-08-23 (**32 d**) |
| **Artículo imputado** | `art_01KWH4NM0BW4HKGGWV1NFD599K` (Art. 14) |
| **Flujo** | Auditor favorable (`requiere_junta_medica: true`) → junta favorable → `cfg_esa_aprobada` |
| **licencia_medica** | `consumido_previo_al_aprobar: 19` · tramos `{100:16, 60:16, 0:0}` |
| **Ancla GDT** | `gdt_01KR3H81ENQK84ZK21EQWEQQXG` (Oficina PERSONAL) |

**URL bandeja (histórico):** `/portal/medico/solicitudes?sol_id=sol_01KWKTC9BD5BJQ37TMAGADN1XR`

---

## 2. Ops / saneamiento piloto (misma sesión)

| Acción | Detalle |
|--------|---------|
| Purga solicitudes erróneas 64-A | `sol_0125598C30043100EDFA91CA40` + `sol_01710EDC427CDC9E7F36FA9510` — `purge-solicitudes-med-piloto.mjs --apply` + fan-out huérfanos jul-2026 en los **3 gdt** del titular (`revert-fanout-huerfanos-vis.mjs`) |
| Revert flags LM en duplicado 64-A | `art_01KRDTBZRDSK7K9JAPXCYWYFRC` — `scripts/revert-lm-flag-64a-duplicado.mjs --apply` |
| Fix selector auditor | `esArticuloImputableBandejaAuditorMedico` — solo `codigo_grilla` **LM** / **LM-L** |
| Deploy callables | `listarArticulosLicenciaMedicaAuditor`, `previsualizarClasificacionMedicaAuditor`, `clasificarSolicitudMedicaAuditor` |
| Smoke | Eliminado fallback que contaminaba `es_licencia_medica` en `med-clasificar-junta.mjs` |

**Consumo previo Art. 14 tras purga (2026):** 19 d (`sol_013EE8A16E710808627AC4DBA2` 18 d + `sol_01KW9RZAH9ZP3MXMSNYPC1CYS6` 1 d).

---

## 3. Código pendiente de commit (sesión 03-jul)

| Área | Archivos clave |
|------|----------------|
| Filtro catálogo LM auditor | `shared/utils/licenciaMedicaTramosCore.js`, `listarArticulosLicenciaMedicaAuditorCore.js`, … |
| **Historial LM en preview (Opción A)** | `licenciaMedicaConsumoCortaAnual.js`, `previsualizarClasificacionMedicaAuditorCore.js`, `BandejaAuditorPreviewTramos.jsx` |
| Test | `licenciaMedicaConsumoCortaAnual.test.js`, `previsualizarClasificacionMedicaAuditorCore.test.js`, `licenciaMedicaTramosCore.test.js` |
| Ops | `scripts/purge-solicitudes-med-piloto.mjs`, `scripts/revert-lm-flag-64a-duplicado.mjs` |
| Smoke | `scripts/smoke/med-clasificar-junta.mjs` |

**No commitear:** `scripts/_tmp-*` (debug local).

---

## 4. Próxima sesión (orden sugerido)

1. **Commit** fixes 03-jul en `feat/1919-p4-visor-auditor` (cuando el operador lo pida).
2. **PR / merge** → `master` (rama incluye motor P4 + P4.4 + bandeja P0/P2/P3).
3. **Firma acta** [`ACTA_RRHH_EPICA_1919_P4_V2.md`](./ACTA_RRHH_EPICA_1919_P4_V2.md) (checklist RRHH).
4. **Backlog opcional bandeja:** P1 ficha `ingreso_medico` · ~~P4 historial LM en preview~~ ✅ · P2b fechas editables.
5. **Paralelo producto:** piloto tope post-01/07 (grilla) — ver [`PENDIENTES_PROXIMA_SESION.md`](./PENDIENTES_PROXIMA_SESION.md).

---

## 5. Referencias

| Documento | Rol |
|-----------|-----|
| [`HANDOFF_SESION_2026-07-02_PAUSA_BANDEJA_AUDITOR_P4_V2.md`](./HANDOFF_SESION_2026-07-02_PAUSA_BANDEJA_AUDITOR_P4_V2.md) | Pausa implementación P0/P2/P3 (histórico) |
| [`ACTA_RRHH_EPICA_1919_P4_V2.md`](./ACTA_RRHH_EPICA_1919_P4_V2.md) | Acta institucional — pendiente firma |
| [`CHANGELOG_1919.md`](./CHANGELOG_1919.md) | Tag / hito UAT VERDE bandeja |

---

## Changelog sesión

| Fecha | Nota |
|-------|------|
| 2026-07-03 | UAT VERDE `sol_01KWKTC9BD5BJQ37TMAGADN1XR` — §6.1/§6.3/§6.4 |
| 2026-07-03 | Purga 2 solicitudes 64-A espurias; fix selector LM; deploy callables |
| 2026-07-03 | **Opción A historial LM** | Preview auditor: `historial_consumo_corta` + acordeón UI — UAT visual `sol_01KWKVW4SED7ETGKPDMB61ES8Q` (51 d, 3 filas) |
| 2026-07-03 | Cierre doc sesión P4 bandeja auditor |
