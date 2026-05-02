# Módulo de datos laborales — Plan V2

**Estado del plan (documentación):** **borrador ampliado** (contrato actualizado con acuerdos de producto; matriz de acceso fina, subnivel de carga horaria detallada y alineación con **Ticket** cuando se unifique doc). **No** bloquea el vertical Login + datos personales (módulo con documentación **más avanzada**; *también pend. revisión global*).

**Marco:** [`PLAN_MODULOS_V2.md`](./PLAN_MODULOS_V2.md) · [`RULEBOOK_V2.md`](./RULEBOOK_V2.md).  
**Ancla transversal:** **`persona_id`** (`per_<ULID>`) en toda fila laboral; **no** usar DNI, email ni `auth_uid` como FK entre módulos.  
**Ficha humana:** [`MODULO_DATOS_PERSONALES_V2.md`](./MODULO_DATOS_PERSONALES_V2.md) (nombre, DNI, etc.); este módulo **no** duplica esos datos en asignaciones salvo **snapshots** acordados explícitamente por ley o informe (fuera del contrato base).

**Catálogos:** inventario `cfg_*` laborales en **§6**; incorporación formal al inventario global en [`MODULO_CONFIGURACION_V2.md`](./MODULO_CONFIGURACION_V2.md) **§5.1**.

**Acuerdo de alineación (abril 2026 — panel / ABM y una sola fuente de verdad):** el catálogo de **efectores institucionales** (lugares de designación y de cumplimiento) vive en la colección **`cfg_efectores`**, con la **misma gobernanza** que el resto de `cfg_*` (Database-First: sin listas fijas en código; altas desde módulo de configuración/RRHH; ids estables; vigencia y baja lógica según `MODULO_CONFIGURACION_V2` §1–§2). Los campos `efector_designacion_id` y `efector_cumplimiento_id` de `hlc_*` son **FK al `id` de documento** en `cfg_efectores/{id}`. La antigua colección suelta **`efectores`** queda **deprecada** para modelos y seeds nuevos (ver §4.2). El plan maestro y el Rulebook reflejan el mismo criterio.

**Acceso (orientación):** transiciones sensibles en **Callables** + Rules restrictivas; ampliación laboral en [`ACCESO_Y_RULES_FIRESTORE_V2.md`](./ACCESO_Y_RULES_FIRESTORE_V2.md) cuando se cierre el módulo.

**Fecha:** 22 de abril de 2026.

---

## 1. Objetivo del módulo

1. Persistir **cargos** del agente: **un** vínculo a unidad/organigrama vía **`grupos_de_trabajo` (`gdt_*`)**, **dos** referencias a **efectores institucionales** (campos `efector_designacion_id` y `efector_cumplimiento_id` → documentos en **`cfg_efectores`**: designación normativa vs cumplimiento real de funciones), **cargo / función**, **vínculo**, **escalafón** (si aplica), **jornada**, **vigencia** (`fecha_desde` / `fecha_hasta`), **causal de fin** configurable y **carga horaria total** al cargo.
2. Permitir **varios cargos activos en paralelo** para la misma `persona_id` (mismo hospital u otros efectores), con historial por filas cerradas (`fecha_hasta` + causal).
3. Definir **activo laboralmente:** el agente lo está **si existe al menos un** `hlc_*` en estado **activo** y vigente (`fecha_hasta == null` o vigencia actual según regla de negocio) — sin depender de flags en `personas`. *Cruce con RRHH:* bajas laborales, deshabilitado y filtros de listados se documentan en [`CUESTIONES_ESTADOS_LABORAL_PERSONA_RRHH_V2.md`](./CUESTIONES_ESTADOS_LABORAL_PERSONA_RRHH_V2.md).
4. Servir de **fuente de verdad** para Ticket / bandejas por **`persona_id`** + ids de efectores/unidad/cargo (**sin hardcode**; estados y causales = **`cfg_*`**).
5. Registrar cambios en **`eventos_ticket`** (`evt_*`) con `tipo_evento_id` → `cfg_tipo_evento`.
6. **Subnivel por grupo (`hlg_*`):** cada **asignación** del agente a un **grupo de trabajo** (`gdt_*`) concreto lleva **vigencia propia**, **`nivel_jerarquico`** (número **1–99**, jerarquía en esa burbuja; **no** es catálogo `cfg_*`) y **carga horaria desagregada por día de semana** — **C10**; contrato **§4.4–4.5**.

---

## 1.1 Niveles operativos UX vs niveles técnicos BD (acuerdo abril 2026)

Para evitar confusión en implementación y capacitación de usuarios, se define explícitamente:

### Niveles operativos (pantalla / RRHH)

1. **Nivel 1 = Cargo** (`hlc_*`)
2. **Nivel 2 = Grupo de trabajo** (`hlg_*`)

Estos son los dos niveles que debe entender el usuario final para carga y edición diaria.

### Niveles técnicos (persistencia Firestore)

