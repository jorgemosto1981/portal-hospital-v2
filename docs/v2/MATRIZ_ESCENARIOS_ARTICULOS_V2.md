# Matriz de escenarios — Artículos — V2

**Propósito:** relacionar **escenarios operativos frecuentes** con **parámetros y catálogos** que deben existir en `cfg_articulos`, `solicitudes_articulo` y `cfg_*` relacionados. Extiende la tabla del plan integral.

**Fecha:** 9 de mayo de 2026.

**Estado:** **borrador**.

**Referencia principal:** [`MODULO_CONFIGURACION_ARTICULOS_V2.md`](./MODULO_CONFIGURACION_ARTICULOS_V2.md), [`DICCIONARIO_CFG_ARTICULOS_V2.md`](./DICCIONARIO_CFG_ARTICULOS_V2.md).

---

## Mapa rápido (ocho escenarios)

| # | Escenario | Parámetros / catálogos clave |
|---|-----------|------------------------------|
| 1 | Profilaxis / artículo solo para cierto agrupamiento | `filtros_elegibilidad` (`escalafon_ids`, `agrupamiento_ids`, `cargo_funcional_ids`, `efector_ids`, …); exclusión explícita donde no deba mostrarse |
| 2 | Franquicia en horas (p. ej. lactancia) | `cfg_unidad_medida_articulo` = HORAS; límites por período; convivencia con RDA/plantilla |
| 3 | Plazo legal vs margen interno (carga tardía) | Plazo dual legal/interno; catálogo para fuera de término y registro obligatorio en solicitud |
| 4 | Vacaciones + licencia (prioridad / LAO) | `cfg_politica_superposicion`, `articulos_incompatibles_ids`, `prioridad_normativa_id`; eventos hacia RRHH para ajuste LAO |
| 5 | Aprobación parcial / split | `permite_aprobacion_parcial`, `regla_split_remanente_id`, flags de remanente y auditoría; **`variantes_sarh[]`** y `sarh_variante_codigo` cuando el destino depende de código/porcentaje |
| 6 | Jefe ausente + SLA + escalamiento | `cfg_paso_workflow_articulo`: `horas_max_resolucion`, `cfg_accion_vencimiento`, escalamiento y burbujeo |
| 7 | Documentación posterior | Documentación diferida: ancla día posterior al último día de licencia; `cfg_tcp_*`; hábil compuesto; default alerta al vencer |
| 8 | Reemplazo / cupo | `admite_reemplazo`, `dispara_evento_contrataciones`; integración opcional con otros módulos |

---

## Notas transversales

- **Superposición — rango mixto:** por defecto **bloqueo total** de la solicitud hasta que el usuario ajuste el rango (política cerrada en plan).
- **Elegibilidad:** listas blancas por ids; OR entre cargos/grupos vigentes que cumplan filtros.
- **Plazos hábiles compuestos:** ver sección de documentación diferida en [`MODULO_CONFIGURACION_ARTICULOS_V2.md`](./MODULO_CONFIGURACION_ARTICULOS_V2.md) (filtro sustractivo MDC − feriados `cfg_cfi_*`).

---

## Próximo paso

Derillar cada escenario en **casos de prueba documentales** (entrada: datos laborales + solicitud; salida: estado, eventos y flags) al avanzar la implementación, sin ampliar este archivo hasta cerrar inventario SARH.
