# Handoff — Cierre C2 CIE-10 + causal Art. 19 · bandeja auditor (2026-07-06)

> **C2 COMPLETO** — merge `feat/1919-c2-cie10-clasificacion` → `master` · tag `v1919-C2-cie10`  
> **UAT:** **VERDE** · caso `sol_01KWWKBEAJQ866ATXZGAB275P1`  
> **Hosting UI:** sin deploy (dev local + callables en piloto)

**Piloto:** https://portal-hospital-v2.web.app · `portal-hospital-v2`  
**Titular UAT:** MOSTO — DNI 28914247 — `per_01KQN9WXFXF69Z9DCT5YNJ3TFZ`

---

## 1. Veredicto UAT — **VERDE**

| Paso | Evidencia | OK |
|------|-----------|-----|
| Art. 16 imputado por auditor | Select bandeja | ✅ |
| Causal Art. 19 imputada (Caja Negra) | `listarCausalLargaBandejaAuditor` | ✅ |
| CIE-10 imputado | `listarCie10BandejaAuditor` | ✅ |
| Dictamen favorable | Toast “Licencia aprobada y consolidada en grilla” | ✅ |
| Grilla día 28/08/2026 | Art. **16 — ENFERMEDAD DE LARGA DURACION** · Aprobada · 1 día | ✅ |

---

## 2. Entregables C2

| Pieza | Detalle |
|-------|---------|
| **CIE-10** | `BandejaAuditorCie10Imputacion` · obligatorio larga · opcional corta |
| **Causal Art. 19** | `BandejaAuditorCausalLargaImputacion` · obligatorio al imputar Art. 16 |
| **Callables** | `listarCie10BandejaAuditor`, `listarCausalLargaBandejaAuditor`, `clasificarSolicitudMedicaAuditor` (+payload `cie10`) |
| **Tests** | 9/9 unit · smoke `med-c2-cie10-clasificacion.mjs` PASS |
| **Deploy** | Solo **Functions** (sin hosting web) |

---

## 3. Backlog activo post-C2

| Ítem | Prioridad sugerida |
|------|-------------------|
| **C3** Señales §5.8 | Operación mesa (countdown incompleta, badges) |
| **C4** Modal historial completo | Complemento P4.3b |
| **P4.4** Causal larga en otros flujos | Ya cubierto en C2 para bandeja Caja Negra |

---

## Changelog handoff

| Fecha | Cambio |
|-------|--------|
| 2026-07-06 | Cierre C2 UAT VERDE — supersedes pausa 2026-07-03 |
