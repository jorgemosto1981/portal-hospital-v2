# Handoff sesión 2026-05-15 — LAO 2024 (guía), bolsas, check-in y plan maestro

> **Continuación técnica / smoke (2026-05-16):** [`HANDOFF_SESION_2026-05-16.md`](./HANDOFF_SESION_2026-05-16.md) — grilla «ver versiones», callable, check-in merge fix, scripts smoke, pausa.

## Resumen ejecutivo

Sesión de **producto y documentación** (sin implementación de motor/check-in): guía campo a campo para artículo **LAO año 2024**, alineación de política de **bolsas por año**, definición de **check-in vs antigüedad**, y cierre de reglas de **solicitud** y **FIFO**. Se generó plan maestro persistente en repo para continuar desde otra PC.

## Estado al cierre

| Ítem | Valor |
|------|--------|
| Rama | `feature/ticketera-puente-campos-config` |
| Último commit previo a este handoff | `ab2a1e5` — docs(ticketera): UAT 64-A… |
| Working tree (antes del commit de cierre) | Cambios locales en configurador (`ArticuloConfigTabs.jsx`, `articuloLabels.js`, `articulo.schema.js`) + docs nuevos |
| Etapa | **LAO 2024 auditado**; regla **A** en check-in; **RFCs implementados** (callables + trigger); pendiente UI ticketera y versiones RRHH 2023/A |

## Contexto de la conversación

- Objetivo inicial: crear artículo **LAO 2024** con guía tipo **64-A** ([`HANDOFF_SESION_2026-05-14.md`](./HANDOFF_SESION_2026-05-14.md)), revisando documental y módulo configuración **sin codificar**.
- Evolución: definición operativa de **saldos**, **check-in** (años históricos) y **acreditación por antigüedad** (desde go-live).

## Decisiones de producto cerradas

### Saldos y bolsas

- Una bolsa por **`anio_origen`** en `saldos_articulo_agente` (`sal_YYYY_per_…`).
- **Sin vencimiento** hasta agotar (`cfg_cad_nunca`, `fecha_vencimiento` null en bolsa).
- **Sin reinicio automático** de cupo (`cfg_rcc_nunca`): cada año es otra bolsa hasta cero.
- **Origen:** años históricos vía **check-in** (`cfg_os_externo_informado`, `es_arrastre: true`); desde año **A** cupo por **antigüedad + matriz** (`cfg_os_interno` en bolsa acreditada).

### Año A (corte check-in vs motor)

- **A = año calendario de go-live del portal** — **confirmado RRHH 2026-05-15** (regla cerrada).
- **Valor numérico de A:** **no** se fija por adelantado en documentación ni config estática; se **indica al realizar el check-in** (mismo acto de activación del agente).
- **Copy acordado en check-in (orientación RRHH):** *«A partir del año **A** inclusive en adelante…»* → acreditación por motor/antigüedad; años **&lt; A** → carga histórica de bolsas en check-in.
- Ejemplo ilustrativo: si en check-in **A = 2026** → check-in solo **≤ 2025**; motor **≥ 2026**.
- **Opción 1** explícita: check-in **no** carga años **≥ A**.

### Solicitudes LAO

- **Una solicitud = un solo `anio_origen_bolsa`.** No repartir un `sol_*` entre varias bolsas/años (evitar errores). Si necesita dos años → **dos solicitudes**.
- **FIFO** acotado a **elección de año** (sugerir/bloquear año más antiguo con saldo); **no** consumo multi-año en un trámite (descartado E.3 multi-bolsa).

### Configurador (valores acordados para LAO)

| Concepto | Catálogo |
|----------|----------|
| Criterio de descuento | `cfg_rcd_habiles_compuesto` (hábiles + feriados institucionales) |
| Reinicio bolsa | `cfg_rcc_nunca` |
| Origen (artículo) | `cfg_os_interno` |
| Caducidad | `cfg_cad_nunca` |
| Es LAO | `es_lao_anual: true` + matriz + `correspondencia_anio` (ej. 2024) |
| Corte antigüedad | 31/12 (Art. 40, doc V2) |

## Documentos creados / actualizados en esta sesión

| Archivo | Rol |
|---------|-----|
| [`PLAN_LAO_BOLSAS_CHECKIN_SOLICITUD_V2.md`](./PLAN_LAO_BOLSAS_CHECKIN_SOLICITUD_V2.md) | Plan maestro estable (bolsas, check-in, solicitud, RFCs, pruebas T1–T6) |
| [`HANDOFF_SESION_2026-05-15.md`](./HANDOFF_SESION_2026-05-15.md) | Este handoff |
| [`README.md`](./README.md) | Enlaces en índice |

