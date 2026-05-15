# RFC — Solicitud LAO: versión por bolsa + FIFO año

**Estado:** trigger + resolver web implementados. FIFO bloqueo activo en trigger.  
**Plan:** [`PLAN_LAO_BOLSAS_CHECKIN_SOLICITUD_V2.md`](./PLAN_LAO_BOLSAS_CHECKIN_SOLICITUD_V2.md)

---

## Objetivo

1. Una solicitud = un `anio_origen_bolsa`.
2. `version_aplicada_id` coherente con `correspondencia_anio` de la versión (= `anio_origen_bolsa`).
3. FIFO: no permitir año más nuevo si hay saldo en año más viejo.

---

## Invariante (§4.1 MODULO PF)

`correspondencia_anio` (versión) **=** `anio_origen` (bolsa) al originar saldo; en solicitud la versión enviada debe cumplir lo mismo respecto de `anio_origen_bolsa`.

---

## Implementación

| Capa | Comportamiento |
|------|----------------|
| **Web** | `resolvePublishedLaoVersionId(articuloId, anio)` al cambiar `anio_origen_bolsa`; prefill `ver_*` |
| **Trigger** `onSolicitudArticuloLaoMotorValidate` | `assertVersionInvariantForBolsa`; `assertFifoAnioOrigen` antes del motor |
| **MVP UI** | [`SolicitudLaoAlta.jsx`](../../web/src/pages/SolicitudLaoAlta.jsx) — default `art_01KRNYDN…` opcional vía query |

---

## FIFO

- Buscar menor `anio_origen` con `disponible > 0` para el `articulo_id`.
- Si `anio_origen_bolsa` &gt; ese año → rechazo con mensaje claro.

Función: `findOldestAnioOrigenWithDisponible` / `assertFifoAnioOrigen` en `shared/utils/laoSaldosBolsa.js`.

---

## Pendiente

- Selector de bolsas con saldo (no solo input numérico).
- Cómputo hábiles compuesto en rango (descuento ≠ días matriz preview).
