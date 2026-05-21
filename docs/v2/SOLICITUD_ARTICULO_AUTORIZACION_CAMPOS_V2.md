# Campos `solicitudes_articulo` — autorización Oleada A

**Contrato:** [`RFC_TICKETERA_AUTORIZACION_TOMA_CONOCIMIENTO_V2.md`](./RFC_TICKETERA_AUTORIZACION_TOMA_CONOCIMIENTO_V2.md) §8  
**Código:** `functions/modules/shared/solicitudAutorizacionJerarquicaCore.js`

## Snapshot en alta (A2 — trigger onCreate)

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
| Jefe/autorizador **aprueba** | **`cfg_esa_aprobada`** | `CONSOLIDAR_APROBADO` |
| Jefe **rechaza** | `cfg_esa_rechazada` | `REVERTIR_PROYECCION` |
| RRHH post-cierre | *(sin cambio)* | TC → campos `rrhh_toma_conocimiento_*` (A4) |

**No** usar `cfg_esa_en_revision_rrhh` en solicitudes nuevas del flujo 64-A/B TO-BE.

## Códigos de error (A0)

| Código | Uso |
|--------|-----|
| `ELEG_SIN_HLG` | Titular sin HLg vigente en ancla (H5 / preview) |
| `PERMISOS_JERARQUICOS_CAMBIADOS` | Revisor ya no ∈ `autorizadores_elegibles_ids` al aprobar |
| `ORGANIGRAMA_CICLICO` | Ciclo en `parent_group_id` |
| `GRUPO_ANCLA_INVALIDO` / `FECHA_REF_INVALIDA` / `TITULAR_INVALIDO` | Entrada inválida al resolver |

Definición: `functions/modules/shared/solicitudAutorizacionCodigos.js`.
