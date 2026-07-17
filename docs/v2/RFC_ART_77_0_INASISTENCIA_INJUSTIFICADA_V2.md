# RFC — Art. 77-0 Inasistencia injustificada

**Estado:** pausado (átomo 1 · Vía B / `-dev`) · código listo · smoke E2E pendiente · **2026-07-15**  
**Handoff:** [`HANDOFF_SESION_2026-07-15_PAUSA_MODO_JEFE_Y_77_0.md`](./HANDOFF_SESION_2026-07-15_PAUSA_MODO_JEFE_Y_77_0.md)  
**Ámbito:** catálogo `cfg_articulos`, derivación desde rechazo de **autorización**, umbral Ley 8525 art. 53.a → aviso RRHH.  
**Relacionados:** [`RFC_MODO_RESOLUCION_JEFE_CFG_ARTICULOS_V2.md`](./RFC_MODO_RESOLUCION_JEFE_CFG_ARTICULOS_V2.md) · [`LEY_8525_1979_EGAP_SANTA_FE_V2.md`](./LEY_8525_1979_EGAP_SANTA_FE_V2.md) art. 53º · [`GUIA_POLITICA_DIA_VS_TRAMO_JUSTIFICACIONES_V2.md`](./GUIA_POLITICA_DIA_VS_TRAMO_JUSTIFICACIONES_V2.md) §7 (enmienda).

---

## 1. Objetivo

Tratar la **inasistencia injustificada (77-0)** como **efecto colateral automatizado** de un rechazo de autorización en el portal (no como carga manual suelta sin trazabilidad), más:

1. Asiento auditado (`sol_*` hija) con vínculo al trámite rechazado.
2. Doble confirmación del jefe al rechazar (barrera ante rechazos accidentales con impacto legal).
3. Cómputo acumulado 12 meses y **aviso a RRHH** si se supera el umbral EGAP (sin ejecutar el sumario/cesantía en el portal).

---

## 2. Decisiones (átomo 1)

| # | Tema | Decisión |
|---|------|----------|
| 1 | Cuándo nace 77-0 | Solo al **Rechazar** una solicitud con `modo_resolucion_jefe === autorizacion`. |
| 2 | No dispara 77-0 | **Observado** (toma de conocimiento / Art. 63) y cualquier flujo que no sea rechazo de autorización. |
| 3 | Actores | Jefe inmediato (vía rechazo) · RRHH (alta directa). |
| 4 | Diferido | Médico auditor (justificación LM parcial/total → 77-0). |
| 5 | Materialización | `sol_*` hija Patrón B, mismas fechas; `estado` cerrado/aprobado; `modo_resolucion_jefe: ninguno`. |
| 6 | Soft Launch agente | **No** entra en `articulo_ids_etapa1` del wizard agente. |
| 7 | Procedimiento EGAP | El portal **no** inicia cesantía; solo asienta inasistencia y **alerta** a RRHH. |

---

## 3. Identidad catálogo

| Campo | Valor |
|-------|--------|
| `codigo` / grilla | `77-0` |
| `nombre` | `INASISTENCIA INJUSTIFICADA` |
| `es_sancion` | `true` |
| `es_inasistencia` | `true` |
| `es_sin_goce` | `true` |
| `modo_resolucion_jefe` | `ninguno` |
| `circuito_ingreso_ids` | `["CFG_RRHH"]` (alta directa) |
| `accion_saldo_id` | `cfg_as_neutro` (asiento, sin bolsa de licencia) |
| Color UI sugerido | `#B91C1C` |

### Parametría umbral (versión)

En `bloque_workflow_sla_cobertura` (defaults de ley):

| Campo | Default | Nota |
|-------|---------|------|
| `umbral_inasistencias_injustificadas_dias` | `10` | EGAP art. 53.a — **exceder** diez días |
| `ventana_acumulado_meses` | `12` | Doce meses inmediatos anteriores |
| `notificar_rrhh_al_umbral` | `true` | Dispara evento a RRHH |

---

## 4. Campos en `sol_*` hija

| Campo | Descripción |
|-------|-------------|
| `origen_rechazo_sol_id` | `sol_*` de autorización rechazada (null si alta RRHH) |
| `origen_acto` | `rechazo_autorizacion_jefe` \| `alta_rrhh` (luego: `auditor_medico`) |
| `codigo_grilla` | `77-0` (snapshot display) |

---

## 5. Evento umbral → RRHH

Cuando el acumulado de días de solicitudes 77-0 del titular en la ventana supera el umbral:

```text
tipo_evento: ALERTA_77_0_UMBRAL_EXCEDIDO
```

Contrato mínimo del evento (`eventos_ticket` / constantes `TIPO_EVENTO_TICKET`):

| Campo | Valor / rol |
|-------|-------------|
| `tipo_evento` | `ALERTA_77_0_UMBRAL_EXCEDIDO` |
| `titular_persona_id` | Agente afectado |
| `actor_persona_id` | Quién disparó el cruce (jefe / RRHH / sistema) |
| `solicitud_id` | `sol_*` 77-0 que cruzó el umbral (referencia) |
| `metadata.dias_acumulados` | Entero |
| `metadata.umbral_dias` | Entero (config) |
| `metadata.ventana_meses` | Entero (config) |
| `metadata.fecha_hasta_ref` | YYYY-MM-DD del tramo que disparó |

Permite filtrar una futura **bandeja de alertas RRHH** independiente de la ticketera de licencias. Idempotencia: no re-disparar la misma alerta si ya existe evento reciente para el mismo titular+ventana (o flag `alerta_77_0_umbral_notificada_en` en persona / última sol).

---

## 6. Flujo rechazo jefe

1. UI exige checkbox: *«Al rechazar, la inasistencia del agente será injustificada (Art. 77-0). ¿Confirmás?»* → `confirma_injustificada: true`.
2. Callable rechaza origen (reverso saldo + MDC `REVERTIR_PROYECCION`).
3. Alta `sol_*` 77-0 + MDC consolidación.
4. Recomputo acumulado → si umbral excedido → `ALERTA_77_0_UMBRAL_EXCEDIDO`.

---

## 7. Fuera de alcance (átomos siguientes)

- Médico auditor (parcial/total).
- UI completa bandeja alertas RRHH / sumario EGAP.
- Deploy Soft Launch prod sin acta.

---

## Changelog

| Fecha | Cambio |
|-------|--------|
| 2026-07-15 | RFC átomo 1 + contrato evento `ALERTA_77_0_UMBRAL_EXCEDIDO`. |
