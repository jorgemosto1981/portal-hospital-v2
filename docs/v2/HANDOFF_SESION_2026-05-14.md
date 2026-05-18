# Handoff Sesión 2026-05-14 — Configurador de Artículos: Campos Completos + Auditorías + UX

## Resumen ejecutivo

Sesión intensiva de **implementación, auditoría y pulido UX** del Configurador de Artículos V2. Se completaron TODOS los campos pendientes del plan ticketera-puente, se realizaron 3 auditorías de integridad y se mejoró la experiencia de usuario para RRHH. Se corrigió un bug crítico en la grilla de listado.

## Estado al cierre

- **Rama activa:** `feature/ticketera-puente-campos-config`
- **Commit HEAD anterior:** `9938d4e` (docs: handoff sesion 2026-05-13)
- **Working tree:** 10 archivos modificados, pendientes de commit
- **Etapa actual:** CREACIÓN Y PRUEBA DE ARTÍCULOS — el configurador está funcional, se necesita probar cargando artículos reales para afinar el proceso

## Archivos modificados (10)

| Archivo | Cambios |
|---------|---------|
| `web/src/schemas/articulo.schema.js` | +21 líneas: campos nuevos en 5 bloques Zod, validación `correspondencia_anio` con rango `.min(1900).max(2100)` |
| `web/src/features/configuracion/articulos/ArticuloConfigTabs.jsx` | +292 líneas: UI completa de todos los campos nuevos, 3 auditorías UX aplicadas, warnings visuales, auto-activación de adjunto en licencia médica |
| `web/src/features/configuracion/articulos/articuloLabels.js` | +37 líneas: labels humanizados, terminología unificada ("solicitud" en vez de "ticket"), labels con contexto hospitalario |
| `web/src/features/configuracion/articulos/fieldWidgets.jsx` | +261 líneas: componentes `FieldMultiSelect` y `FieldPersonaSearch` nuevos |
| `web/src/hooks/useCatalogosArticulos.js` | +16 líneas: 10 catálogos nuevos, fallback inteligente de labels (titulo_ui → nombre → codigo_interno → id) |
| `web/src/pages/ArticuloListadoGrilla.jsx` | +37 líneas: mejora visual del listado (IDs truncados, chips de versión, inciso normativo) |
| `web/src/services/cfgArticuloVersionService.js` | +9 líneas: FIX CRÍTICO — sincroniza campos de identidad al documento core al guardar |
| `web/src/constants/catalogosArticulosV2.js` | +1 línea: `cfg_unidad_minima_consumo` |
| `functions/modules/shared/constants.js` | +1 línea: `cfg_unidad_minima_consumo` en whitelist de Cloud Functions |
| `docs/v2/SEED_CATALOGOS_ARTICULOS_V2.json` | +38 líneas: catálogo `cfg_unidad_minima_consumo` (Día completo, Medio día, Horas, Minutos) |

## Campos implementados en esta sesión

### Bloque 1 — Identidad y naturaleza
- `es_licencia_medica` (boolean) — con auto-activación de adjunto obligatorio + toast

### Bloque 3 — Elegibilidad y filtros
- `escalafon_ids` (array, FieldMultiSelect → cfg_escalafon)
- `agrupamiento_ids` (array, FieldMultiSelect → cfg_agrupamiento)
- `tipo_vinculo_ids` (array, FieldMultiSelect → cfg_tipo_vinculo_laboral)
- `cargo_funcional_ids` (array, FieldMultiSelect → cfg_cargo_funcional)
- `grupo_trabajo_ids` (array, FieldMultiSelect → grupos_de_trabajo)
- `persona_ids` (array, FieldPersonaSearch → personas)
- `genero_ids` (array, FieldMultiSelect → cfg_sexo_genero)
- `antiguedad_minima_meses` (number, FieldNumber, default 0)

### Bloque 4 — Topes, plazos y cómputo
- `unidad_medida_id` (select → cfg_unidad_medida_articulo)
- `unidad_minima_consumo_id` (select → cfg_unidad_minima_consumo) **CATÁLOGO NUEVO**
- `modulo_fraccionamiento_minutos` (number, default 15)
- `nivel_ocupacion_dia_id` — MOVIDO de Documentación a nueva sección "Superposición y Convivencia"
- `politica_superposicion_id` (select → cfg_politica_superposicion)

### Bloque 6 — Workflow
- `circuito_ingreso_ids` (array, FieldMultiSelect → cfg_rol)
- `permite_retroactividad` (boolean)
- `requiere_toma_conocimiento_superior` (boolean)

### Bloque 7 — Documentación
- `requiere_adjunto_obligatorio` (boolean)

## Auditorías realizadas