- `historial_laboral_cargos` (`hlc_*`) = base del cargo.
- `historial_laboral_datos` (`hld_*`) = capa técnica/intermedia de detalle del cargo.
- `historial_laboral_grupos` (`hlg_*`) = capa operativa por grupo/burbuja (jerarquía + carga por día).

**Regla de producto/documentación:** `hld_*` no se presenta como “nivel operativo” para RRHH general, sino como detalle técnico opcional cuando el caso lo requiera.

### Orden recomendado de carga (UX)

`HLc` -> (`HLd` opcional) -> `HLg`

Con este flujo:
- se reduce complejidad para RRHH,
- se conserva trazabilidad técnica completa en BD,
- y no se rompe compatibilidad con Ticket ni con integraciones futuras.

---

## 2. Límites con otros módulos

| Módulo | Qué aporta / qué consume |
|--------|---------------------------|
| **Datos personales** | Identidad civil; **no** incluye cargos ni efectores. |
| **Login** | `usuarios_cuenta`; **no** decide si el agente está laboralmente activo (eso es consulta sobre `hlc_*`). |
| **Ticket / solicitudes** *(doc otra PC, más desarrollado)* | **Jerarquía y “jefe inmediato”:** se resuelven por **esquema de burbujeo**; el **nivel** comparable por persona **en cada grupo** está en **`hlg_*.nivel_jerarquico`** (entero **1–99**; **no** hay colección `cfg_nivel_jerarquia`). **No** se persiste `supervisor_persona_id` en `hlc_*` en V2. Listas de negocio: **IDs** a `cfg_*` donde aplica; el nivel de jerarquía es **numérico** en asignación. Unificación con doc **al integrar** la otra PC (**§9**). |
| **Configuración** | Catálogos `cfg_*` §6 (incl. causal de fin de cargo, tipos de acto de designación, etc.). **Impacto en sueldo** (diario, total, porcentaje, …) de licencias/artículos: **no** es liquidación de nómina; las opciones seleccionables viven en la **configuración del artículo** y catálogos del **módulo configuración** — ver Ticket / módulo artículos, **no** en el núcleo de `hlc_*`. |
| **Nómina / liquidación** | **Fuera de alcance** de esta aplicación: el portal **no** liquida sueldos. |

---

## 3. Principios de modelado

1. **`persona_id` única** por agente; **varios** `hlc_*` pueden estar **activos y vigentes a la vez** (mismo u otro efector, mismo u otro hospital según designación y cumplimiento).
2. **Efector de designación** vs **efector de cumplimiento:** pueden coincidir o no. Ambos son **FK al `id` de documento en `cfg_efectores`**; catálogo mantenible por **módulo de configuración / panel ABM**; **no** texto libre. La igualdad **`efector_designacion_id` == `efector_cumplimiento_id`** es **señal explícita** para reglas (bandejas, informes, Ticket). *RFC:* fusión 1:1 con un nodo `gdt_*` si el hospital lo exige.
3. **Grupos de trabajo** (`gdt_*`): el **organigrama** (servicio, sector, nodo de jerarquía). En `hlc_*`, **`grupo_de_trabajo_id`** fija el **encuadre principal** del acto; en **`hlg_*`**, **cada** vínculo persona–grupo tiene `grupo_de_trabajo_id`, **vigencia**, **`nivel_jerarquico` (1–99)** y **carga por día** (**C10**). Un agente puede tener **varias** filas `hlg_*` (varias burbujas). **No** se mezcla `gdt_*` con el catálogo de efectores en **`cfg_efectores`**.
4. **Listas cerradas** = **`*_id` → `cfg_*`**: cada valor con **id única**; textos y vigencias solo en el catálogo (**[`MODULO_CONFIGURACION_V2.md`](./MODULO_CONFIGURACION_V2.md)** §1–§2). Causal de fin de vigencia = **`cfg_causal_fin_asignacion_laboral`** (u homónimo al fusionar Rulebook). **No** se borran filas de catálogo en producto: baja lógica y/o cierre de vigencia.
5. **Referencias legales** de designación: van **asociadas a cada cargo** con `fecha_desde`; detallan la normativa que designa el cargo (estructura en **§4.3** / campo `referencias_normativa_designacion`).
6. **No** persistir en `hlc_*` nombres de persona/servicio como SSoT: solo ids + joins.

---

## 4. Colecciones — contrato base

*Los nombres y prefijos coinciden con [`PLAN_DESARROLLO_VERSION2.md`](../../PLAN_DESARROLLO_VERSION2.md) (§ ESTRUCTURA DE BASE DE DATOS V2, apartados A–B, D).*

### 4.1 `grupos_de_trabajo` — id `gdt_<ULID>`

**Unidades de organigrama** (servicio, sector, nodo de jerarquía operativa). Alineado a [`PLAN_DESARROLLO_VERSION2.md`](../../PLAN_DESARROLLO_VERSION2.md) §B. **No** aloja el catálogo de efectores (eso es **`cfg_efectores`**; ver §4.2).

