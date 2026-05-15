# Handoff sesión 2026-05-15 — LAO 2024 (guía), bolsas, check-in y plan maestro

## Resumen ejecutivo

Sesión de **producto y documentación** (sin implementación de motor/check-in): guía campo a campo para artículo **LAO año 2024**, alineación de política de **bolsas por año**, definición de **check-in vs antigüedad**, y cierre de reglas de **solicitud** y **FIFO**. Se generó plan maestro persistente en repo para continuar desde otra PC.

## Estado al cierre

| Ítem | Valor |
|------|--------|
| Rama | `feature/ticketera-puente-campos-config` |
| Último commit previo a este handoff | `ab2a1e5` — docs(ticketera): UAT 64-A… |
| Working tree (antes del commit de cierre) | Cambios locales en configurador (`ArticuloConfigTabs.jsx`, `articuloLabels.js`, `articulo.schema.js`) + docs nuevos |
| Etapa | **Plan LAO cerrado**; pendiente carga RRHH versión LAO 2024 y RFCs de implementación |

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

- **A = año calendario de go-live del portal** (acordado en plan).
- Ejemplo: go-live **2026** → check-in solo **≤ 2025**; acreditación motor **≥ 2026**.
- **Opción 1** explícita: check-in **no** carga años ≥ A.

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

## Brecha técnica (no implementado en sesión)

| Tema | Estado repo |
|------|-------------|
| Check-in → escritura `saldos_articulo_agente` | No existe pantalla/flujo |
| Acreditación anual automática | Solo preview/callable LAO; sin job de apertura de bolsa |
| Descuento en trigger | Usa cupo agregado del preview; falta cómputo hábiles del rango |
| FIFO bloqueo año | UI MVP pide `anio_origen_bolsa` manual ([`SolicitudLaoAlta.jsx`](../../web/src/pages/SolicitudLaoAlta.jsx)) |
| Matriz Art. 40 completa en doc | RRHH debe transcribir escalones al configurador |

Referencias código: [`functions/triggers/solicitudArticuloLaoOnCreate.js`](../../functions/triggers/solicitudArticuloLaoOnCreate.js), [`functions/modules/shared/laoPreviewMotor.js`](../../functions/modules/shared/laoPreviewMotor.js), [`web/src/schemas/articulo.tripleLayer.schema.js`](../../web/src/schemas/articulo.tripleLayer.schema.js).

## Guía LAO 2024 — estado

- Estructura de pestañas documentada en plan (Identidad, matriz, Impacto y saldo, Avanzado).
- **Pendiente RRHH:** cargar filas de matriz desde Decreto 1919/89 Art. 40 y publicar versión 2024 en configurador.

## Artículo piloto de referencia (otro trámite)

- **64-A** publicado: ver tabla ids y elegibilidad en [`HANDOFF_SESION_2026-05-14.md`](./HANDOFF_SESION_2026-05-14.md) § «Artículo piloto publicado — 64-A».

## Agenda próxima sesión

1. **Git pull** en `feature/ticketera-puente-campos-config` y leer este handoff + [`PLAN_LAO_BOLSAS_CHECKIN_SOLICITUD_V2.md`](./PLAN_LAO_BOLSAS_CHECKIN_SOLICITUD_V2.md).
2. Confirmar **A** (año go-live real del hospital).
3. Completar/publicar **versión LAO 2024** en configurador (matriz + `cfg_*` del plan).
4. Priorizar **RFC check-in** vs **RFC solicitud una bolsa + bloqueo FIFO año** según avance ticketera.
5. Opcional: continuar afinado local del configurador (archivos `ArticuloConfigTabs` / labels / schema si quedaron cambios WIP).

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
