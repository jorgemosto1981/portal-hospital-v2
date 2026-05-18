# Handoff sesión 2026-05-18 — Check-in de saldos RRHH (patrones A/B/C)

**Rama:** `feature/ticketera-puente-campos-config` (u homóloga activa)  
**Estado:** **Validado en BD** (piloto: LAO 2024/2025, art. 64-A ciclo 2026, cierre global).  
**Relación:** [`RFC_SALDOS_PATRONES_ABC_V2.md`](./RFC_SALDOS_PATRONES_ABC_V2.md) · [`PLAN_LAO_BOLSAS_CHECKIN_SOLICITUD_V2.md`](./PLAN_LAO_BOLSAS_CHECKIN_SOLICITUD_V2.md) · [`FLUJO_ONBOARDING_RRHH_ALTA_AGENTE_V2.md`](./FLUJO_ONBOARDING_RRHH_ALTA_AGENTE_V2.md)

---

## 1. Objetivo de la tanda

Pantalla unificada de **check-in de saldos** para RRHH: fotografía inicial por agente (año A, HLC, patrones A/B/C), guardado parcial por categoría, precarga desde Firestore, **check-in nuevo vs rectificación**, y **cierre global** de la persona.

**Ruta web:** `/portal/rrhh/checkin-saldos` (alias legado `/portal/rrhh/lao-checkin` → misma página).

---

## 2. UI — Flujo operador

| Paso | Pantalla |
|------|----------|
| 1 | Seleccionar **agente** (`per_*`) — al cambiar agente se **reinicia** el formulario |
| 2 | **Año de corte A** (go-live portal) |
| 3 | Confirmación **HLC** (solo check-in **nuevo**) |
| 4 | Si hay check-in previo → elegir **Check-in nuevo** o **Rectificación** |
| 5 | Pestañas: **LAO Disponibles (A)** · **Ciclos anuales (B)** · **Cuenta continua (C)** |
| 6 | **Guardado parcial** por pestaña (solo filas/artículos informados) |
| 7 | **Finalizar check-in global** (modal resumen en 2 pasos) — solo modo nuevo |

**Rectificación:** no exige HLC de nuevo; no reabre cierre global; solo actualiza bolsas que se guardan en esa sesión. Conserva `version_id_origen` / `codigo_grilla` cuando la bolsa ya existía.

**Patrón B:** tabla por artículo vigente; año ciclo = **A** (solo lectura); columnas *días usados* y *saldo inicial*; cupo del configurador al informar días (carga lazy de metadatos por pestaña).

---

## 3. Callables (Functions, `southamerica-east1`)

| Callable | Uso |
|----------|-----|
| `obtenerSaldosCheckinPersona` | Precarga bolsas (`persona_id`, `anio_corte_a`) — Admin SDK |
| `persistirCheckinLaoBolsas` | Patrón A — `rectificacion_saldo`, `forzar_recarga_global` |
| `persistirCheckinSaldoEstandar` | Patrones B y C — mismo flags |
| `cerrarCheckinGlobal` | Cierre global (`checkin_saldos_portal_en`) — **usar este nombre en cliente** |
| `cerrarCheckinSaldosPortal` | Legacy — servicio Cloud Run con IAM roto en primer deploy; no usar desde web |

**Campos persona relevantes**

| Campo | Significado |
|-------|-------------|
| `anio_corte_portal_a` | Año A |
| `checkin_lao_registrado_en` | Check-in LAO realizado (histórico) |
| `checkin_saldos_portal_en` | Check-in global cerrado |

---

## 4. Persistencia Firestore

- Colección: `saldos_articulo_agente`
- LAO: `sal_{anio_origen}_per_{ULID}` — bolsas por año &lt; A
- Patrón B: `sal_{A}_per_{ULID}` — bolsa por artículo, `anio_origen === A`
- Patrón C: `sal_global_per_{ULID}` — `bol_{art}_global`

Helpers: `shared/utils/laoSaldosBolsa.js` (sincronizado a `functions/modules/shared/` en deploy).

---

## 5. Código web (referencia rápida)

| Área | Ruta |
|------|------|
| Página | `web/src/pages/CheckinSaldosAgente.jsx` |
| Hook | `web/src/features/checkinSaldos/useCheckinSaldosPage.js` |
| Patrones | `resolvePatronSaldo.js`, `useArticulosPorPatron.js`, `parseSaldosCheckinPrecarga.js` |
| Callables cliente | `web/src/services/callables.js` |

Menú RRHH: ítem `checkin-saldos` en `modulosEstado.js`.

---

## 6. Validación operativa (2026-05-18)

- Cierre global: OK (`cerrarCheckinGlobal`)
- Actualización bolsas LAO y artículo **64-A**: OK en BD
- Piloto histórico: persona con bolsa 2024 con consumo (27 d) — rectificación vía flags anteriores

---

## 7. Backlog y mejoras

Tareas priorizadas (oleadas 1–3), decisiones de producto y registro de avance: [`CHECKIN_SALDOS_BACKLOG.md`](./CHECKIN_SALDOS_BACKLOG.md).

---

## 8. Pendientes / no incluido en esta tanda

- Panel agente «Mis saldos» (`obtenerResumenSaldosAgente`) — doc D3
- Ajuste RRHH `cfg_esa_ajuste_rrhh` — Caso borde 7
- Job cierre ciclo Patrón B (`cfg_esb_expirado`)
- Wizard único que encadene automáticamente laboral + check-in (ver flujo propuesto en [`FLUJO_ONBOARDING_RRHH_ALTA_AGENTE_V2.md`](./FLUJO_ONBOARDING_RRHH_ALTA_AGENTE_V2.md))

---

## 9. Deploy

```bash
npm run firebase:deploy:functions
# o selectivo:
# persistirCheckinLaoBolsas, persistirCheckinSaldoEstandar, obtenerSaldosCheckinPersona, cerrarCheckinGlobal
```

Tras cambios en `shared/`: `node scripts/sync-shared-to-functions.mjs` (predeploy automático).