| Campo | Tipo | Obl. | Descripción |
|-------|------|------|-------------|
| `id` | `gdt_<ULID>` | **[O]** | |
| `codigo` | string \| null | **[X]** | |
| `nombre` | string | **[O]** | |
| `parent_group_id` | string \| null | **[X]** | Self-FK a `grupos_de_trabajo.id`. |
| `nivel_arbol` | number | **[O]** | |
| `tipo_grupo_id` | string \| null | **[X]** | vía `cfg_tipo_grupo` (u homónimo). |
| `activo` | boolean | **[O]** | |
| `vigente_desde`, `vigente_hasta` | Timestamp \| null | **[O]** | Nulos en `hasta` = sin cierre. |
| `creado_en` / `actualizado_en` | Timestamp | **[O]** | |
| `schema_version` | number | **[O]** | |

**Índices sugeridos:** `parent_group_id` + `activo`; `codigo` único sparse.

### 4.2 `cfg_efectores` — catálogo de efectores (panel de configuración / ABM)

**Una sola fuente de verdad** en Firestore para el **ABM** y para los desplegables que alimentan `efector_designacion_id` y `efector_cumplimiento_id` en `hlc_*`. Sigue el contrato transversal de `cfg_*` (sin borrado físico; baja lógica y/o vigencia — [`MODULO_CONFIGURACION_V2.md`](./MODULO_CONFIGURACION_V2.md) §1–§2). Los documentos almacenan, como mínimo, **`id`**, **`nombre`**, flags de producto; semillas iniciales pueden usar convención fija, p. ej. **`CFG_EFE_*`**.

**Obsolescencia documentada:** en borradores previos el catálogo se nombraba como colección **`efectores`** con ids `efe_<ULID>`. Esa colección se declara **deprecada** para despliegues y código nuevos; **no** añadir documentos a `efectores` en entornos V2. Toda operación de catálogo pasa por **`cfg_efectores`**.

| Campo | Tipo | Obl. | Descripción |
|-------|------|------|-------------|
| `id` | string (id de documento) | **[O]** | Estable: p. ej. `CFG_EFE_01_…` en semillas, o `efe_<ULID>` en altas gobernadas por Rulebook. |
| `codigo` | string \| null | **[X]** | Código de negocio / legible en informes, si aplica. |
| `nombre` | string | **[O]** | Etiqueta de UI. |
| `es_efector_institucional` | boolean | **[O]** | Marca del efector “de este portal”; **a lo sumo** un `true` por despliegue, según validación. |
| `activo` | boolean | **[O]** | |
| `vigente_desde`, `vigente_hasta` | Timestamp \| null | alinear a §2 `MODULO_CONFIGURACION` | Cierre de vigencia para “no ofrecer en nuevas altas”, sin invalidar `*_id` ya guardados. |
| `creado_en` / `actualizado_en` | Timestamp | **[O]** | (según cierre de implementación) |
| `schema_version` | number | **[O]** | |

**Índices sugeridos:** `activo` + `vigente_hasta`; `es_efector_institucional`.

### 4.3 `historial_laboral_cargos` — id `hlc_<ULID>`

Nivel 1 (cargo) — plan maestro §B. Cada documento = **un cargo** con su vigencia; el detalle operativo sigue en `historial_laboral_datos` y `historial_laboral_grupos` (`hld_*`, `hlg_*`).

| Campo | Tipo | Obl. | Descripción |
|-------|------|------|-------------|
| `persona_id` | string | **[O]** | FK `personas/{per_*}`. |
| `grupo_de_trabajo_id` | string \| null | **[X]** | Campo legado/opcional en HLc; el encuadre operativo se define en `hlg_*`. |
| `efector_designacion_id` | string | **[O]** | FK **documento en `cfg_efectores`**: marco **normativo** de designación (valor **seleccionable** en catálogo). |
| `efector_cumplimiento_id` | string | **[O]** | FK **documento en `cfg_efectores`**: lugar **real** de cumplimiento de funciones. |
| `cargo_funcional_id` | string | **[O]** | FK **`cfg_cargo_funcional`**. |
| `tipo_vinculo_id` | string | **[O]** | FK **`cfg_tipo_vinculo_laboral`**. |
| `rol_id` | string | **[O]** | FK `cfg_rol`; rol base de la persona en el cargo (SoT para validaciones). |
| `escalafon_id` | string \| null | **[X]** | FK **`cfg_escalafon`**. |
| `modalidad_jornada_id` | string \| null | **[X]** | FK **`cfg_modalidad_jornada`**. |
| `fecha_desde` | Timestamp | **[O]** | Inicio del cargo. |
| `fecha_hasta` | Timestamp \| null | **[C]** | `null` = cargo **vigente**. Si se cierra, obligatorio **`causal_fin_asignacion_id`**. |
| `causal_fin_asignacion_id` | string \| null | **[C]** | FK **`cfg_causal_fin_asignacion_laboral`**. **Obligatorio no-null** si `fecha_hasta` no es `null`. |
| `estado_asignacion_id` | string | **[O]** | FK **`cfg_estado_asignacion_laboral`**. |
| `carga_horaria_total` | number | **[O]** | Carga **total** del cargo en **horas** (*§4.5* reparte este total). |
| `referencias_normativa_designacion` | array de map | **[O]** | Referencias legales del acto (cada ítem: **`tipo_acto_id`** → **`cfg_tipo_acto_designacion`**, `numero` string, `fecha` Timestamp, `detalle` string opcional). *Excepciones: ver decisión C3.* |
| `nivel_jerarquico_numero` | number \| null | **[X]** | Opcional, **hint** a nivel cargo; el **nivel operativo en organigrama / burbuja** se define **por grupo** en **`hlg_*.nivel_jerarquico` (1–99, C10).** No sustituye el burbujeo de Ticket. |
| `es_asignacion_principal` | boolean | **[X]** | Hint UI / Ticket entre cargos vigentes. |
| `observaciones_rrhh` | string \| null | **[X]** | |
| `creado_por_persona_id` | string \| null | **[X]** | |
| `creado_en` / `actualizado_en` | Timestamp | **[O]** | |
| `schema_version` | number | **[O]** | |

