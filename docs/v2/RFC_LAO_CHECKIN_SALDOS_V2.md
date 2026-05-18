# RFC — Check-in LAO → `saldos_articulo_agente`

**Estado:** callable implementado (`persistirCheckinLaoBolsas`). UI ticketera pendiente.  
**Plan:** [`PLAN_LAO_BOLSAS_CHECKIN_SOLICITUD_V2.md`](./PLAN_LAO_BOLSAS_CHECKIN_SOLICITUD_V2.md)

---

## Objetivo

Persistir bolsas históricas en check-in (años **&lt; A**) con trazabilidad a la versión LAO del ejercicio.

---

## Entrada (callable)

| Campo | Tipo | Obligatorio |
|--------|------|-------------|
| `persona_id` | `per_*` | sí |
| `articulo_id` | `art_*` | sí |
| `anio_corte_a` | number | sí — año A informado en el acto de check-in |
| `hlc_confirmadas_completas` | boolean | sí — debe ser `true` |
| `filas` | array | sí |

Cada fila:

| Campo | Tipo |
|--------|------|
| `anio_origen` | number — **&lt; anio_corte_a** |
| `dias_disponibles` | number ≥ 0 |
| `version_id` | `ver_*` opcional; si falta, se resuelve por `correspondencia_anio` |
| `observacion` | string opcional (auditoría futura en `checkin_portal`) |

---

## Reglas

1. `assertCheckinAnioAllowed(anio_origen, anio_corte_a)`.
2. Versión publicada LAO con `correspondencia_anio === anio_origen`.
3. Bolsa: `es_arrastre: true`, `origen_saldo_id: cfg_os_externo_informado`, `version_id_origen`.
4. Documento `sal_{anio_origen}_per_{ulid}`: si **no existe** → `set` con `merge`; si **ya existe el doc** `sal_*` → usar **`update`** con `bolsas.{bolsaId}` objeto completo (evitar fusión superficial de `set`+`merge` que deje campos antiguos de la bolsa, p. ej. `disponible`).
5. Idempotencia (check-in **nuevo**): si ya existe bolsa mismo `articulo_id` + `anio_origen` y `consumido > 0` → error. Con **`rectificacion_saldo`** o **`forzar_recarga_global`**: actualización controlada (ver `persistirCheckinLaoBolsas.js`).

---

## Copy UI (check-in)

> A partir del año **A** inclusive en adelante, el cupo de LAO se acredita por antigüedad y matriz en el portal (no se carga por check-in).

Constante: `CHECKIN_COPY_ANIO_A` en `shared/utils/laoVersionResolver.js`.

---

## Código

| Pieza | Ruta |
|--------|------|
| Callable | `functions/onCall/solicitudes/persistirCheckinLaoBolsas.js` |
| Utilidades | `shared/utils/laoSaldosBolsa.js`, `shared/utils/laoVersionResolver.js` |
| Resolver DB | `functions/modules/shared/laoVersionResolverDb.js` |

---

## Persistencia en persona

Callable **`cerrarCheckinGlobal`** (cliente web; no usar `cerrarCheckinSaldosPortal` — IAM legacy roto):

- `anio_corte_portal_a` = **A**
- `checkin_saldos_portal_en` = timestamp de cierre global

UI: [`HANDOFF_SESION_2026-05-18_CHECKIN_SALDOS.md`](./HANDOFF_SESION_2026-05-18_CHECKIN_SALDOS.md). Flujo alto nivel alta RRHH: [`FLUJO_ONBOARDING_RRHH_ALTA_AGENTE_V2.md`](./FLUJO_ONBOARDING_RRHH_ALTA_AGENTE_V2.md).
