# Handoff — Cierre C3 Señales §5.8 · bandeja auditor (2026-07-06)

> **C3 COMPLETO** — merge `feat/1919-c3-senales-58` → `master` · tag `v1919-C3-senales-58`  
> **UAT:** **VERDE** · casos `sol_01KWWMC56Z44W5EWX3N24ZEYQE` (completa) · `sol_01KWWMD50C6BS1DB302EX9DM2E` (provisoria)  
> **Hosting UI:** sin deploy (dev local + callable listado en piloto)

**Piloto:** https://portal-hospital-v2.web.app · `portal-hospital-v2`  
**Titular UAT:** MOSTO — DNI 28914247 — `per_01KQN9WXFXF69Z9DCT5YNJ3TFZ`

---

## 1. Veredicto UAT — **VERDE**

| Paso | Evidencia | OK |
|------|-----------|-----|
| Tabs Completas / Provisorias / Todas | Segmented control bandeja | ✅ |
| Chip **LISTA** en aviso completo | `sol_01KWWMC56…` | ✅ |
| Chip **PROVISORIA** + countdown | `sol_01KWWMD50…` · plazo 31/08/2026 | ✅ |
| Panel señales en detalle expandido | `BandejaAuditorItemSenales` variant detalle | ✅ |
| Fix `[object Ob]` en etiqueta | Formato Timestamp + ocultar etiqueta en lista | ✅ |
| Orden urgencia provisorias | `escanearBandejaAuditorProvisoriasPorUrgencia` | ✅ smoke |

---

## 2. Entregables C3

| Pieza | Detalle |
|-------|---------|
| **Motor señales** | `shared/utils/bandejaAuditorSenalesCore.js` — badges, countdown, rank urgencia |
| **UI lista** | `BandejaAuditorItemSenales` · tabs vista · chips + countdown |
| **UI detalle** | Panel «Señales del trámite» en ficha expandida |
| **Backend** | Sort provisorias por SLA · DTO `senal_plazo_*` · `vencimiento_plazo_certificado_iso` |
| **Tests** | 8 vitest + 13 node · smoke `med-c3-senales-58.mjs` PASS |
| **Deploy** | Solo **`listarSolicitudesBandejaAuditorMedica`** (sin hosting web) |

---

## 3. Backlog activo post-C3

> **Supersedido 2026-07-06:** C4 cerrado mismo día · ver [`HANDOFF_SESION_2026-07-06_CIERRE_C4_MODAL_HISTORIAL_LM.md`](./HANDOFF_SESION_2026-07-06_CIERRE_C4_MODAL_HISTORIAL_LM.md) y pausa [`HANDOFF_SESION_2026-07-06_PAUSA_EPICA_PRODUCTIVIDAD_BANDEJA_CERRADA.md`](./HANDOFF_SESION_2026-07-06_PAUSA_EPICA_PRODUCTIVIDAD_BANDEJA_CERRADA.md).

| Ítem | Estado |
|------|--------|
| **C4** Modal historial completo | ✅ Cerrado @ `v1919-C4-modal-historial-lm` |

---

## Changelog handoff

| Fecha | Cambio |
|-------|--------|
| 2026-07-06 | Cierre C3 UAT VERDE — señales §5.8 bandeja auditor |