**Reglas de integridad**

- **Varias vigentes:** permitido **N** `hlc_*` por `persona_id` con cierre abierto, según negocio.
- **Designación vs cumplimiento:** mismos o distintos **ids** en `cfg_efectores`; señal de igualdad = reglas comunes a Ticket/informes.
- **Cierre:** `fecha_hasta` exige **`causal_fin_asignacion_id`**.

**Índices sugeridos:** `persona_id` + `fecha_hasta` + `estado_asignacion_id`; `efector_cumplimiento_id`; `efector_designacion_id`.

### 4.4 `historial_laboral_datos` (`hld_*`) y `historial_laboral_grupos` (`hlg_*`)

Nivel 2 y 3: el **contrato canónico** sigue en [`PLAN_DESARROLLO_VERSION2.md`](../../PLAN_DESARROLLO_VERSION2.md) §B, ampliado aquí con criterio **C10** (ver [`DECISIONES_REVISION_PERSONALES_LABORALES_V2.md`](./DECISIONES_REVISION_PERSONALES_LABORALES_V2.md)).

**Relación:** un **`hlc_*`** (cargo) puede asociarse a **uno o más** `hld_*` y, a través de ellos, a **varias** filas `hlg_*` — **una fila `hlg_*` por cada par** (vínculo de datos laborales × **grupo de trabajo** × periodo de vigencia) cuando el agente participa en **varias burbujas** con reglas distintas. *Cardinalidad exacta hlc↔hld según implementación;* lo mínimo exigido por producto es: **para cada grupo de trabajo asignado al usuario en el marco del cargo**, existir la fila `hlg_*` con los campos de **§4.4.1**.

#### 4.4.0 `historial_laboral_datos` (`hld_*`) — Nivel 2

| Campo | Tipo | Obl. | Descripción |
|-------|------|------|-------------|
| `id` | `hld_<ULID>` | **[O]** | |
| `cargo_id` | string | **[O]** | FK `historial_laboral_cargos.id` (`hlc_*`). |
| `persona_id` | string | **[O]** | FK `personas`. |
| `escalafon_id` | string \| null | **[X]** | Opcional; puede duplicar o precisar el de `hlc_*` según reglas. |
| `agrupamiento_id` | string \| null | **[X]** | |
| `funcion_real_id` | string \| null | **[X]** | |
| `muro_id` | string \| null | **[X]** | |
| `nivel_jerarquico` | number \| null | **[X]** | Opcional en `hld_*` si el flujo lo usa. El nivel que gobierna **burbuja y Ticket** en contexto de grupo es **`hlg_*.nivel_jerarquico`** (1–99) (**C10**). Misma semántica: entero, sin catálogo. |
| `carga_horaria_diaria` | number \| null | **[X]** | Deprecar a favor del desglose semanal en `hlg_*` salvo reglas que exijan un solo escalar. |
| `fecha_inicio` / `fecha_fin` | Timestamp \| null | **[X]** | Periodo del bloque de datos; puede alinearse a vigencias de `hlg_*`. |
| `activo` | boolean | **[O]** | |
| `creado_en` / `actualizado_en` | Timestamp | **[O]** | |
| `schema_version` | number | **[O]** | |

#### 4.4.1 `historial_laboral_grupos` (`hlg_*`) — Nivel 3 (burbuja, jerarquía y carga semanal)

Una fila = **asignación del `persona_id` a un `grupo_de_trabajo_id` concreto** con su propia vigencia, **nivel de jerarquía** y **carga por días** — insumo de **burbujeo, licencias, Ticket, informes** (C10).

