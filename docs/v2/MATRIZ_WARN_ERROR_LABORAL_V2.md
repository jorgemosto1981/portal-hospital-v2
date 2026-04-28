# Matriz final warning/error laboral (V2)

Estado: **actualizada** según acuerdos funcionales 2026-04-28.

## Criterio aplicado

- Integridad referencial y estructura mínima de carga: **error bloqueante** (`HttpsError`).
- Paralelos/solapes en vigencias: **permitidos** y registrados como **warning**.

## Resultado final

- **Error (bloquea guardado)**
  - `VAL-HLC-001`: falta `fecha_desde` en HLc.
  - `VAL-HLC-003`: rango inválido en HLc.
  - `VAL-HLC-004`: `fecha_hasta` informada sin `causal_fin_asignacion_id`.
  - `VAL-HLD-001`: cadena persona inconsistente entre HLd y HLc.
  - `VAL-HLD-002`: faltan obligatorios estrictos en HLd.
  - `VAL-HLG-001`: cadena persona inconsistente entre HLg y HLd.
  - `VAL-HLG-005`: rango inválido en HLg.
  - `VAL-HLG-006`: HLd sin `cargo_id` para cadena HLg->HLd->HLc.
  - `VAL-HLG-007`: faltan obligatorios base en HLg.
  - `VAL-HLG-010`: falta `fecha_inicio` en HLg.
  - `VAL-HLG-013`: `carga_por_dia_semana` vacía o ausente.
  - `VAL-HLG-015`: `carga_por_dia_semana` sin `dia_semana_id` por item (modo numérico no permitido).

- **Warning (no bloquea guardado)**
  - `VAL-HLC-W001`: solape de vigencia HLc para misma persona (paralelo permitido, revisar operativamente).
  - `VAL-HLG-W002`: solape de vigencia HLg para misma persona+grupo (paralelo permitido, revisar operativamente).
  - `VAL-HLC-W005`: cargo activo sin grupo de trabajo asignado aún.
  - Warning de reconciliación de carga horaria (`buildWarningReconciliacionCarga`): diferencia entre carga semanal informada y carga total del HLc.

## Nota de implementación

Esta matriz quedó implementada en `functions/modules/catalogosLaborales.js`.
