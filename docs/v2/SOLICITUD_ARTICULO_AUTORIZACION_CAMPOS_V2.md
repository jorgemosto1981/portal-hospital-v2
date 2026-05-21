# Campos `solicitudes_articulo` — autorización Oleada A

**Contrato:** [`RFC_TICKETERA_AUTORIZACION_TOMA_CONOCIMIENTO_V2.md`](./RFC_TICKETERA_AUTORIZACION_TOMA_CONOCIMIENTO_V2.md) §8  
**Código:** `functions/modules/shared/solicitudAutorizacionJerarquicaCore.js`

## Snapshot en alta (A2 — trigger onCreate) ✅

Implementado en `solicitudArticuloPatronBOnCreate.js` tras motor OK.

## Snapshot en alta (detalle)

| Campo | Tipo | Cuándo |
|-------|------|--------|
| `grupo_trabajo_id_ancla` | `gdt_*` | Cliente (obligatorio Patrón B) |
| `version_id_aplicada` | `ver_*` | Cliente / motor |
| `autorizadores_elegibles_ids` | `per_*[]` | Motor §5.2; OR mismo nivel |
| `grupo_autorizacion_id` | `gdt_*` \| null | Grupo donde se encontró autorizador |
| `escalamiento_jerarquico_ids` | `gdt_*[]` | Grupos visitados al subir por `parent_group_id` |
| `autorizacion_rrhh_sustituta` | boolean | `true` si huérfana (sin autorizador en organigrama) |

## Estados TO-BE (flujo normal)

| Transición | `estado_solicitud_id` | MDC |
|------------|------------------------|-----|
| Alta OK | `cfg_esa_en_revision_jefe` | `PROYECTAR_PENDIENTE` |
| Jefe/autorizador **aprueba** | **`cfg_esa_aprobada`** | `CONSOLIDAR_APROBADO` ✅ (`solicitudBandejaJefeCore` A3) |
| Jefe **rechaza** | `cfg_esa_rechazada` | `REVERTIR_PROYECCION` |
| RRHH post-cierre | *(sin cambio)* | TC → campos `rrhh_toma_conocimiento_*` (A4) ✅ |

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
