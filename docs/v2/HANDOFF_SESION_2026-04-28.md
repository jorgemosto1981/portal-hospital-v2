# Handoff de sesión — 2026-04-28

## Actualización (refactor UI) — 15:54

- Commit previo funcional: `f0aa3af` (carga laboral por `cfg_dia_semana` y validaciones asociadas).
- Commit de refactor estructural: `0aaa053`.
- Objetivo: bajar complejidad de páginas monolíticas sin modificar comportamiento funcional.

### Cambios principales

1. **Modularización de `DatosLaborales`**
   - Se extrajeron constantes y utilidades a:
     - `web/src/pages/datos-laborales/constants.js`
     - `web/src/pages/datos-laborales/utils.js`
   - Se extrajeron secciones visuales a:
     - `web/src/pages/datos-laborales/sections/ColeccionesLaboralesCards.jsx`
     - `web/src/pages/datos-laborales/sections/IntegridadReferencialCard.jsx`
     - `web/src/pages/datos-laborales/sections/FasesLaboralesTables.jsx`

2. **Modularización de `DatosPersonales`**
   - Se extrajeron constantes y utilidades a:
     - `web/src/pages/datos-personales/constants.js`
     - `web/src/pages/datos-personales/utils.js`
   - Se extrajeron secciones/formularios a:
     - `web/src/pages/datos-personales/sections/FormHeaderControls.jsx`
     - `web/src/pages/datos-personales/sections/PersonaFields.jsx`
     - `web/src/pages/datos-personales/sections/FormacionFields.jsx`
     - `web/src/pages/datos-personales/sections/DdjjFields.jsx`
     - `web/src/pages/datos-personales/sections/ConsentimientosFields.jsx`

3. **Reducción de tamaño en páginas principales**
   - `web/src/pages/DatosLaborales.jsx`: de ~1400 a ~980 líneas.
   - `web/src/pages/DatosPersonales.jsx`: de ~1140 a ~555 líneas.

4. **Validación técnica post-refactor**
   - Revisión de lint en archivos editados: sin errores.
   - No se reportaron cambios funcionales intencionales; refactor orientado a mantenibilidad.

### Pendientes recomendados tras este refactor

- Revisar consistencia de nombres de props para reducir acoplamiento entre secciones.
- Evaluar extracción de hooks (`useDatosLaboralesState`, `useDatosPersonalesState`) para separar aún más UI vs lógica.
- Agregar tests de humo de formularios críticos (HLc/HLg y DDJJ/consentimientos) para blindar futuras iteraciones.

## Estado de cierre de sesión

- Commit de consolidación realizado: `ee378fb`
- Estado git al cierre: cambios guardados localmente en branch actual.
- Objetivo cumplido: estabilización operativa de `Datos Personales` + `Datos Laborales` con BD real, sin datos ficticios.

## Qué se realizó (resumen ejecutivo)

1. **Datos Laborales**
   - Se corrigieron selects para cargar desde BD real.
   - Se agregó `cfg_categorias` y el campo `categoria_id` en HLc (UI + backend).
   - Se corrigió la separación de niveles (HLc/HLg) y su coherencia en pantalla.
   - Se agregaron validaciones server-side de consistencia:
     - `HLd.persona_id` debe coincidir con `HLc.persona_id` del `cargo_id`.
     - `HLg.persona_id` debe coincidir con `HLd.persona_id` del `dato_laboral_id`.

2. **Grupos de trabajo (regla V2 de IDs)**
   - Se definió convención canónica: `gdt_<ULID>`.
   - Se implementó validación server-side para nuevos/ediciones.
   - Se ejecutó migración de `GT_*` a `gdt_*` sin romper referencias.
   - Script creado: `scripts/migrate-grupos-trabajo-ids-v2.mjs`.

3. **Datos Personales**
   - Se consolidó carga real de `personas`, `formacion_agente`, `declaraciones_grupo_familiar`, `consentimientos`.
   - DDJJ:
     - `estado_declaracion_id` fijo en este módulo: `CFG_DDJJ_03_PRESENTADA` (no seleccionable).
     - `declaracion_version` automática correlativa por `titular_persona_id` en backend.
   - `persona_id` en DDJJ/formación/consentimientos por selector desde BD.

4. **Estado de perfil de datos**
   - Se implementó default automático backend para `personas.estado_perfil_datos_id`:
     - Primario: `cfg_epd_inc`
     - Fallback: `cfg_epd_borr`
   - Se normalizó `per_01KQA2TZ25AY9616DW3YPQJ47E` a `cfg_epd_inc`.

