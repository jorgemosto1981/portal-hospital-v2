# Registro — Fase documental saldos patrones A/B/C (V2.1)

**Fecha de cierre documental:** 2026-05-16.  
**Fecha cierre D2 (UI ayuda):** 2026-05-16.  
**Estado:** Fase documental **COMPLETADA** · entregable **D2 COMPLETADO** · D3–D6 pendientes de autorización.  
**Rama de referencia:** `feature/ticketera-puente-campos-config` (handoff LAO previo en [`HANDOFF_SESION_2026-05-16.md`](./HANDOFF_SESION_2026-05-16.md)).

**Plan de ejecución vigente:** [`.cursor/plans/saldos_abc_v2.1_e639266a.plan.md`](../../.cursor/plans/saldos_abc_v2.1_e639266a.plan.md) (reemplaza el plan legacy `análisis_saldos_gemini_vs_v2_221a25b9` para código).

---

## 1. Artefactos nucleares (SSoT)

| # | Documento | Rol |
|---|-----------|-----|
| 1 | [`RFC_SALDOS_PATRONES_ABC_V2.md`](./RFC_SALDOS_PATRONES_ABC_V2.md) | Contrato capa contable: matriz A/B/C, persistencia, estados, Callable agente, §7 copy UI, **§10 ciclo consumo/cierre**, **§11 erratas** |
| 2 | [`CASOS_BORDE_SALDOS_V2.md`](./CASOS_BORDE_SALDOS_V2.md) | SSoT casos borde **1–8** (tabla producto ↔ técnica) |
| 3 | [`GUIA_RRHH_SALDOS_V2.md`](./GUIA_RRHH_SALDOS_V2.md) | Manual operativo RRHH (resumen contable, ajustes, retroactivo, export PDF) |
| 4 | [`MODULO_CALENDARIO_FERIADOS_V2.md`](./MODULO_CALENDARIO_FERIADOS_V2.md) | Schema `cfg_cal_YYYY` + ABM feriados/asuetos (Caso 4) |

**Indexación:** los cuatro están enlazados en [`docs/v2/README.md`](./README.md) (índice rápido) y en el encabezado de relaciones del RFC.

---

## 2. Decisiones de producto cerradas (resumen ejecutivo)

| Tema | Decisión |
|------|----------|
| IDs saldo | `sal_YYYY_per_{ULID}` + `bolsas{}` (A/B); `sal_global_per_{ULID}` (C). Sin `cargo_id` en llaves. |
| Patrones | `resolvePatronSaldo(reinicio_ciclo_id, origen_saldo_id, es_lao_anual)` — matriz RFC §1 |
| Consumo | **Al iniciar trámite** (`onDocumentCreated` de `sol_*` = botón Enviar/Iniciar). Aprobar = idempotente. Rechazo/anular = reverso. |
| Año ciclo | `anio_ciclo_consumo` = año(`fecha_desde`) en `America/Argentina/Buenos_Aires` |
| Cierre Patrón B | Job → `cfg_esb_expirado`; fecha en **`cfg_fechas_cierre_ciclo`** **por `reinicio_ciclo_id`** (anual / mensual / diario) |
| Caso 6 | No diferir job por pendientes en jefatura |
| Retro RRHH | Solo con **remanente** en bolsa expirada; si `disponible=0` → ajuste `cfg_esa_ajuste_rrhh` primero |
| Panel agente | Callable `obtenerResumenSaldosAgente`; Rules: agente **no** lee `saldos_articulo_agente` |
| Caso 8 | Fase 1: alerta RRHH; fase 2: recorte + reverso FIFO |

---

## 3. Alineación con código existente (2026-05-16)

