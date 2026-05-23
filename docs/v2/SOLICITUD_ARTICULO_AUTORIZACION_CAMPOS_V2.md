# Campos `solicitudes_articulo` — autorización Oleada A

**Contrato:** [`RFC_TICKETERA_AUTORIZACION_TOMA_CONOCIMIENTO_V2.md`](./RFC_TICKETERA_AUTORIZACION_TOMA_CONOCIMIENTO_V2.md) §8  
**Código:** `functions/modules/shared/solicitudAutorizacionJerarquicaCore.js`

## Snapshot en alta (A2 — trigger onCreate) ✅

Implementado en `solicitudArticuloPatronBOnCreate.js` tras motor OK.

## Snapshot en alta (detalle)

| Campo | Tipo | Cuándo |
|-------|------|--------|
| `grupo_trabajo_id_ancla` | `gdt_*` | Cliente (obligatorio Patrón B) |
| `grupos_trabajo_involucrados_ids` | `gdt_*[]` | **Trigger** (snapshot HLg a `fecha_desde`) — ✅ [`RFC_SOLICITUD_GRUPOS_TRABAJO_INVOLUCRADOS_V2.md`](./RFC_SOLICITUD_GRUPOS_TRABAJO_INVOLUCRADOS_V2.md) · evidencia [`TICKETERA_EVIDENCIA_2026-05-23_GRUPOS_INVOLUCRADOS_SNAPSHOT.md`](./TICKETERA_EVIDENCIA_2026-05-23_GRUPOS_INVOLUCRADOS_SNAPSHOT.md) |
| `version_id_aplicada` | `ver_*` | Cliente / motor |
| `autorizadores_elegibles_ids` | `per_*[]` | Motor §5.2; OR mismo nivel |
| `grupo_autorizacion_id` | `gdt_*` \| null | Grupo donde se encontró autorizador |
| `escalamiento_jerarquico_ids` | `gdt_*[]` | Grupos visitados al subir por `parent_group_id` |
| `autorizacion_rrhh_sustituta` | boolean | `true` si huérfana (sin autorizador en organigrama) |

## Cierre sustituto RRHH (A4 — huérfana) ✅

Cuando `autorizacion_rrhh_sustituta === true`, el trámite **no** aparece en bandeja jefe; RRHH cierra desde `resolverDecisionRrhhSolicitud` → `resolverDecisionJefeSolicitud` con `{ rrhhSustituto: true }`. El cierre sustantivo reutiliza la misma transición y MDC que jefatura (`cfg_esa_aprobada` + `CONSOLIDAR_APROBADO`).

| Campo | Tipo | Cuándo se escribe | Consulta / auditoría |
|-------|------|-------------------|----------------------|
| `cierre_rrhh_sustituta` | boolean | `true` **solo** al **aprobar** vía cierre sustituto (bandeja RRHH, estado previo `cfg_esa_en_revision_jefe` + `autorizacion_rrhh_sustituta`) | Distingue cierre sustantivo hecho por RRHH sustituto vs cierre por autorizador jerárquico (`cierre_rrhh_sustituta` ausente o `false`) |
| `jefe_revision_persona_id` | `per_*` | Aprobar o rechazar cierre sustituto | Actor del cierre jerárquico (en huérfana = persona RRHH que ejecutó el callable, **puede coincidir con** `titular_persona_id`) |
| `jefe_revision_en` | timestamp | Idem | Fecha del cierre sustantivo |
| `jefe_motivo` | string \| null | Idem | Motivo opcional del formulario bandeja |

**No** usar `rrhh_revision_*` en huérfanas TO-BE: esos campos son del flujo **legacy** (`cfg_esa_en_revision_rrhh`). La toma de conocimiento posterior sigue siendo `rrhh_toma_conocimiento_*` (sin cambiar `estado_solicitud_id`).