5. **Consentimientos (etapa base)**
   - Se dejó preparado mínimo y seguro (base técnica).
   - Se documentó alcance y límites de esta etapa:
     - `docs/v2/CONSENTIMIENTOS_ETAPA_BASE.md`

6. **Configuración (catálogos)**
   - Se habilitaron en UI y backend:
     - `cfg_estado_perfil_datos`
     - `cfg_estado_cuenta_acceso`
   - Se corrigió visualización para catálogos con `titulo_ui` (cuando no tienen `nombre`).

7. **Auditoría y documentación**
   - Se guardó resultado de auditoría:
     - `docs/v2/RESULTADO_AUDITORIA_PERSONA_2026-04-28.md`
   - Se creó verificador de completitud por persona:
     - `scripts/verificar-completitud-persona-v2.mjs`
     - Comando: `npm run db:verificar-completitud-persona-v2 -- <persona_id>`

## Estado funcional actual (aceptable para fase)

- `Datos Laborales`: operativo con BD real y validaciones base.
- `Datos Personales`: operativo con BD real y reglas de DDJJ en etapa actual.
- `consentimientos`: identificado y preparado en etapa base; profundidad funcional diferida.

## Pendientes para próxima sesión (orden sugerido)

1. **Consentimientos — fase funcional real (siguiente etapa)**
   - Definir flujo de aceptación legal real.
   - Hash real de texto legal (`texto_hash`) a partir de versión/contenido.
   - Política de inmutabilidad de consentimiento aceptado.
   - Auditoría de eventos de aceptación/revocación.

2. **Reglas de transición DDJJ (módulo futuro)**
   - Implementar transiciones de `estado_declaracion_id` en módulo correspondiente (médico/validación), no en este módulo base.
   - Vincular `declaracion_jurada_aceptada` y `aceptada_en` a la transición formal.

3. **Ajustes de calidad de datos**
   - Revisar necesidad de endurecer validaciones de familiares (formatos, edades plausibles, etc.).
   - Mantener script de verificación puntual por `persona_id` para control de carga.

4. **Si se requiere**
   - Push a remoto y apertura de PR con este checkpoint.

## Comandos útiles para retomar rápido

- Verificar completitud de persona:
  - `npm run db:verificar-completitud-persona-v2 -- per_...`
- Simular migración de grupos:
  - `npm run db:migrate-grupos-trabajo-ids-v2:dry-run`
- Aplicar migración de grupos:
  - `npm run db:migrate-grupos-trabajo-ids-v2`

## Actualización (cierre operativo final) — 16:24

### Qué se dejó terminado

1. Se registraron acuerdos funcionales aprobados para próxima etapa en:
   - `docs/v2/ACUERDOS_FUNCIONALES_LABORAL_CUENTAS_2026-04-28.md`
2. Se alineó backend laboral a política de paralelos permitidos:
   - `functions/modules/catalogosLaborales.js`
   - Solapes `HLc` y `HLg` pasan de bloqueo a warning (`VAL-HLC-W001`, `VAL-HLG-W002`).
3. Se actualizó matriz warning/error:
   - `docs/v2/MATRIZ_WARN_ERROR_LABORAL_V2.md`
4. Se amplió test ejecutable para validar paralelos permitidos:
   - `tests/abm-validaciones-estrictas.mjs`

### Estado exacto al cerrar

- Personales/Laborales: cerrados y estables para continuar.
- Solapes: permitidos según definición funcional, auditables por warning.
- Reglas estrictas de obligatorios: vigentes en frontend + backend.
- Última suite relevante a ejecutar al retomar:
  - `npm run test:abm:estricto`

### Qué sigue en próxima sesión (orden)

1. Implementar vista timeline laboral por persona (`HLc -> HLd -> HLg`) con filtros:
   - activos / cerrados / vigentes en fecha X / con conflicto.
2. Implementar vista operativa por grupo (burbuja actual).
3. Diseñar y aplicar flujo de baja de usuarios:
   - deshabilitar, bloquear temporal, rehabilitar, revincular DNI/cuenta, invalidar sesión.
4. Extender modelo `HLd` con:
   - `modalidad_jornada_id`
   - `regimen_horario_id` (o equivalente)
   - `centro_costo_id` / imputación presupuestaria.
5. Definir (pendiente) SLA final:
   - cadena completa `HLg -> HLd -> HLc`,
   - tolerancia de reconciliación horaria,
   - criterio final de alertas críticas.

## Actualización continuidad — 2026-04-29 (RRHH + laboral)

### Implementado en esta sesión