Plan Cursor (copia de trabajo): `lao_bolsas_y_check-in` en `.cursor/plans` del IDE (sincronizar con el doc en repo).

## Brecha técnica

| Tema | Estado repo |
|------|-------------|
| Check-in → saldos | Callable [`persistirCheckinLaoBolsas`](./RFC_LAO_CHECKIN_SALDOS_V2.md); UI ticketera pendiente |
| Acreditación anual | Callable [`acreditarLaoBolsaAgente`](./RFC_LAO_ACREDITACION_ANUAL_V2.md) + hook publicación versión |
| Resolver versión por año | [`shared/utils/laoVersionResolver.js`](../../shared/utils/laoVersionResolver.js), web [`laoVersionResolverService.js`](../../web/src/services/laoVersionResolverService.js) |
| FIFO + invariante versión | Trigger [`solicitudArticuloLaoOnCreate.js`](../../functions/triggers/solicitudArticuloLaoOnCreate.js) |
| Solicitud UI | [`SolicitudLaoAlta.jsx`](../../web/src/pages/SolicitudLaoAlta.jsx) — auto `ver_*` por `anio_origen_bolsa` |
| Versiones RRHH faltantes | [`LAO_VERSIONES_RRHH_BACKLOG.md`](./LAO_VERSIONES_RRHH_BACKLOG.md) |
| Descuento hábiles rango | Pendiente (preview usa cupo matriz) |
| Matriz Art. 40 + `cfg_*` LAO 2024 | **Auditado** (`ver_01KRNYDP…`) |

Referencias: [`PLAN_LAO_BOLSAS_CHECKIN_SOLICITUD_V2.md`](./PLAN_LAO_BOLSAS_CHECKIN_SOLICITUD_V2.md), [`RFC_LAO_SOLICITUD_VERSION_FIFO_V2.md`](./RFC_LAO_SOLICITUD_VERSION_FIFO_V2.md).

## Artículo LAO 2024 publicado (2026-05-15)

Referencia operativa para check-in histórico, acreditación y solicitudes LAO.

| Campo | Valor |
|--------|--------|
| `articulo_id` | `art_01KRNYDN5WR7RER7MWXRZ817E7` |
| `version_id` | `ver_01KRNYDP14Y5V6F73DFXPBFATM` |
| Ejercicio | **2024** (`correspondencia_anio` = 2024; versión LAO del ejercicio) |
| Uso | Parametrización / bolsas históricas **&lt; A** vía check-in; ver [`PLAN_LAO_BOLSAS_CHECKIN_SOLICITUD_V2.md`](./PLAN_LAO_BOLSAS_CHECKIN_SOLICITUD_V2.md) |

**Configurador:** `/portal/rrhh/configuracion-articulos/art_01KRNYDN5WR7RER7MWXRZ817E7`

**Auditoría RRHH (2026-05-15):** matriz Art. 40, `cfg_*` del plan y publicación — **listo**.

## Guía LAO 2024 — estado

- Versión **2024** publicada y validada en configurador (ids arriba).

## Artículo piloto de referencia (otro trámite)

- **64-A** publicado: ver tabla ids y elegibilidad en [`HANDOFF_SESION_2026-05-14.md`](./HANDOFF_SESION_2026-05-14.md) § «Artículo piloto publicado — 64-A».

## Agenda próxima sesión

1. ~~**Git pull**~~ y lectura de handoff + plan — hecho en PC de retomo.
2. ~~Regla **A**~~ — cerrada; valor numérico **en check-in** + copy *«a partir del año A inclusive en adelante…»*.
3. ~~LAO 2024~~ — publicado y **auditado** (`art_01KRNYDN…` / `ver_01KRNYDP…`).
4. RRHH: publicar versiones [`LAO_VERSIONES_RRHH_BACKLOG.md`](./LAO_VERSIONES_RRHH_BACKLOG.md).
5. UI ticketera: pantalla check-in (callable listo) y selector de bolsas en solicitud LAO.
6. Desplegar Functions (`persistirCheckinLaoBolsas`, `acreditarLaoBolsaAgente`).

## Comandos para otra PC

```bash
git fetch origin
git checkout feature/ticketera-puente-campos-config
git pull origin feature/ticketera-puente-campos-config
```

Luego abrir en el IDE: `docs/v2/HANDOFF_SESION_2026-05-15.md` y `docs/v2/PLAN_LAO_BOLSAS_CHECKIN_SOLICITUD_V2.md`.

## Contexto conversación

- Tema: LAO 2024, bolsas, check-in, solicitud una por año, plan maestro.
- Handoff anterior útil: [`HANDOFF_SESION_2026-05-14.md`](./HANDOFF_SESION_2026-05-14.md) (64-A, check-in puerta de ingreso, HLC obligatorias).
