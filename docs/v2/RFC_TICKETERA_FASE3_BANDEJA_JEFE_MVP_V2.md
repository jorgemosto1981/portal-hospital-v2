# RFC — Fase 3 MVP: bandeja jefe (solicitudes Patrón B)

**Estado:** implementado en código · **2026-05-19**  
**Plan:** [`PLAN_TICKETERA_V2.md`](./PLAN_TICKETERA_V2.md) § Fase 3

---

## 1. Objetivo

Cerrar el ciclo piloto **64-A / 64-B**: solicitudes en `cfg_esa_en_revision_jefe` visibles para el **jefe inmediato** (HLg) y transición **aprobar → RRHH** o **rechazar** con reverso de saldo Patrón B.

**Fuera de alcance MVP:** burbujeo multi-nivel, SLA, bandeja RRHH completa, notificaciones, LAO.

---

## 2. Seguridad

- Firestore **no** permite `update` en `solicitudes_articulo` al cliente (`firestore.rules`).
- Toda lectura/gestión vía **callables** Admin SDK.

---

## 3. Jerarquía (MVP)

Misma burbuja `grupo_de_trabajo_id` en **HLg** vigente a `fecha_desde` de la solicitud:

- Revisor **más jerárquico** = `nivel_jerarquico` **menor** (1 más alto que 99).
- Puede gestionar si `nivel_jefe < nivel_titular`.
- **RRHH** (`CFG_RRHH` en `roles_hlc_vigentes`): ve **todas** las pendientes (bypass jerarquía).

Ref: [`MODULO_DATOS_LABORALES_V2.md`](./MODULO_DATOS_LABORALES_V2.md) § HLg.

---

## 4. Callables

### 4.1 `listarSolicitudesBandejaJefe`

- Query: `estado_solicitud_id == cfg_esa_en_revision_jefe` (límite 80).
- Filtra por subordinado / RRHH.
- Devuelve: `solicitud_id`, titular, fechas, días, `patron_saldo`.

### 4.2 `resolverDecisionJefeSolicitud`

| Campo | Tipo |
|-------|------|
| `solicitud_id` | `sol_*` |
| `decision` | `aprobar` \| `rechazar` |
| `motivo` | opcional, máx. 500 |

| Decisión | `estado_solicitud_id` | Saldo |
|----------|------------------------|-------|
| `aprobar` | `cfg_esa_en_revision_rrhh` | Sin cambio (descuento ya aplicado al alta) |
| `rechazar` | `cfg_esa_rechazada` | Reverso bolsa si `motor_descuento_aplicado` |

Campos auditoría: `jefe_revision_persona_id`, `jefe_revision_en`, `jefe_motivo`, `motor_reverso_jefe_aplicado`.

---

## 5. UI

- Ruta: `/portal/jefe/solicitudes`
- Menú: grupo **Rol jefe** → **Bandeja solic.**

---

## 6. Deploy

```powershell
firebase deploy --only "functions:listarSolicitudesBandejaJefe,functions:resolverDecisionJefeSolicitud"
```

Hosting: incluir `web` build si se prueba en prod.

---

## 7. Pruebas sugeridas (J1–J4)

| # | Caso |
|---|------|
| J1 | Jefe con subordinado real: ve `sol_*` del subordinado en bandeja |
| J2 | Aprobar → estado `cfg_esa_en_revision_rrhh` |
| J3 | Rechazar → `cfg_esa_rechazada` + saldo bolsa restaurado |
| J4 | Agente sin subordinados: bandeja vacía (no error) |

Piloto: solicitudes F2 (`sol_01KS06Q8…`, `sol_01KS06QV…`) si el revisor cumple HLg o usar RRHH.