### 1. Auditoría de Integridad Cross-file
- **Hallazgo crítico resuelto:** `cfg_politica_superposicion` faltaba en `useCatalogosArticulos`
- **Hallazgo warning resuelto:** `intervalo_gracia_dias` podía enviar string vacío a Zod → fix en `buildVersionPayloadForZod`

### 2. Auditoría de Lógica de Negocio (Stress Test)
- Simulación de Art. 68-h (Franquicia Horaria) y Art. 14 (Licencia Médica): ambos pasan validación
- **Warning visual implementado:** banner ámbar cuando unidad_medida = "Días" + modulo_fraccionamiento > 0
- **Zod hardening:** `correspondencia_anio` ahora tiene `.min(1900).max(2100)`

### 3. Auditoría Triple de UX, Consistencia y Productividad
- **Terminología unificada:** "ticket" → "solicitud" en TODOS los labels y helpText (0 instancias residuales)
- **Sub-grupo visual:** 6 checkboxes de naturaleza envueltos en card con título "Naturaleza y clasificación"
- **helpText faltante:** `es_lao_anual` ahora tiene helpText con puente a Matriz de Antigüedad
- **Auto-activación:** `es_licencia_medica` → activa `requiere_adjunto_obligatorio` + toast informativo

### 4. Auditoría de Comprensión Humana y Relacional
- **Labels humanizados:** 12 labels reescritos con contexto de gestión hospitalaria
- **Títulos de Cards mejorados:** 5 títulos más descriptivos (ej: "Ciclo y saldo" → "Configuración de la bolsa de días / horas")
- **Puentes de texto cross-tab:** helpText conectan campos entre pestañas (ej: retroactividad ↔ preaviso)
- **Prefijos [¡IMPORTANTE!]:** en campos que afectan haberes, legajo o gremios (es_sin_goce, es_sancion, afecta_presentismo, unidad_medida_id)

## Bug crítico corregido

**`saveArticuloVersionAndPunteroCore` no sincronizaba campos de identidad al documento core.**

El listado leía `cfg_articulos/{id}` pero el servicio solo guardaba `version_actual_id` al hacer merge. Campos como `codigo`, `nombre`, `inciso_normativo` quedaban vacíos → la grilla mostraba IDs crudos en vez de nombres.

**Fix:** ahora el batch también escribe `codigo`, `nombre`, `inciso_normativo`, `es_sancion`, `es_inasistencia`, `es_sin_goce`, `requiere_dictamen` y `activo` al documento core en cada guardado.

## Catálogos seedeados y deployados

- `cfg_unidad_minima_consumo` → seedeado con `npm run seed:catalogos-articulos-v2`
- Cloud Functions re-deployadas con `npm run firebase:deploy:functions` (whitelist actualizada)

## Componentes UI nuevos (`fieldWidgets.jsx`)

- **`FieldMultiSelect`**: dropdown con chips, siempre retorna `[]` (nunca null/undefined), soporte de `helpText`, `disabled`, `required`
- **`FieldPersonaSearch`**: input con autocomplete para colección `personas`, búsqueda vía `listarColeccion("personas")`, chips removibles
- **`RequiredBadge`**: indicador visual de campo obligatorio

## Próximos pasos (para retomar)

1. **PROBAR EL MÓDULO:** Cargar artículos reales (LAO, Art. 14 Médica, Art. 68-h Franquicia, Art. 64-a Particular) para validar todo el flujo
2. **Afinar proceso:** Detectar fricciones de UX durante la carga real
3. **Pendientes funcionales:**
   - Calendario de feriados (CRUD `cfg_calendario_feriados_institucional`)
   - Editor de incompatibilidades (grafo `cfg_articulo_relaciones`)
   - Configuración de SLA por paso
   - Campo `efector_ids` (pospuesto)

## Archivos clave del configurador

- `web/src/features/configuracion/articulos/ArticuloConfigTabs.jsx` — UI principal (3 tabs, ~1140 líneas)
- `web/src/schemas/articulo.schema.js` — Schema Zod (7 bloques, 278 líneas)
- `web/src/features/configuracion/articulos/articuloLabels.js` — Labels humanizados (154 líneas)
- `web/src/features/configuracion/articulos/fieldWidgets.jsx` — Widgets incluyendo MultiSelect y PersonaSearch
- `web/src/hooks/useCatalogosArticulos.js` — Hook con 10+ catálogos, fallback de labels
- `web/src/services/cfgArticuloVersionService.js` — Servicio de guardado con sync de identidad al core
- `web/src/pages/ArticuloListadoGrilla.jsx` — Grilla de listado mejorada
- `docs/v2/SEED_CATALOGOS_ARTICULOS_V2.json` — Seed de catálogos

## Decisiones cerradas en sesión vespertina (2026-05-14 ~18:00)