| Pieza | Ruta | Alineación doc |
|-------|------|----------------|
| Descuento LAO al iniciar | `functions/triggers/solicitudArticuloLaoOnCreate.js` | `onDocumentCreated` + `cfg_esa_borrador` → valida, descuenta, pasa a `cfg_esa_en_revision_jefe` — coherente con RFC §10.1 |
| IDs / bolsas | `shared/utils/laoSaldosBolsa.js` | `saldoAnualDocId`, `buildBolsaKey` — RFC §2.1 |
| Check-in LAO | `functions/onCall/solicitudes/persistirCheckinLaoBolsas.js` | `update` completo de bolsa en doc existente — PLAN LAO + handoff 2026-05-16 |
| **Ayuda patrones bolsa (D2)** | `web/src/features/configuracion/articulos/` (ver §8) | Modal 3 pestañas + `window.print()`; copy en `ayudaPatronesBolsaSaldo.js` alineado a RFC §7 |

**Brechas código (documentadas, no bloquean contrato):** Patrón B motor, `sal_global_per_*`, `obtenerResumenSaldosAgente`, `cfg_estado_bolsa_saldo` seed, `cfg_fechas_cierre_ciclo`, job expirado, `_debito_origen[]` reverso, `cfg_esa_ajuste_rrhh`.

---

## 4. Catálogos `cfg_*` pendientes de seed (implementación)

| Colección / fila | Uso | Referencia |
|------------------|-----|------------|
| `cfg_estado_bolsa_saldo` | `cfg_esb_activo`, `cfg_esb_agotado`, `cfg_esb_expirado` | RFC §3 |
| `cfg_fechas_cierre_ciclo` | Parámetros por `reinicio_ciclo_id` | RFC §10.3 |
| `cfg_estado_solicitud_articulo` | Fila `cfg_esa_ajuste_rrhh` | Casos borde 7 |
| `cfg_calendario_feriados_institucional` | Docs `cfg_cal_YYYY` | MODULO_CALENDARIO_FERIADOS |

---

## 5. Fases de implementación posteriores (orden acordado)

| Fase | Entregable | Autorización |
|------|------------|--------------|
| **D2** | `ayudaPatronesBolsaSaldo.js` + `AyudaPatronesBolsaModal.jsx` + botón ℹ️ en pestaña **Impacto y Saldo** + export PDF/imprimir | **Completado** 2026-05-16 |
| D3 | `obtenerResumenSaldosAgente` + Rules + UI «Mis saldos» | Pendiente |
| D4 | Patrón B + job expirado + Callable retro RRHH | Pendiente |
| D5 | `sal_global`, check-in universal, ajustes, ABM feriados | Pendiente |
| D6 | Reverso FIFO Caso 3; Caso 8 fase 2 | Pendiente |

---

## 6. Erratas documentales enmendadas (RFC §11)

- **MODULO §8 (histórico):** el remanente del panel agente **no** se calcula en cliente con versión cacheada → Callable servidor (RFC §4). Enmienda en MODULO §8.6.
- **`ayudaPatronesBolsaSaldo.js`:** referenciado como listo antes de existir el archivo → **resuelto** con D2 (2026-05-16).

---

## 8. Entregable D2 — ayuda configurador (implementación web)

**Ubicación UX:** Configurador de artículos (RRHH) → pestaña **Impacto y Saldo** → card *Configuración de la bolsa de días / horas* → botón **ℹ️** (esquina superior derecha de la card).

| Archivo | Responsabilidad |
|---------|-----------------|
| [`web/src/features/configuracion/articulos/ayudaPatronesBolsaSaldo.js`](../../web/src/features/configuracion/articulos/ayudaPatronesBolsaSaldo.js) | Constantes `AYUDA_*`, copy Guía A/B/C, resumen RRHH, casos 1–8; `AYUDA_PATRONES_DOC_VERSION` = `2026-05-16` |
| [`web/src/features/configuracion/articulos/AyudaPatronesBolsaModal.jsx`](../../web/src/features/configuracion/articulos/AyudaPatronesBolsaModal.jsx) | Modal accesible (`role="dialog"`), pestañas, Escape cierra, scroll bloqueado en body |
| [`web/src/features/configuracion/articulos/ayudaPatronesBolsaPrint.css`](../../web/src/features/configuracion/articulos/ayudaPatronesBolsaPrint.css) | `@media print`: oculta chrome UI; imprime solo `.ayuda-patrones-overlay` |
| [`web/src/features/configuracion/articulos/ImpactoSaldoTabSections.jsx`](../../web/src/features/configuracion/articulos/ImpactoSaldoTabSections.jsx) | Estado `ayudaAbierta` / `ayudaTab`; monta modal |