1. **Timeline laboral por persona (HLc -> HLd -> HLg)**
   - Filtros: activos, cerrados, vigentes en fecha X, conflicto.
   - Filtros avanzados: tipo de tramo, grupo, estado de asignación, nivel min/max, sin referencias, solo solapes.
   - Regla de vigencia explícita en UI: intervalo **inclusivo** `[fecha_desde, fecha_hasta]`.
   - Etiquetas enriquecidas con IDs + nombres para lectura operativa.

2. **Vista operativa por grupo (burbuja)**
   - Selector de grupo + fecha de corte.
   - Orden por `nivel_jerarquico`, estado en fecha y resumen de vigencias.

3. **Escalabilidad de lecturas**
   - `listarColeccionPublicaTemporal` con paginación (`pageSize`, `pageToken`, `hasMore`, `nextPageToken`).
   - Frontend sin límites fijos de filas: carga paginada automática.
   - Progreso incremental (`N cargados`) y duración por colección (`ms`) en UI.

4. **RRHH — operación de cuentas/estados**
   - Nuevo callable: `rrhhActualizarEstadoCuentaAcceso`.
   - Nuevo callable: `rrhhAplicarBajaLaboral`.
   - Nuevo callable: `rrhhReiniciarVinculacionCuenta`.
   - Expuestos en UI RRHH con formularios dedicados.
   - Menú/tab `RRHH` conectado en navegación principal.
   - En modo temporal (`OPEN_ACCESS_TEMP=true`) se permite acceso RRHH sin sesión.

5. **Reglas de negocio cerradas en sesión**
   - **Baja laboral**: requiere cerrar primero periodos `HLg` abiertos; luego se permite cierre de `HLc`.
   - **Reinicio de vinculación**: `estado_acceso_id` destino es seleccionable (no fijo).

### Humo ejecutado y resultado

1. **Alta RRHH**
   - Resultado: OK.
   - Evidencia: `Creado per_01KQCFP6X2W9V6YZRC8AN112BV — Cuenta usr_01KQCFP6X3ZHEXQRE7HPRFGWMB`.

2. **Gestión de acceso**
   - Resultado: OK.
   - Evidencia: transición aplicada a `cfg_eca_bloq`.

3. **Reinicio de vinculación**
   - Resultado: OK.
   - Evidencia: `Vinculación reiniciada. estado_acceso=cfg_eca_onb`.

4. **Baja laboral**
   - Resultado esperado validado en ambos caminos:
     - bloqueada si hay `HLg` vigentes,
     - aplicada correctamente cuando no quedan `HLg` abiertos.

### Pendientes recomendados (siguiente sesión)

1. Consolidar criterio de solapes:
   - mantener warning informativo (`VAL-HLG-W002`) para paralelos permitidos,
   - documentar explícitamente casos que sí deben escalar a bloqueo.

2. Extensión `HLd` pendiente del plan:
   - `modalidad_jornada_id`,
   - `regimen_horario_id` (o equivalente),
   - `centro_costo_id`.

3. Definición SLA operacional final:
   - reconciliación `HLg/HLd/HLc`,
   - umbrales de alertas críticas y tratamiento.

## Actualización continuidad — 2026-04-29 (estados de grupo + fecha_hasta)

### 1) Revisión de estados para grupo de trabajo (HLg) contra documental V2

- Se verificó contrato en `MODULO_DATOS_LABORALES_V2.md` + acuerdos `ACUERDOS_FUNCIONALES_LABORAL_CUENTAS_2026-04-28.md`.
- Confirmación: en V2 el estado operativo del tramo de grupo (`HLg`) se deriva de vigencia (`fecha_inicio`/`fecha_fin`) en modo inclusivo, y no de un catálogo específico de estado en `HLg`.
- Catálogo vigente `cfg_estado_asignacion_laboral` (hoy usado en HLc): `Activa`, `Suspendida`, `Finalizada`.

### 2) Cobertura de combinaciones y semántica de nombres

- Cobertura técnica actual: suficiente para ciclo base del cargo (`HLc`) y para lectura por vigencia en grupo (`HLg`).
- Riesgo semántico detectado: `Activa` en HLc puede convivir con tramos HLg cerrados o futuros, generando dudas operativas si no se comunica como “estado del cargo” vs “estado del tramo”.
- Recomendación registrada:
  - mantener `cfg_estado_asignacion_laboral` como estado de cargo;
  - en vista de grupo mostrar etiquetas derivadas por vigencia (`Vigente`, `Cerrada`, `Pendiente`) calculadas por fecha inclusiva;
  - evaluar en RFC si se requiere un catálogo adicional específico para estados administrativos de tramo HLg.

