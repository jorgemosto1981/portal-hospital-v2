# Handoff Sesión 2026-05-13 — Ticketera Puente MVP

## Resumen ejecutivo

En esta sesión se diseñó y documentó el plan completo de la **Ticketera Puente**: un objetivo intermedio que digitaliza el circuito de solicitudes y autorizaciones del hospital sin reemplazar la BD de RRHH actual.

## Estado al cierre

- **Rama activa:** `feature/articulos-v2-triple-layer`
- **Commit HEAD:** `1b05b34` (feat: refactorizacion UX/UI RRHH-First del configurador)
- **Working tree:** limpio
- **Tag de backup:** `checkpoint/pre-ticketera-puente-2026-05-13` (creado en este handoff)
- **Nueva rama para implementar:** `feature/ticketera-puente-campos-config`

## Planes generados (archivos)

1. **Plan maestro de la ticketera:**
   - Ubicación: `~/.cursor/plans/ticketera_puente_mvp_538a748a.plan.md`
   - Contenido: 23 pasos en 4 fases, todos los flujos, reglas transversales, decisiones cerradas

2. **Plan de ejecución inmediata (configuración de artículos):**
   - Ubicación: `~/.cursor/plans/completar_config_artículos_51cb7fad.plan.md`
   - Contenido: campos nuevos a agregar al schema/UI + módulos nuevos (feriados, incompatibilidades, SLA)

## Decisiones cerradas en esta sesión

| Decisión | Resultado |
|----------|-----------|
| Ciclo de vida post-aprobación | NO hay estados automáticos. Filtros de vigencia por consulta (fecha_desde/hasta vs hoy) |
| Tickets abandonados | Solo dashboard/alertas para RRHH. NO se cancelan automáticamente |
| Historial de login del jefe | NO se implementa |
| Licencias médicas "a determinar" | Quedan en espera del médico sin timeout |
| Circuito de ingreso | Array en el documento de versión (campo_array, no subcolección) |
| Alcance primera tanda config | Todo junto: campos + feriados + incompatibilidades + SLA |
| Onboarding | Manual de a pocos. Masivo cuando haya experiencia |
| Testing strategy | A analizar antes de Fase A |
| `antiguedad_al_checkin` | **ELIMINADO.** Antigüedad siempre dinámica desde HLC via `calcularAntiguedad()`. Nunca se almacena en el checkin. (Sesión 2026-05-14) |
| Prerequisito HLC para checkin | **OBLIGATORIO.** HLC completas (vigentes + históricas) deben estar cargadas antes del checkin. RRHH confirma con checkbox. (Sesión 2026-05-14) |
| Checkin = puerta de ingreso | **SÍ.** El checkin es el acto formal de activación del usuario en el portal (migrados con historial, nuevos sin historial — mismo proceso). (Sesión 2026-05-14) |
| antiguedadCalculator fuente única | `shared/utils/antiguedadCalculator.js` (ESM) es la fuente de verdad. Functions usa copia CJS auto-generada por `scripts/sync-shared-to-functions.mjs`. (Sesión 2026-05-14) |

## Próximo paso exacto (para retomar)

**Implementar campos nuevos en el configurador de artículos, uno por uno con aprobación del usuario.**

Primer campo aprobado para implementar: **`circuito_ingreso_ids`**

Detalles:
- Schema: `bloqueWorkflowSlaCoberturaSchema` → `circuito_ingreso_ids: z.array(cfgRowIdSchema).min(1)`
- UI: Pestaña "Avanzado", sección "Workflow y preaviso", grupo de checkboxes
- Label: "Roles habilitados para crear ticket"
- HelpText: "Definí qué roles pueden iniciar una solicitud de este artículo..."
- Default form: `[]`
- Widget nuevo: `FieldMultiCheck`
- Hook: Agregar `cfg_circuito_ingreso` a `DEFAULT_CATALOGOS_ARTICULOS_FORM`

## Lista completa de campos nuevos pendientes (después de circuito_ingreso)

1. ~~`circuito_ingreso_ids`~~ → PRIMERO (aprobado)
2. `unidad_minima_consumo_id` — FK cfg_unidad_medida_articulo
3. `tipo_fraccionamiento_id` — FK cfg_tipo_fraccionamiento (complementa boolean existente)
4. `max_periodos_fraccionamiento` — Number (cuántas veces se puede partir)
5. `dias_minimos_por_periodo` — Number (mínimo por vez)
6. `politica_superposicion_id` — FK cfg_politica_superposicion
7. `es_licencia_medica` — Boolean (activa Caja Negra)
8. `categoria_medica_generica_id` — FK (solo si es_licencia_medica)
9. `permite_retroactividad` — Boolean
10. `sla_jefe_horas` — Number
11. `sla_rrhh_horas` — Number
12. `requiere_adjunto_digital` — Boolean (bloquea envío sin archivo upload)

## Módulos enteros nuevos pendientes

- Calendario de feriados (CRUD `cfg_calendario_feriados_institucional`)
- Editor de incompatibilidades (grafo `cfg_articulo_relaciones`)
- Configuración de SLA por paso

## Regla de oro acordada

> Implementar campo por campo: proponer → usuario revisa → aprueba o no → siguiente.

## Campos que YA EXISTEN (no agregar de nuevo)

- `fraccionamiento_habilitado` (boolean) — ya en schema + UI
- `toma_conocimiento_limitada` + `niveles_burbujeo` — ya cubren "requiere superior"
- `requiere_doc_previa` / `requiere_doc_posterior` — documentación papel/plazo
- `nivel_ocupacion_dia_id` — cómo se registra el día en grilla
- `logistica_aviso_habilitada` — señal de cobertura
- `plazo_preaviso_normativa_dias` / `plazo_preaviso_interno_dias` — anticipación

## Archivos clave del configurador actual

- `web/src/features/configuracion/articulos/ArticuloConfigTabs.jsx` — UI principal (3 tabs)
- `web/src/schemas/articulo.schema.js` — Schema Zod (7 bloques)
- `web/src/features/configuracion/articulos/articuloLabels.js` — Labels
- `web/src/features/configuracion/articulos/fieldWidgets.jsx` — Widgets (Text, Number, Check, Select, Color)
- `web/src/hooks/useCatalogosArticulos.js` — Hook que carga catálogos en batch
- `web/src/constants/catalogosArticulosV2.js` — Lista de 35 colecciones cfg_*
- `docs/v2/SEED_CATALOGOS_ARTICULOS_V2.json` — Filas de catálogos

## Contexto de la conversación

- UUID conversación: `ba8632b2-c64d-4404-98b8-6e208ea006cc`
- El plan maestro de la ticketera tiene ~960 líneas con todo el diseño funcional
