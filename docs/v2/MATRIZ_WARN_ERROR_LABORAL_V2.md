# Matriz final warning/error laboral (V2)

Estado: **actualizada** según acuerdos funcionales 2026-04-28.

## Criterio aplicado

- Integridad referencial y estructura mínima de carga: **error bloqueante** (`HttpsError`).
- Paralelos/solapes en vigencias: **permitidos** y registrados como **warning**.

## Resultado final (implementado)

- **Error (bloquea guardado)**
  - `VAL-HLB-001`: colección no habilitada para escritura laboral temporal.
  - `VAL-HLC-001`: falta `fecha_desde` en HLc.
  - `VAL-HLC-002`: faltan obligatorios base en HLc (persona y efectores).
  - `VAL-HLC-003`: rango inválido en HLc.
  - `VAL-HLC-004`: `fecha_hasta` informada sin `causal_fin_asignacion_id`.
  - `VAL-HLC-005`: falta al menos una referencia normativa en HLc.
  - `VAL-HLC-006`: referencia normativa incompleta (tipo de acto, número o fecha).
  - `VAL-HLC-007`: faltan obligatorios funcionales del cargo (vínculo, jornada, estado, escalafón, agrupamiento, categoría, rol, cargo funcional, carga horaria).
  - `VAL-HLD-001`: cadena persona inconsistente entre HLd y HLc.
  - `VAL-HLD-002`: faltan obligatorios estrictos en HLd.
  - `VAL-HLD-003`: rango inválido en HLd (fecha de inicio mayor que fecha de fin).
  - `VAL-HLD-004`: período HLd fuera de vigencia de HLc (inicia antes, queda abierto con HLc cerrado o finaliza después del cargo).
  - `VAL-HLG-001`: cadena persona inconsistente entre HLg y HLd.
  - `VAL-HLG-003`: fecha de inicio de HLg fuera de vigencia del HLc (inicia antes del cargo).
  - `VAL-HLG-004`: período HLg fuera de vigencia de HLc (HLg abierto con HLc cerrado o fin HLg posterior al fin HLc).
  - `VAL-HLG-005`: rango inválido en HLg.
  - `VAL-HLG-006`: HLd sin `cargo_id` para cadena HLg->HLd->HLc.
  - `VAL-HLG-007`: faltan obligatorios base en HLg.
  - `VAL-HLG-010`: falta `fecha_inicio` en HLg.
  - `VAL-HLG-011`: formato inválido en `carga_por_dia_semana` (estructura/horas por día).
  - `VAL-HLG-012`: día de semana repetido en `carga_por_dia_semana`.
  - `VAL-HLG-013`: `carga_por_dia_semana` vacía o ausente.
  - `VAL-HLG-015`: `carga_por_dia_semana` sin `dia_semana_id` por item (modo numérico no permitido).
  - `VAL-HLC-DES-001`: no existe `hlc_id` al intentar deshabilitar ciclo.
  - `VAL-HLC-DES-002`: `motivo_deshabilitacion_id` faltante o inválido (catálogo no vigente/inexistente).
  - `VAL-HLC-DES-003`: ciclo HLC ya deshabilitado (sin `forzar=true`).
  - `VAL-HLC-DES-004`: `fecha_corte` anterior a `fecha_desde` del HLC.
  - `VAL-HLC-DES-007`: `fecha_corte` con formato inválido (debe ser `AAAA-MM-DD`).

- **Warning (no bloquea guardado)**
  - `VAL-HLC-W001`: solape de vigencia HLc para misma persona (paralelo permitido, revisar operativamente).
  - `VAL-HLG-W002`: solape de vigencia HLg para mismo `cargo_id` + mismo `grupo_de_trabajo_id` (warning informativo; permitido entre cargos distintos de la misma persona).
  - `VAL-HLC-W005`: cargo activo sin grupo de trabajo asignado aún.
  - `VAL-HLG-W003` (reconciliación de carga): diferencia entre suma semanal operativa (`HLg`) y carga normativa del cargo (`HLc`), sin bloqueo.
  - `VAL-HLC-DES-W001`: el HLC ya estaba cerrado por fecha; se aplica deshabilitación administrativa.
  - `VAL-HLC-DES-W002`: parte de la cadena `HLd/HLg` ya estaba cerrada antes de la fecha de corte; se conservan esos cierres.
  - `VAL-HLC-DES-W004`: el HLC no tenía `HLd` asociados; se deshabilita únicamente HLC.
  - `VAL-HLC-DES-W005`: había `HLd` asociados pero no `HLg`; se deshabilita la porción existente.

## Alineación UI (B1/B2)

- La UI de `DatosLaborales` expone estos warnings como filtros y conteos auditables.
- Códigos funcionales mostrados:
  - `SOLAPE_CARGO_GRUPO`: equivalente operativo de `VAL-HLG-W002`.
  - `DESVIO_CARGA_NORMATIVA`: warning informativo de reconciliación `HLg` vs `HLc`.
- Ambos se tratan como **informativos/no bloqueantes**; no impiden guardado ni edición.

## Nota de implementación

Esta matriz quedó implementada en `functions/modules/catalogosLaborales.js`.
Reglas auxiliares compartidas de validación (`HLG`) viven en `functions/modules/catalogosShared.js`.

### Convención de redacción de warnings (RRHH)

- Cada warning debe explicar en lenguaje claro: **qué pasó**, **impacto**, y **si requiere acción**.
- Formato de payload:
  - `code`
  - `severity` (`warning`)
  - `message` (texto humano)
  - `details` (ids/conteos/fechas para soporte técnico)
- Ejemplo de estilo correcto:
  - "Parte de la cadena HLd/HLg ya estaba cerrada antes de la fecha de corte. Se conservaron esos cierres."

## Priorizar próximo ajuste en HLd (estado)

- **Completado**:
  - `VAL-HLD-003` implementado en backend (`functions/modules/catalogosLaborales.js`).
  - `VAL-HLD-004` implementado en backend mediante helper compartido (`functions/modules/catalogosShared.js`).
  - Prevalidación temprana en frontend (`web/src/pages/datos-laborales/formLogic.js`) alineada a contención temporal contra cargo.
- **Siguiente recomendación**:
  - Ejecutar pasada funcional guiada con casos límite de fechas (HLc abierto/cerrado, HLd abierto/cerrado) para validar experiencia de mensaje en UI.
