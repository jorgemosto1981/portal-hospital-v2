# MVP fase 1 (onboarding) — catálogos `cfg_*` y servicios

## Ya seeds / panel (sin nuevas colecciones en esta fase)

- `cfg_provincia`, `cfg_localidad` — domicilio (IDs en documento; `cfg_localidad.provincia_id` valida el par).
- `cfg_parentesco` — DDJJ familiar.
- `cfg_estado_cuenta_acceso` (p. ej. `cfg_eca_activo`, `cfg_eca_onb`, `cfg_eca_pend_reg`) — vía `usuarios_cuenta.estado_acceso`.
- `cfg_estado_perfil_datos` (p. ej. `cfg_epd_comp`, `cfg_epd_borr`) — `personas.estado_perfil_datos_id`.
- `grupos_de_trabajo` (no `cfg_*`) — pre-alta: `grupo_de_trabajo_id` + `nivel_jerarquico` numérico 1–99 (sin `cfg_nivel_jerarquia` — ver módulo laboral).

## Propuesta futura (Database-First) — aún no sembrada

| Colección / campo | Uso | Notas |
|-------------------|-----|--------|
| `cfg_tipo_domicilio` (id, nombre, activo) + `domicilio.tipo_domicilio_id` | Distinguir “legal”, “notificación”, “real” si el hospital lo pide. | Mencionado en Callable `onboardingMvpPasoA` (comentario de servicio). |
| `declaraciones_grupo_familiar` (colección) | Sustituir/empujar el snapshot `onboarding_mvp.ddjj_familiares` hacia el esquema formal de V2. | Hoy el MVP deja el array bajo `personas.onboarding_mvp` por simplicidad. |
| `cfg_estado_declaracion_familiar` o equivalente en `cfg_*` de estados DDJJ | Gobernar vigencia/auditoría de la DDJJ. | Cuando se active la colección `declaraciones_grupo_familiar`. |

## Referencia de flujo

1. `rrhhAltaAgente` → `personas.estado = PENDIENTE_ONBOARDING`, asigna grupo y nivel, crea `usuarios_cuenta` en `cfg_eca_pend_reg`.
2. `vincularCuentaConDni` o `registrarPrimerAcceso` → `metadata.auth_vinculado` + `cfg_eca_onb` (o equivalente) + claims.
3. `onboardingMvpPasoA` / `onboardingMvpDdjjFamiliar` / `onboardingMvpCompletar` → `estado = ACTIVO` + `cfg_eca_activo` + `cfg_epd_comp` (MVP fase 1).