| Decisión | Resultado |
|----------|-----------|
| `antiguedad_al_checkin` | **ELIMINADO** del schema de `checkin_portal`. La antigüedad se calcula siempre al vuelo desde HLC. |
| Prerequisito HLC para checkin | **OBLIGATORIO.** Todas las HLC (vigentes + históricas) deben estar cargadas antes del checkin. RRHH confirma con checkbox (`hlc_confirmadas_completas`). |
| Checkin = puerta de ingreso | **SÍ.** Es el acto formal de activación del usuario (migrados con historial = saldos parciales; nuevos sin historial = saldos completos/cero). |
| Fuente única del calculador | `shared/utils/antiguedadCalculator.js` (ESM). Functions usa copia CJS auto-generada por `scripts/sync-shared-to-functions.mjs` + hook predeploy en firebase.json. |

**Acciones ejecutadas:**
- Fix `deshabilitado_en` propagado a `shared/utils/antiguedadCalculator.js` (fuente ESM).
- Creado `scripts/sync-shared-to-functions.mjs` (convierte ESM → CJS y sobreescribe `functions/modules/shared/`).
- `functions/modules/shared/antiguedadCalculator.js` y `fechaInstitucionalBa.js` ahora son auto-generados (header "NO EDITAR MANUALMENTE").
- Hook `predeploy` agregado a `firebase.json` → sincroniza antes de cada deploy.
- Plan maestro de la ticketera (`ticketera_puente_mvp_538a748a.plan.md`) actualizado: Bloque 1 reescrito con nueva visión del checkin.
- 9 tests del calculador pasan correctamente.

## Agenda para la próxima sesión (2026-05-15)

1. **Continuar con el plan de la ticketera:** Retomar implementación de campos del configurador (probar cargando artículos reales) y/o avanzar con los módulos pendientes (feriados, incompatibilidades, SLA).
2. **Evaluar completitud del módulo HLC:** Verificar que el CRUD de HLC está 100% funcional para ambos escenarios (migrados con historial completo, nuevos con HLC única). Esto es prerequisito para implementar el checkin.
3. **Continuar probando el configurador:** Cargar artículos reales para afinar el proceso.

## Artículo piloto publicado — 64-A Asuntos particulares (2026-05-15)

Referencia operativa para el **módulo de solicitudes / ticketera** cuando implemente filtros de elegibilidad y circuito de ingreso.

| Campo | Valor |
|-------|--------|
| `articulo_id` | `art_01KRNK10V10CH7W5M2W6V558GS` |
| `version_id` | `ver_01KRNKNBXNBFC9HZN7CZJGPRDH` |
| `estado_version_id` | `cfg_est_ver_publicada` (confirmado en Firestore; `publicada_en` puede quedar null hasta completar metadatos de publicación) |
| Código / nombre | `64-A` — ASUNTOS PARTICULARES |
| Norma | Decreto `1919/89`, inciso `Art 64 inc A` |

### Parámetros de negocio relevantes (versión publicada)

- **Cómputo:** días corridos (`cfg_rcd_corridos`), unidad días, ámbito año calendario, cupo 6, 1 solicitud/mes, 1 día por evento (mín. 1).
- **Elegibilidad (`bloque_elegibilidad_filtros`):** solo `escalafon_ids` = [`CFG_ESC_02_ADMINISTRACION`] (Administración Pública Decreto 2695); `agrupamiento_ids` vacío → todos los agrupamientos **dentro** de ese escalafón (Enfermería, Administración, etc.).
- **Exclusión normativa deseada:** agentes con HLC vigente y `escalafon_id` = `CFG_ESC_01_PROFESIONAL` (Profesional de la Salud, Ley 9282) **no** deben poder usar este artículo.
- **Impacto LAO:** `suma_antiguedad_lao` = true (el período cuenta para antigüedad / no se descuenta del servicio efectivo para vacaciones).
- **Circuito de ingreso (revisión RRHH):** conviene **solo** `CFG_USUARIO` (rol agente estándar); semántica del campo = lista blanca **OR** de roles que pueden **crear** la solicitud. Incluir `CFG_RRHH` / `CFG_MEDICO` amplía quién puede iniciar, no restringe al agente. Verificar valor guardado al implementar el alta.

Ids de escalafón en seed de configuración maestra: `src/scripts/seedConfiguracion.mjs` (`CFG_ESC_01_PROFESIONAL`, `CFG_ESC_02_ADMINISTRACION`).

---

## Registro para desarrollo — filtro de elegibilidad en alta de solicitud

**Estado:** reglas en versión documentadas; **contrato de resolución** en [`RFC_TICKETERA_SLICE_64A_MVP_V2.md`](./RFC_TICKETERA_SLICE_64A_MVP_V2.md) §5–6. Implementación: Oleada 1 (pendiente código).

### Fuente de verdad laboral (V2)