### 3) Regla aplicada a edición de fechas (`fecha_hasta`)

- Implementado en UI de `DatosLaborales`:
  - el datepicker de `fecha_hasta` usa `min=fecha_desde`;
  - si se mueve `fecha_desde` hacia adelante y deja inválida `fecha_hasta`, se limpia automáticamente;
  - si se intenta cargar `fecha_hasta < fecha_desde`, se descarta en estado local;
  - se mantiene validación final de formulario con mensaje explícito.

### 4) Resultado

- Se evita selección de días previos en calendario cuando existe `fecha_desde`.
- Se mantiene consistencia en alta/edición HLc y HLg.
- Queda trazabilidad documental de criterio de estados y de la regla de fechas.

## Actualización continuidad — 2026-04-29 (decisiones funcionales cerradas HLC/HLD/HLG)

### Decisiones aplicadas

1. `HLc.grupo_de_trabajo_id` pasa a obligatorio real (frontend + backend).
2. Reconciliación de carga: referencia normativa en HLc vs operativo en HLg, solo warning informativo si difieren (sin bloqueo ni acciones automáticas).
3. Extensión HLd incorporada para próximos módulos:
   - `regimen_horario_id`
   - `centro_costo_id`
4. Normalización de consistencia de cuenta:
   - chequeos internos sobre `usuarios_cuenta.estado_acceso` (no `estado_acceso_id`).
5. Solapes:
   - criterio warning (no bloqueante),
   - warning de solape HLg aplicado dentro del mismo cargo (`cargo_id`) + mismo grupo,
   - permitido repetir grupo entre cargos distintos de la misma `persona_id`.

### Impacto técnico implementado

- Backend laboral (`guardarRegistroLaboralTemporal`):
  - exige `grupo_de_trabajo_id` en HLc y valida referencia a `grupos_de_trabajo`.
  - persiste `grupo_de_trabajo_id` en HLc.
  - warning de solape HLg restringido a “mismo cargo + mismo grupo”.
  - reconciliación horaria HLg vs HLc calculada a nivel cargo (sumatoria de HLg asociados), con warning informativo.
- Frontend `DatosLaborales`:
  - selector de `grupo_de_trabajo_id` habilitado también en HLc.
  - HLd incorpora edición/guardado de `regimen_horario_id` y `centro_costo_id`.

### Regularización de históricos HLc sin grupo (cierre operativo)

- Se creó script específico:
  - `scripts/auditar-regularizar-hlc-sin-grupo.mjs`
  - comando npm: `db:auditar-hlc-sin-grupo`
- Modo por defecto: `DRY_RUN` (solo auditoría).
- Modo `--apply`: regulariza automáticamente casos con candidato único inferido por cadena `HLc -> HLd -> HLg`.
- Se agregó modo puntual para casos manuales:
  - `--hlc-id <id> --grupo-id <gdt_...> [--apply]`.

#### Resultado aplicado en sesión

- Se regularizaron los HLc abiertos pendientes asignando `Sala Internación 1` (`gdt_01KQA6QCA8TDQK9YBTHKYA4R2V`).
- Verificación final `--solo-abiertos`:
  - `total_hlc_sin_grupo = 0`.
- Auditoría global (abiertos + cerrados):
  - persisten históricos cerrados sin grupo, clasificados para tratamiento posterior (sin impacto operativo inmediato).

### Cierre A2 — catálogos HLd para próximos módulos

- Se agregaron catálogos:
  - `cfg_regimen_horario`
  - `cfg_centro_costo`
- Seed aplicado (`seed:configuracion`) con ids iniciales para ambos catálogos.
- Configuración maestra habilitada para alta/edición de ambos (`Configuración -> Laboral avanzado`).
- `DatosLaborales` (HLd) actualizado a selects (no texto libre) para:
  - `regimen_horario_id`
  - `centro_costo_id`
- Backend laboral valida FK de ambos campos al guardar HLd.

### Avance A3 — normalización `estado_acceso`

- Se corrigió script de verificación de completitud para usar `usuarios_cuenta.estado_acceso` (campo persistido canónico).
- Se agregó script de auditoría/normalización:
  - `scripts/auditar-normalizar-estado-acceso.mjs`
  - comando npm: `db:normalizar-estado-acceso`
- Función:
  - detecta campo legacy `estado_acceso_id` en `usuarios_cuenta`,
  - en modo `--apply` copia a `estado_acceso` cuando falte y elimina campo legacy,
  - reporta conflictos si ambos campos difieren.