**Código:** `functions/modules/shared/solicitudBandejaRrhhCore.js` (`tipoFlujoResolverDecisionRrhh`), `solicitudBandejaJefeCore.js` (opts `rrhhSustituto`).

### Reglas de validación (evitar regresiones)

| Situación | Esperado |
|-----------|----------|
| `autorizacion_rrhh_sustituta` + `en_revision_jefe` + aprobar en bandeja RRHH | OK → `cfg_esa_aprobada`, `cierre_rrhh_sustituta: true` |
| Mismo caso en bandeja jefe | `PERMISSION_DENIED` — “gestionarse desde bandeja RRHH” |
| `autorizacion_rrhh_sustituta` + titular = revisor RRHH | **Permitido** (`revisorPuedeAutorizarJerarquico` + `rrhhSustituto: true`) |
| `autorizacion_rrhh_sustituta: false` + aprobar solo en bandeja RRHH (sin legacy) | `ESTADO_INVALIDO` |
| Legacy `en_revision_rrhh` + aprobar RRHH | `rrhh_revision_*` (sin `cierre_rrhh_sustituta`) |

### Eventos `eventos_ticket` (auditoría)

Origen: callable `resolverDecisionRrhhSolicitud` / núcleo jefe con sustituto. `tipo_evento`: `ESTADO_CAMBIADO` (constante `TIPO_EVENTO_TICKET.ESTADO_CAMBIADO`).

| `accion` (metadata implícita vía campo `accion` del registro) | `estado_anterior_id` → `estado_nuevo_id` | `metadata` recomendada |
|---------------------------------------------------------------|------------------------------------------|-------------------------|
| `rrhh_sustituta_aprobar` | `cfg_esa_en_revision_jefe` → `cfg_esa_aprobada` | `decision: "aprobar"`, `autorizacion_rrhh_sustituta: true`, `cierre_rrhh_sustituta: true`, `articulo_id`, `fecha_desde`, `codigo_grilla`, `motivo` |
| `rrhh_sustituta_rechazar` | `cfg_esa_en_revision_jefe` → `cfg_esa_rechazada` | `decision: "rechazar"`, `autorizacion_rrhh_sustituta: true`, `cierre_rrhh_sustituta: true` *(solo en metadata del evento; el doc `sol_*` no lleva `cierre_rrhh_sustituta` en rechazo)* |

Contraste flujo normal jefe:

| `accion` | Cierre en `sol_*` |
|----------|-------------------|
| `jefe_aprobar` / `jefe_rechazar` | `jefe_revision_*`; **sin** `cierre_rrhh_sustituta` |

Alta huérfana (trigger): `tipo_evento` típico `SOLICITUD_CREADA_REVISION_JEFE` (`patron_b_on_create_ok`); el doc ya trae `autorizacion_rrhh_sustituta: true` y `autorizadores_elegibles_ids: []`.

### Piloto documentado — huérfana (2026-05-22)

**`sol_01KS7G5PV51RKNFRQ527XGV558`** — DNI 28914247 (`per_01KQN9WXFXF69Z9DCT5YNJ3TFZ`), ancla `gdt_01KR3H81ENQK84ZK21EQWEQQXG` (Oficina PERSONAL), `fecha_desde` 2026-10-22, `autorizacion_rrhh_sustituta: true`, MDC `PROYECTAR_PENDIENTE` OK. Tras cierre sustituto en bandeja RRHH, verificar `cierre_rrhh_sustituta: true` y evento `rrhh_sustituta_aprobar`.

## Estados TO-BE (flujo normal)