- La elegibilidad del configurador apunta a datos de **persona + historial laboral**, no a duplicar escalafón en el artículo salvo como filtro.
- Referencia de integración: [`MODULO_ARTICULOS_V2_SCHEMA_PRODUCT_FIRST.md`](./MODULO_ARTICULOS_V2_SCHEMA_PRODUCT_FIRST.md) §5 (Laboral: `hlc_*`, `hlg_*`, efectores, grupos).
- Al implementar, documentar en el mismo handoff o en el RFC de solicitudes **qué documento(s)** se leen: típicamente **HLC vigente** para `escalafon_id`, `agrupamiento_id`, `cargo_funcional_id`, `tipo_vinculo_id`; y si intervienen **HLG** / **HLD** (p. ej. grupo de trabajo, efector, cadena HLc→HLd→HLg del login).

### Semántica acordada de arrays vacíos vs poblados

| Campo en versión | `[]` vacío | Lista con ids |
|------------------|------------|----------------|
| `escalafon_ids` | Todos los escalafones | Solo si `escalafon_id` de la HLC vigente está en la lista |
| `agrupamiento_ids` | Todos los agrupamientos (dentro del escalafón ya filtrado) | Solo agrupamientos listados |
| (análogo) `tipo_vinculo_ids`, `cargo_funcional_ids`, `grupo_trabajo_ids`, `persona_ids`, `genero_ids` | Sin restricción en ese eje | Debe cumplir intersección con el valor del agente |

`antiguedad_minima_meses`: comparar contra antigüedad calculada (motor dinámico HLC; ver `antiguedadCalculator`), no valor almacenado en checkin.

### Casos de prueba obligatorios (64-A)

Usar la versión publicada arriba. Criterio de éxito cuando exista pantalla/callable de **alta de solicitud**:

| # | Perfil de prueba | HLC vigente (mínimo) | Resultado esperado |
|---|------------------|----------------------|-------------------|
| T1 | Agente planta administrativa 2695 | `escalafon_id` = `CFG_ESC_02_ADMINISTRACION`, agrupamiento cualquiera permitido por hospital | **Puede** elegir artículo 64-A y crear solicitud (si rol ∈ `circuito_ingreso_ids`) |
| T2 | Agente profesional de la salud 9282 | `escalafon_id` = `CFG_ESC_01_PROFESIONAL`, cargo vigente | **No** puede elegir 64-A — rechazo de elegibilidad con mensaje claro |
| T3 | Agente con HLC 2695 pero rol solo RRHH (si circuito = solo USUARIO) | 2695 | RRHH **no** crea en nombre propio salvo que también tenga `CFG_USUARIO` |
| T4 | Doble vínculo / cambio de HLC | Probar transición 9282 → 2695 | Acceso debe seguir la **HLC vigente** a la fecha de la solicitud |

Registrar en el PR del módulo solicitudes: resultado de T1 y T2 como prueba de regresión del filtro.

### Circuito de ingreso (`circuito_ingreso_ids`)

- Campo en `bloque_workflow_sla_cobertura`; ids son **`cfg_rol`** (`CFG_USUARIO`, `CFG_RRHH`, `CFG_MEDICO`, …).
- Semántica: **OR** — puede iniciar quien tenga al menos un rol listado.
- Para 64-A, RRHH definió: basta **`CFG_USUARIO`** para acceso agente; roles extra en la lista solo amplían iniciadores.

### Decisiones de diseño — cerradas (Oleada 0, 2026-05-18)

Ver [`RFC_TICKETERA_SLICE_64A_MVP_V2.md`](./RFC_TICKETERA_SLICE_64A_MVP_V2.md) §4:

1. Elegibilidad contra **HLC vigente en `fecha_desde`** (zona BA), no “hoy”.
2. `grupo_trabajo_ids` MVP: solo **`grupo_de_trabajo_id` de HLC**; HLG en slice posterior.
3. Errores: **código estable** + mensaje legible (tabla `ELEG_*`, `SALDO_*`, `CIRCUITO_ROL`).

---

## Fixes adicionales aplicados post-commit

- `web/src/components/layout/MobileLayout.jsx`: se extendió el `max-h` del shell en desktop de `64rem` fijo a `calc(100dvh - 2rem)` para que el panel derecho del configurador no se corte verticalmente.
- `functions/modules/shared/antiguedadCalculator.js`: **fix filtro HLC deshabilitadas en cálculo de antigüedad.** Las HLC anuladas manualmente (con campo `deshabilitado_en`) ahora se excluyen del cómputo. Las HLC cerradas por baja laboral (`activo: false` sin `deshabilitado_en`) siguen computando porque representan períodos reales de trabajo. Cloud Functions re-deployadas.

## Contexto de conversación

- UUID conversación: `5230c74b-610d-4f73-b4ef-89d0c26a31a1`
- Sesión previa: `HANDOFF_SESION_2026-05-13_TICKETERA.md`