| Campo | Tipo | Obl. | Descripción |
|-------|------|------|-------------|
| `id` | `hlg_<ULID>` | **[O]** | |
| `dato_laboral_id` | string | **[O]** | FK `historial_laboral_datos.id` (`hld_*`). |
| `persona_id` | string | **[O]** | Denormalizado; coherente con `hlc_*` / `hld_*`. |
| `grupo_de_trabajo_id` | string | **[O]** | FK `gdt_*` (burbuja / unidad de organigrama). |
| `fecha_inicio` | Timestamp | **[O]** | Inicio de la asignación a este grupo. |
| `fecha_fin` | Timestamp \| null | **[C]** | `null` = vigente. |
| `nivel_jerarquico` | number | **[O]** | Entero **1–99**: jerarquía del agente **en este** `grupo_de_trabajo` (burbuja). **No** es colección `cfg_*`; la comparación en reglas (burbujeo, visibilidad) es **numérica** en Callables. Si coexisten con `hld_*.nivel_jerarquico` / `hlc_*.nivel_jerarquico_numero`, predomina **`hlg_*`** para organigrama (C10). |
| `carga_por_dia_semana` | array de map | **[O]** | Desglose **día a día** (ver **§4.5**). Cada ítem: **`dia_semana_id`** (FK **`cfg_dia_semana`**, p. ej. lunes…domingo) y **`horas`** (number, p. ej. 4,5). **Uso posterior:** imputación, reglas de disponibilidad, franjas. |
| `activo` | boolean | **[O]** | |
| `creado_en` / `actualizado_en` | Timestamp | **[O]** | |
| `schema_version` | number | **[O]** | |

**Reglas de integridad (C4 + C10):**

- Puede haber **varias** filas `hlg_*` (distintos `grupo_de_trabajo_id` o periodos) enlazadas al mismo `hld_*` / `hlc_*`.
- La **suma de `horas`** de `carga_por_dia_semana` en la semana de referencia debe ser **reconciliable** con el reparto esperado frente a **`carga_horaria_total`** de `hlc_*` (validación en servicio/Callable, con tolerancia o desvío explicado en `observaciones_rrhh` del `hlc_*` si aplica).
- Un mismo `persona_id` + `grupo_de_trabajo_id` + solape de fechas: **prohibido** o resuelto por cierre lógico de la fila previa, según regla de producto (documentar en Rulebook al implementar).

---

### 4.5 Detalle estructurado: `carga_por_dia_semana` *(contrato mínimo)*

Arreglo en **`hlg_*.carga_por_dia_semana`**. Cada elemento:

| Clave (dentro del map ítem) | Tipo | Obl. | Descripción |
|-----------------------------|------|------|-------------|
| `dia_semana_id` | string | **[O]** | FK **`cfg_dia_semana`**: un documento por día lógico (orden de visualización y código interno en catálogo). **No** usar entero 1..7 suelto en datos salvo mapeo explícito a `cfg_*` en la app. |
| `horas` | number | **[O]** | Horas asignadas ese día en **este** grupo (decimales permitidos). |

*Alternativa de implementación:* un **mapa** fijo con claves = ids de `cfg_dia_semana` y valor = horas; se documenta al codificar, manteniendo **una sola fuente de verdad** para días. Los valores alimentan módulos posteriores (planificación, Ticket, nómina de horas) **desde** esta estructura.

*No bloquea* un alta mínima de `hlc_*` con solo `carga_horaria_total` mientras el producto permita **completar `hlg_*` en un segundo paso**; si el hospital exige burbuja completa, el Callable rechaza cierre sin `hlg_*` conforme.

#### 4.5.1 Unidad y reconciliación con `hlc_*.carga_horaria_total`

- **`carga_horaria_total`** en `hlc_*` se interpreta en el mismo producto como **carga referencial en horas por semana** del **cargo** (vigente en las fechas del `hlc_*`), salvo **RFC** expresa de otro significado (p. ej. quincenal) que obligue a duplicar el campo o a añadir `carga_periodo_tipo_id` en un release posterior.
- Para un documento `hlg_*` concreto, defínanse:
  - **`S_hlg`:** suma de los campos **`horas`** de todos los ítems de **`carga_por_dia_semana`**. Cada `dia_semana_id` **a lo sumo una vez** por fila `hlg_*` (validar al guardar). El mismo día de la semana en **otra** fila `hlg_*` = distinta burbuja, permitido.
- **Un solo `hlg_*`** bajo el mismo `hlc_*` (un único desglose): **`|S_hlg - carga_horaria_total| ≤ ε`**, p. ej. **ε = 0,01** horas, salvo excepción anotada en `observaciones_rrhh` del `hlc_*`.
- **Varios `hlg_*`** bajo el mismo `hlc_*` (un cargo, varias burbujas): **suma de los `S_hlg` de cada `hlg_*` ≈ `carga_horaria_total`** con el mismo **ε** (el total semanal del cargo = reparto entre grupos).

