# Handoff — Cierre C4 Modal historial LM · bandeja auditor (2026-07-06)

> **C4 COMPLETO** — merge `feat/1919-c4-modal-historial-lm` → `master` · tag `v1919-C4-modal-historial-lm`  
> **UAT:** **VERDE** — modal paginado + acordeón preview (local)  
> **Hosting UI:** sin deploy (dev local + callable historial en piloto)

**Piloto:** https://portal-hospital-v2.web.app · `portal-hospital-v2`  
**Titular UAT:** MOSTO — DNI 28914247 — `per_01KQN9WXFXF69Z9DCT5YNJ3TFZ`

---

## 1. Veredicto UAT — **VERDE**

| Paso | Evidencia | OK |
|------|-----------|-----|
| Acordeón preview (5 ítems) | `HistorialLMCollapse` lazy-load | ✅ |
| Botón "Ver historial completo" | Visible cuando `has_more` | ✅ |
| Modal paginado | `HistorialLMModal` · 20/página | ✅ |
| Cargar más en modal | Cursor `off\|N` | ✅ |
| Timeline reutilizada | `HistorialLMFila` | ✅ |

---

## 2. Entregables C4

| Pieza | Detalle |
|-------|---------|
| **Callable** | `page_size`, `cursor`, `total_filtrado`, `next_cursor` en `obtenerHistorialLmTitularBandejaAuditor` |
| **Modal** | `HistorialLMModal` + `useHistorialLmPaginado` |
| **Disparador** | Botón en acordeón (reemplaza expansión inline `ampliado`) |
| **Tests** | 5/5 node `historialLmTitularBandejaAuditorCore.test.js` |
| **Deploy** | Solo **`obtenerHistorialLmTitularBandejaAuditor`** (sin hosting web) |

---

## 3. Épica productividad bandeja — **CERRADA**

Opción C (C1–C4) completa en `master`. Backlog bandeja auditor productividad sin ítems pendientes.

---

## Changelog handoff

| Fecha | Cambio |
|-------|--------|
| 2026-07-06 | Cierre C4 UAT VERDE — modal historial LM paginado |
