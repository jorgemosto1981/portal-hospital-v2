# Resultado de auditoría técnica (2026-04-28)

## Alcance auditado

- Persona: `per_01KQA2TZ25AY9616DW3YPQJ47E`
- Pantallas: `DatosPersonales` y `DatosLaborales`
- Colecciones revisadas:
  - `personas`
  - `formacion_agente`
  - `declaraciones_grupo_familiar`
  - `consentimientos`
  - `grupos_de_trabajo`
  - `historial_laboral_cargos`
  - `historial_laboral_datos`
  - `historial_laboral_grupos`

## Resultado general

- Funcionamiento de `DatosPersonales`: aceptable para fase actual.
- Funcionamiento de `DatosLaborales`: aceptable para fase actual.
- Integridad referencial principal: sin roturas detectadas en registros auditados.
- Convención de IDs laboral/grupos: alineada a regla V2 (`gdt_<ULID>`) tras migración.

## Correcciones aplicadas durante la sesión

- Conexión de seleccionables a BD real en ambas pantallas.
- Ajuste de visibilidad/uso de campos por nivel HLc/HLg.
- Inclusión de `cfg_categorias` en HLc y backend.
- DDJJ:
  - `estado_declaracion_id` fijo en este módulo en `CFG_DDJJ_03_PRESENTADA`.
  - `declaracion_version` automática correlativa en backend.
- Validación server-side:
  - coherencia `persona_id` entre `HLc -> HLd -> HLg`.
- Normalización de estado de perfil:
  - `personas.estado_perfil_datos_id` por default backend a `cfg_epd_inc` (fallback `cfg_epd_borr`).
  - normalizado caso auditado a `cfg_epd_inc`.

## Estado de datos auditados

- Persona base: existente y consistente.
- Formación: 1 registro válido con FK resuelta.
- DDJJ familiar: versiones correlativas (`1`, `2`) sin duplicados.
- Laboral: cadena `hlc_* -> hld_* -> hlg_*` consistente y con FKs válidas.
- Consentimientos: sin registros cargados aún para la persona auditada.

## Notas de diseño acordadas

- Diferencia válida entre:
  - `cargo_funcional_id` (normativa/designación),
  - `funcion_real_id` (función efectivamente ejercida).
- `consentimientos` queda identificado como módulo de registro de aceptaciones, con desarrollo funcional completo diferido.

## Próximo paso aplicado

Se implementa verificador automático de completitud por `persona_id` para uso operativo RRHH/técnico.
