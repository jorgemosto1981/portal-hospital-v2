# Consentimientos — Etapa base (V2)

## Alcance actual

La colección `consentimientos` queda habilitada en modo base para registrar:

- `persona_id`
- `tipo_consentimiento_id`
- `version_id`
- `idioma_id` (opcional)
- `texto_hash` (valor técnico temporal)
- metadatos (`schema_version`, `creado_en`, `actualizado_en`)

## Regla operativa de etapa base

- Esta etapa **no** cierra la aceptación legal completa.
- La aceptación jurídica final (`aceptado`, `aceptado_en`, hash definitivo del texto mostrado) se implementa en un módulo dedicado posterior.

## Criterios técnicos aplicados

- FKs validadas en backend:
  - `persona_id` -> `personas`
  - `tipo_consentimiento_id` -> `cfg_tipo_consentimiento`
  - `version_id` -> `cfg_textos_legales`
  - `idioma_id` -> `cfg_idioma` (si se informa)
- Si `aceptado !== true`, `aceptado_en` se fuerza a `null`.
- Si `texto_hash` no viene informado, se completa temporalmente como `pending_<version_id>`.

## Próxima etapa (profundización)

- Flujo de aceptación legal explícito.
- Hash real del texto legal efectivo.
- Inmutabilidad de aceptación + auditoría de eventos.