| Transición | `estado_solicitud_id` | MDC |
|------------|------------------------|-----|
| Alta OK | `cfg_esa_en_revision_jefe` | `PROYECTAR_PENDIENTE` |
| Jefe/autorizador **aprueba** | **`cfg_esa_aprobada`** | `CONSOLIDAR_APROBADO` ✅ (`solicitudBandejaJefeCore` A3) |
| Jefe **rechaza** | `cfg_esa_rechazada` | `REVERTIR_PROYECCION` |
| **Huérfana:** RRHH **aprueba** (cierre sustituto) | **`cfg_esa_aprobada`** + `cierre_rrhh_sustituta: true` | `CONSOLIDAR_APROBADO` ✅ (mismo MDC que jefe; A4) |
| **Huérfana:** RRHH **rechaza** (cierre sustituto) | `cfg_esa_rechazada` | `REVERTIR_PROYECCION` |
| RRHH post-cierre (flujo normal, ya aprobada por jefe) | *(sin cambio)* | TC → campos `rrhh_toma_conocimiento_*` (A4) ✅ |

## E2E Oleada A — referencia TO-BE (2026-05-21)

**Caso limpio (documentación completa + `evt_*`):** [`TICKETERA_EVIDENCIA_2026-05-21_OLEADA_A_AUTORIZACION_TC.md`](./TICKETERA_EVIDENCIA_2026-05-21_OLEADA_A_AUTORIZACION_TC.md)

### `sol_01KS57Y01GDWCZFAS2EFF4JKP7` — flujo normal sin doble aprobación RRHH

| Paso | Estado / evidencia |
|------|-------------------|
| Alta (27667499) | `cfg_esa_en_revision_jefe` · snapshot A2 (`version_id_aplicada`, ancla, autorizadores) |
| Jefe (28914247) 9:25:50 | `cfg_esa_aprobada` · MDC `CONSOLIDAR_APROBADO` · evento `evt_01KS57ZKCX6778J70A6TQ08HJA` (`jefe_aprobar`, grilla 64-A) |
| TC RRHH (28914247) 9:26:01 | `rrhh_toma_conocimiento_*` · **sin** `rrhh_revision_*` · evento `evt_01KS57ZYHK00E8M5XYMY997QG6` |

Licencia: `fecha_desde` `2026-03-21` · 1 día Patrón B.

### `sol_01KS0896610NA49M9G6VABMMEK` — híbrido (solo contraste)

19-may: jefe + **RRHH legacy** (`rrhh_revision_*`). 21-may: TC formal. No usar como plantilla TO-BE (ver evidencia §2).

### `sol_01KS52ZRQHF0MQBDM58XP9Y27Z` — piloto anterior

| Paso | Estado / evidencia |
|------|-------------------|
| Alta agente (27667499) | `cfg_esa_en_revision_jefe` · MDC `PROYECTAR_PENDIENTE` · `asi` PENDIENTE |
| Autorización jefe (28914247) | `cfg_esa_aprobada` · MDC `CONSOLIDAR_APROBADO` · `asi` APROBADO / `64-A` |
| Toma conocimiento RRHH (28914247) | `rrhh_toma_conocimiento_en` registrado · estado sigue `cfg_esa_aprobada` |
| `vis_*` día 21/04/2026 | `#3B82F6` · `cfg_esa_aprobada` |

Jerarquía validada: escala 01 menor / 99 mayor · autorizador = mayor nivel &gt; titular en `gdt` ancla.

**No** usar `cfg_esa_en_revision_rrhh` en solicitudes nuevas del flujo 64-A/B TO-BE.

## Códigos de error (A0)

| Código | Uso |
|--------|-----|
| `ELEG_SIN_HLG` | Titular sin HLg vigente en ancla (H5 / preview) |
| `PERMISOS_JERARQUICOS_CAMBIADOS` | Revisor ya no ∈ `autorizadores_elegibles_ids` al aprobar |
| `ORGANIGRAMA_CICLICO` | Ciclo en `parent_group_id` |
| `GRUPO_ANCLA_INVALIDO` / `FECHA_REF_INVALIDA` / `TITULAR_INVALIDO` | Entrada inválida al resolver |

Definición: `functions/modules/shared/solicitudAutorizacionCodigos.js`.