*Implementación sugerida:* un Callable recalcula `S_hlg` al guardar; opcional `carga_semanal_calculada` denormalizado en `hlg_*` para consultas, sin reemplazar el arreglo pormenorizado.

#### 4.5.2 Ejemplo de `carga_por_dia_semana` (referencia, ids ilustrativos)

Valores de `dia_semana_id` = ULIDs reales en **`cfg_dia_semana`**; los mostrados abajo son **placeholders**.

```json
[
  { "dia_semana_id": "dse_01HXYZ…LUN", "horas": 0 },
  { "dia_semana_id": "dse_01HXYZ…MAR", "horas": 8.5 },
  { "dia_semana_id": "dse_01HXYZ…MIE", "horas": 8.5 },
  { "dia_semana_id": "dse_01HXYZ…JUE", "horas": 8 },
  { "dia_semana_id": "dse_01HXYZ…VIE", "horas": 0 },
  { "dia_semana_id": "dse_01HXYZ…SAB", "horas": 0 },
  { "dia_semana_id": "dse_01HXYZ…DOM", "horas": 0 }
]
```

En este ejemplo, **`S_hlg` = 25,0** horas semanales. Si el `hlc_*` asociado tiene `carga_horaria_total` = 25,0 y no hay otra fila `hlg_*` para el mismo `hlc_*`, la regla de reconciliación pasa.  
**Nota UI:** días con **0 h** se pueden **omitir** en el arreglo si el Callable normaliza a “7 filas fijas al leer” o acepta arreglo sparse; en ambos casos, **sumar solo los ítems presentes** para `S_hlg` (días faltantes = 0 h).

---

## 5. Eventos de auditoría

Incluir: alta/edición/cierre de `hlc_*`, cambios estructurales en **`gdt_*`**, catálogo **`cfg_efectores`**, `hlg_*` cuando aplique, modificaciones a `referencias_normativa_designacion` o a carga horaria.

---

## 6. Inventario `cfg_*` — módulo datos laborales

| Catálogo / datos | Consumidor principal |
|------------------|-------------------------|
| Colección **`grupos_de_trabajo`** (no es `cfg_*`) | Estructura organigrama y encuadre operativo principal en `hlg_*.grupo_de_trabajo_id` (HLc lo puede conservar como legado opcional). |
| Colección **`cfg_efectores`** | `efector_designacion_id`, `efector_cumplimiento_id` en `hlc_*`; campo **`es_efector_institucional`** en el documento de efector. (La antigua colección `efectores` está **deprecada**; ver §4.2.) |
| `cfg_tipo_grupo` | `grupos_de_trabajo.tipo_grupo_id` (si se tipifica el nodo). |
| `cfg_cargo_funcional` | `historial_laboral_cargos.cargo_funcional_id` |
| `cfg_tipo_vinculo_laboral` | `historial_laboral_cargos.tipo_vinculo_id` |
| `cfg_escalafon` | `historial_laboral_cargos.escalafon_id` |
| `cfg_modalidad_jornada` | `historial_laboral_cargos.modalidad_jornada_id` |
| `cfg_estado_asignacion_laboral` | `historial_laboral_cargos.estado_asignacion_id` |
| **`cfg_causal_fin_asignacion_laboral`** | **`historial_laboral_cargos.causal_fin_asignacion_id`** (motivo de finalización; **configurable**). |
| **`cfg_tipo_acto_designacion`** | **`referencias_normativa_designacion[].tipo_acto_id`** (decreto, resolución, etc.). |
| **`cfg_dia_semana`** | Elementos de **`carga_por_dia_semana`**: `dia_semana_id` (patrón semanal de horas, **C10**). |
| *(Nivel de jerarquía)* | *No aplica: **`hlg_*.nivel_jerarquico` (1–99)** y opcionalmente **`hld_*.nivel_jerarquico`**, sin `cfg_nivel_jerarquia`.* |

**Impacto sueldo en licencias/artículos:** catálogos y opciones por artículo → **módulo configuración** + **Ticket** (no duplicar aquí la matriz de impacto diario/total/porcentaje).

**Semilla:** `npm run seed:configuracion` (catálogos base) +, donde aplique, ULIDs; laboral avanzado §6 (5 colecciones) y `cfg_dia_semana` en el mismo script.

---

## 7. Flujos de negocio (resumen)

### 7.1 Alta sin cargos

Igual que antes: tras Login/datos personales puede no existir `hlc_*` aún.

### 7.2 Alta / modificación por RRHH