**Pestañas del modal**

| `tabActiva` | Contenido | Fuente doc |
|-------------|-----------|------------|
| `guia` | Patrones A, B, C con viñetas (reseteo / origen) | RFC §7 · `AYUDA_GUIA_PATRONES_BOLSA_SALDO` |
| `rrhh` | Resumen contable, ajustes, retroactivo | `GUIA_RRHH_SALDOS_V2.md` resumido · `AYUDA_RESUMEN_RRHH_SALDOS` |
| `casos` | Casos borde 1–8 (producto + técnico) | `CASOS_BORDE_SALDOS_V2.md` · `AYUDA_CASOS_BORDE_SALDOS` |

**Export PDF:** botón *Imprimir / guardar PDF* → `window.print()`. Pie de impresión: pestaña activa, `AYUDA_PATRONES_DOC_VERSION`, schema `AYUDA_PATRONES_SCHEMA_VERSION` (= 1).

**Prueba manual:** `npm run dev:web` → abrir versión de artículo → Impacto y Saldo → ℹ️ → recorrer pestañas → imprimir.

**Build verificado:** `npm run build` en `web/` (2026-05-16, exit 0).

---

## 9. Inventario git (lote saldos V2.1)

**Commit:** `e6fbbd5` en rama `feature/ticketera-puente-campos-config` — mensaje `docs(saldos): contrato V2.1 A/B/C y ayuda configurador (D2)`.

Rutas del lote acordado (documentación + D2):

```
docs/v2/RFC_SALDOS_PATRONES_ABC_V2.md
docs/v2/CASOS_BORDE_SALDOS_V2.md
docs/v2/GUIA_RRHH_SALDOS_V2.md
docs/v2/MODULO_CALENDARIO_FERIADOS_V2.md
docs/v2/REGISTRO_FASE_DOCUMENTAL_SALDOS_ABC_V2.md
docs/v2/README.md
docs/v2/DICCIONARIO_CFG_ARTICULOS_V2.md
docs/v2/HANDOFF_SESION_2026-05-16.md
docs/v2/PLAN_LAO_BOLSAS_CHECKIN_SOLICITUD_V2.md
docs/v2/MODULO_ARTICULOS_V2_SCHEMA_PRODUCT_FIRST.md
web/src/features/configuracion/articulos/ayudaPatronesBolsaSaldo.js
web/src/features/configuracion/articulos/AyudaPatronesBolsaModal.jsx
web/src/features/configuracion/articulos/ayudaPatronesBolsaPrint.css
web/src/features/configuracion/articulos/ImpactoSaldoTabSections.jsx
web/SCHEMA.md
```

---

## 10. Mapa de lectura para Agent / desarrollador

```
RFC_SALDOS_PATRONES_ABC_V2.md (contrato)
    ├── CASOS_BORDE_SALDOS_V2.md (anomalías 1–8)
    ├── GUIA_RRHH_SALDOS_V2.md (operador RRHH)
    ├── MODULO_CALENDARIO_FERIADOS_V2.md (hábiles)
    ├── PLAN_LAO_BOLSAS_CHECKIN_SOLICITUD_V2.md (LAO específico)
    └── RFC_LAO_* (check-in, solicitud, acreditación)
```

---

## Historial

| Fecha | Cambio |
|-------|--------|
| 2026-05-16 | Cierre fase documental; registro maestro e indexación en README, DICCIONARIO, PLAN_LAO, HANDOFF |
| 2026-05-16 | D2 implementado; §8 detalle web; commit `e6fbbd5`; errata ayuda JS cerrada |