- Estado actual (dry-run en sesión): sin registros legacy detectados.
- Hardening adicional aplicado:
  - escrituras de `usuarios_cuenta` en `login`, `onboarding` y `rrhh` limpian explícitamente `estado_acceso_id` (campo legacy) y persisten solo `estado_acceso`.
- Documentación de acceso/rules actualizada:
  - `estado_acceso_id` queda reservado como nombre de parámetro de entrada en callables RRHH; no persiste en Firestore.

## Actualización continuidad — 2026-04-29 (B1/B2 warnings operativos en UI)

### Implementado

1. Se incorporó visualización explícita de warnings operativos en `DatosLaborales`:
   - `SOLAPE_CARGO_GRUPO` (solape en mismo `cargo_id` + mismo `grupo_de_trabajo_id`).
   - `DESVIO_CARGA_NORMATIVA` (diferencia entre total operativo HLg y carga normativa HLc).
2. Se agregaron filtros por tipo de warning y conteos visibles en:
   - Timeline laboral por persona.
   - Vista operativa por grupo.
3. Se agregó columna de warnings en tabla de vista por grupo para trazabilidad operativa.

### Criterio funcional ratificado (B2)

- Ambos warnings son **informativos/no bloqueantes**.
- No frenan guardado ni edición.
- Su objetivo es auditoría operativa y soporte de decisión en RRHH.

## Actualización continuidad — 2026-04-29 (C1 read-model operativo unificado)

### Implementado (primera versión funcional)

1. Nuevo callable backend:
   - `listarReadModelLaboralOperativoTemporal`
   - archivo: `functions/modules/catalogosLaborales.js`
2. Exposición del callable en módulo de catálogos:
   - `functions/modules/catalogos.js`
3. Wrapper frontend:
   - `web/src/services/callables.js`
   - `web/src/services/readModelLaboralService.js`
4. Integración inicial en pantalla:
   - `web/src/pages/GrillaOperativa.jsx`

### Cobertura de datos del read-model

- Cadena consolidada `HLg -> HLd -> HLc`.
- Campos base para consumo transversal (Ticket/RDA/grilla):
  - `persona_id`, `persona_nombre`
  - `grupo_de_trabajo_id`, `grupo_nombre`
  - `hlg_id`, `hld_id`, `hlc_id`
  - `nivel_jerarquico`
  - `fecha_inicio`, `fecha_fin`, `vigente_en_fecha`
  - `regimen_horario_id`, `centro_costo_id`
  - `carga_horas_semana_hlg`, `carga_horas_total_hlc`
  - `warning_codes` (incluye `DESVIO_CARGA_NORMATIVA`)

### Filtros soportados

- `fecha_corte` (inclusive, default hoy)
- `persona_id` (opcional)
- `grupo_de_trabajo_id` (opcional)
- `incluir_no_vigentes` (default false)

### Extensión C1.1 (auditoría exportable)

- `GrillaOperativa` incorpora filtro local por tipo de warning:
  - `DESVIO_CARGA_NORMATIVA`
- Se agregó exportación de resultados filtrados:
  - JSON (`read-model-laboral-<fecha>.json`)
  - CSV (`read-model-laboral-<fecha>.csv`)
- Objetivo: facilitar auditoría externa para análisis operativo Ticket/RDA sin consultas manuales ad hoc.

### Extensión C1.2 (warnings backend unificados)

- El read-model backend incorpora ambos warnings operativos en `warning_codes`:
  - `SOLAPE_CARGO_GRUPO`
  - `DESVIO_CARGA_NORMATIVA`
- `resumen` del callable ahora devuelve conteos por ambos tipos.
- `GrillaOperativa` permite filtrar y visualizar ambos warnings desde origen.

### Extensión C1.3 (estado operativo derivado unificado)

- El read-model backend agrega `estado_operativo` por item:
  - `pendiente` (inicio futuro respecto a fecha de corte)
  - `activo` (vigente en fecha de corte)
  - `no_vigente` (finalizado antes de fecha de corte)
- `resumen` incorpora contador `pendientes`.
- `GrillaOperativa` muestra `estado_operativo` en tabla y en la exportación CSV.

### Extensión C1.4 (estado administrativo unificado)

- El read-model backend agrega `estado_admin` por item:
  - `abierto` (sin `fecha_fin`)
  - `cerrado` (con `fecha_fin`)
- `resumen` incorpora:
  - `abiertos`
  - `cerrados`
- `GrillaOperativa` muestra `estado_admin` en tabla y exportación JSON/CSV.