1. Selección de `persona_id`.
2. Selección de documentos **`gdt_*`** y de efectores en **`cfg_efectores`** (altas = flujos **módulo configuración** u operativos acordados).
3. Alta de **`hlc_*`** con `grupo_de_trabajo_id` y **dos** ids de **`cfg_efectores`** (designación y cumplimiento), fechas, **`carga_horaria_total`** en **horas**, referencias normativas.
3bis. Asociar **`hld_*`** (si el flujo lo usa) y, por **cada grupo de trabajo (burbuja)** al que aplica el agente: **`hlg_*`** con `grupo_de_trabajo_id`, `fecha_inicio`/`fecha_fin`, **`nivel_jerarquico` (1–99)**, **`carga_por_dia_semana`**, validado contra el total (C4/C10).
4. **Varios cargos paralelos:** nuevas filas **sin** cerrar las anteriores salvo que el acto administrativo sea reemplazo explícito (regla de negocio en Callable).
5. **Cierre** de un cargo: `fecha_hasta`, `causal_fin_asignacion_id`, `estado_asignacion_id` finalizada + cierre o baja lógica de `hlg_*` asociados + `evt_*`.

### 7.3 Flujo de interfaz recomendado (pantalla Datos Laborales)

1. RRHH selecciona “Nivel 1 (Cargo)” y completa `HLc`.
2. Si necesita detalle adicional de convenio/rol, completa `HLd` (opcional).
3. Carga “Nivel 2 (Grupo de trabajo)” en `HLg`, incluyendo:
   - `grupo_de_trabajo_id`,
   - `nivel_jerarquico` (1–99),
   - `carga_por_dia_semana`.
4. El sistema valida integridad referencial y muestra alertas de inconsistencias.

**Nota:** esta secuencia es de UX; la estructura de BD mantiene las 3 colecciones (`hlc`, `hld`, `hlg`).

---

## 8. Matriz de ownership *(borrador)*

Agente lee lo propio; RRHH escribe **`hlc_*`**, `hld_*`/`hlg_*` y participa en criterios de **`gdt_*`**; **alta/estructura** de `gdt_*` y del catálogo **`cfg_efectores`** según roles. Catálogos/árbol los mantienen **administración / configuración** (no mezclar con edición masiva de cargos salvo política explícita).

---

## 9. Contrato con **Ticket** / otra PC

- **Misma filosofía:** IDs, `cfg_*`, estados por id, sin hardcoding.
- **Jerarquía / jefe inmediato:** lógica de **burbujeo** y comparación de **nivel** numérica con **`hlg_*.nivel_jerarquico` (1–99)**; **no** hay `cfg_nivel_jerarquia`. Doc Ticket en otra PC; no `supervisor` en `hlc_*`/`hlg_*`.
- **Datos que Ticket puede leer:** `persona_id`, `hlc_*` vigentes, `hlg_*` (nivel y carga por burbuja), resolución vía joins de **`gdt_*`**, **`cfg_efectores`**, resto de `cfg_*` y campos de cargo/causal.
- **Otra PC / Ticket ya avanzado:** al **fusionar**, alinear nombres a **`grupos_de_trabajo`**, **`cfg_efectores`** (sustituye referencias a la colección legacy `efectores` donde aún existan), `hlc_*` (**§4.1–4.3**).
- **Mañana:** unificar nombres de campos/colecciones y prerequisitos de avisos con el documento Ticket ya desarrollado.

---

## 10. Acuerdos de producto *(registrados 23/04/2026)*

| Tema | Acuerdo |
|------|----------|
| Varios cargos vigentes | Sí; misma `persona_id`, varios `hlc_*` activos; mismo u otro hospital/efector. |
| Efectores | Dos FK por cargo a **`cfg_efectores`**: designación y cumplimiento. Marca **efector institucional** = **`es_efector_institucional`** en el documento de catálogo. |
| Activo laboralmente | Al menos un `hlc_*` activo y vigente. |
| Fechas y causal | `fecha_desde` / `fecha_hasta`; si hay fin, **causal** seleccionable desde **configuración** (`cfg_*`). |
| Carga horaria | **`carga_horaria_total`**: **horas** a nivel `hlc_*`. **Reparto** y desglose **día a día** por **burbuja** en `hlg_*` (**`carga_por_dia_semana`**, §4.5; **C10**). Suma semanal reconciliable con el total. |
| Nivel en organigrama | **Por `grupo_de_trabajo` en `hlg_*`:** `nivel_jerarquico` entero **1–99** (C10). **No** es catálogo. **No** sustituye a la lógica de burbujeo de Ticket, pero alimenta comparaciones y visibilidad. |
| Jefe inmediato | **No** en `hlc_*` ni `hlg_*` como FK a persona; resolución en **Ticket** / burbujeo. |
| Referencias legales | Por cargo, asociadas a la designación con `fecha_desde` → array **`referencias_normativa_designacion`**. |
| Nómina | **No** liquida la app; impactos de sueldo vía **artículos/licencias** y **configuración**. |
| Firebase PIN | Por ahora **solo** política mínima PIN 6; revisar en la práctica ([`RULEBOOK_V2.md`](./RULEBOOK_V2.md), [`MODULO_LOGIN_V2.md`](./MODULO_LOGIN_V2.md)). |

**Cerrado (acuerdo con producto):** unidad de **`carga_horaria_total`** = **horas**. **Pendiente opcional (RFC):** 1:1 entre un efector en **`cfg_efectores`** y un `gdt_*`.

---

## 11. Checklist — cierre futuro del “plan doc” laboral

- [x] Criterios de §10 registrados (unidad carga horaria = horas; `cfg_efectores` + `gdt_*`; pendiente opcional fusión efector–`gdt_*`).
- [ ] Matriz de acceso y Callables (ampliación [`ACCESO_Y_RULES_FIRESTORE_V2.md`](./ACCESO_Y_RULES_FIRESTORE_V2.md)).
- [x] Semilla mínima §6 (jornada, estados, causales, tipo acto, tipo grupo) en `npm run seed:configuracion` + panel; §5.1 alinear inventario.
- [ ] Unificación explícita con doc **Ticket** de la otra PC.
- [ ] Índices Firestore desplegados y validados en el proyecto (consola / `firebase-v2/firestore.indexes.json`).
- [x] **§4.4–4.5** y **C10:** `hlg_*` con `nivel_jerarquico` (1–99) y `carga_por_dia_semana` + catálogo `cfg_dia_semana` (seed); **sin** `cfg_nivel_jerarquia` (nivel = número en documento).
- [ ] Validación Callable: suma semanal `hlg_*` vs `carga_horaria_total` y solapes de fechas.

---

## Changelog

| Fecha | Cambio |
|-------|--------|
| 2026-04-22 | Creación: borrador mínimo para trabajo en paralelo sin doc Ticket. |
| 2026-04-22 | **Borrador ampliado:** `grp_*`, `hlc_*`, campos, `cfg_*` §6, flujos, ownership, contrato Ticket §9, preguntas §10, checklist §11. |
| 2026-04-23 | **Acuerdos de producto:** varios cargos vigentes; dual efector (modelo luego unificado y **sustituido** 23/04 — ver fila inferior); causal fin; carga en horas; etc. |
| 2026-04-22 | Alineación a configuración global: vigencia en catálogos; §3 (sin borrado catálogo). |
| 2026-04-23 | Nombres canónicos (intermedio con `grupos` unificado; **obsoleto** — ver 23/04 fila `gdt`/`efe`). |
| 2026-04-22 | §1 ítem 3: enlace a estados RRHH (**activo / inactivo laboral / deshabilitado**) en [`CUESTIONES_ESTADOS_LABORAL_PERSONA_RRHH_V2.md`](./CUESTIONES_ESTADOS_LABORAL_PERSONA_RRHH_V2.md). |
| 2026-04-23 | Cabecera: deja de decir “Login+personales ya cerrado”; *también pend. revisión global*. |
| 2026-04-23 | **Dominio A2** [`DECISIONES_REVISION_PERSONALES_LABORALES_V2.md`](./DECISIONES_REVISION_PERSONALES_LABORALES_V2.md): `grupos_de_trabajo` (`gdt_*`) y `efectores` (`efe_*`); `hlc_*` con `grupo_de_trabajo_id` + `efector_designacion_id` + `efector_cumplimiento_id`. §4 = 4.1–4.5; inventario y §7–10 actualizados. |
| 2026-04-27 | **Una sola fuente de verdad (panel/ABM):** catálogo de efectores canónico = **`cfg_efectores`**; `efector_*_id` → `cfg_efectores/{id}`. Colección legacy **`efectores`** **deprecada**; §4.2, §1, §3, §5–7 y §9–10 alineados; plan maestro y Rulebook actualizados en el mismo criterio. |
| 2026-04-27 | **Nivel de jerarquía:** deja de documentarse `cfg_nivel_jerarquia` / `nivel_jerarquia_id`. **`hlg_*.nivel_jerarquico`** (y opc. **`hld_*.nivel_jerarquico`**) = **número 1–99**; seeds laborales avanzados (`cfg_modalidad_jornada`, `cfg_estado_asignacion_laboral`, `cfg_causal_fin_asignacion_laboral`, `cfg_tipo_acto_designacion`, `cfg_tipo_grupo`) en `seed:configuracion` + panel. |
| 2026-04-23 | **C10:** `hlg_*` con `nivel_jerarquico` / jerarquía **por** grupo de trabajo (antes redactado con catálogo; hoy entero 1–99) y `carga_por_dia_semana` (horas **por** día, `cfg_dia_semana`); tablas **§4.4.0–4.4.1** y **§4.5**; `cfg` §6; §1, §2, §3, §7.2, §9–10; `hld_*` ajuste `nivel_jerarquico` vs `hlg`. |
| 2026-04-23 | **§4.5.1–4.5.2:** reconciliación `S_hlg` / `carga_horaria_total` (ε, uno o N `hlg_*`); ejemplo JSON; unidad = horas por semana en el cargo (salvo RFC). |
| 2026-04-28 | **Clarificación UX/BD:** se documentan **2 niveles operativos de pantalla** (Nivel 1 `HLc`, Nivel 2 `HLg`) y se mantiene `HLd` como capa técnica opcional, sin alterar el contrato de persistencia de 3 colecciones. |
