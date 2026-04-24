# Módulo de datos laborales — Plan V2

**Estado del plan (documentación):** **borrador ampliado** (contrato actualizado con acuerdos de producto; matriz de acceso fina, subnivel de carga horaria detallada y alineación con **Ticket** cuando se unifique doc). **No** bloquea el vertical Login + datos personales (módulo con documentación **más avanzada**; *también pend. revisión global*).

**Marco:** [`PLAN_MODULOS_V2.md`](./PLAN_MODULOS_V2.md) · [`RULEBOOK_V2.md`](./RULEBOOK_V2.md).  
**Ancla transversal:** **`persona_id`** (`per_<ULID>`) en toda fila laboral; **no** usar DNI, email ni `auth_uid` como FK entre módulos.  
**Ficha humana:** [`MODULO_DATOS_PERSONALES_V2.md`](./MODULO_DATOS_PERSONALES_V2.md) (nombre, DNI, etc.); este módulo **no** duplica esos datos en asignaciones salvo **snapshots** acordados explícitamente por ley o informe (fuera del contrato base).

**Catálogos:** inventario `cfg_*` laborales en **§6**; incorporación formal al inventario global en [`MODULO_CONFIGURACION_V2.md`](./MODULO_CONFIGURACION_V2.md) **§5.1**.

**Acceso (orientación):** transiciones sensibles en **Callables** + Rules restrictivas; ampliación laboral en [`ACCESO_Y_RULES_FIRESTORE_V2.md`](./ACCESO_Y_RULES_FIRESTORE_V2.md) cuando se cierre el módulo.

**Fecha:** 22 de abril de 2026.

---

## 1. Objetivo del módulo

1. Persistir **cargos** del agente: **un** vínculo a unidad/organigrama vía **`grupos_de_trabajo` (`gdt_*`)**, **dos** referencias a **`efectores` (`efe_*`)** (designación normativa vs cumplimiento real de funciones), **cargo / función**, **vínculo**, **escalafón** (si aplica), **jornada**, **vigencia** (`fecha_desde` / `fecha_hasta`), **causal de fin** configurable y **carga horaria total** al cargo.
2. Permitir **varios cargos activos en paralelo** para la misma `persona_id` (mismo hospital u otros efectores), con historial por filas cerradas (`fecha_hasta` + causal).
3. Definir **activo laboralmente:** el agente lo está **si existe al menos un** `hlc_*` en estado **activo** y vigente (`fecha_hasta == null` o vigencia actual según regla de negocio) — sin depender de flags en `personas`. *Cruce con RRHH:* bajas laborales, deshabilitado y filtros de listados se documentan en [`CUESTIONES_ESTADOS_LABORAL_PERSONA_RRHH_V2.md`](./CUESTIONES_ESTADOS_LABORAL_PERSONA_RRHH_V2.md).
4. Servir de **fuente de verdad** para Ticket / bandejas por **`persona_id`** + ids de efectores/unidad/cargo (**sin hardcode**; estados y causales = **`cfg_*`**).
5. Registrar cambios en **`eventos_ticket`** (`evt_*`) con `tipo_evento_id` → `cfg_tipo_evento`.
6. **Subnivel por grupo (`hlg_*`):** cada **asignación** del agente a un **grupo de trabajo** (`gdt_*`) concreto lleva **vigencia propia**, **`nivel_jerarquia_id`** (nivel en esa burbuja) y **carga horaria desagregada por día de semana** — **C10**; contrato **§4.4–4.5**.

---

## 2. Límites con otros módulos

| Módulo | Qué aporta / qué consume |
|--------|---------------------------|
| **Datos personales** | Identidad civil; **no** incluye cargos ni efectores. |
| **Login** | `usuarios_cuenta`; **no** decide si el agente está laboralmente activo (eso es consulta sobre `hlc_*`). |
| **Ticket / solicitudes** *(doc otra PC, más desarrollado)* | **Jerarquía y “jefe inmediato”:** se resuelven por **esquema de burbujeo**; el **nivel** comparable por persona **en cada grupo** está en **`hlg_*` → `nivel_jerarquia_id`** (catálogo). **No** se persiste `supervisor_persona_id` en `hlc_*` en V2. Mismos principios: **IDs** y `cfg_*`. Unificación con doc **al integrar** la otra PC (**§9**). |
| **Configuración** | Catálogos `cfg_*` §6 (incl. causal de fin de cargo, tipos de acto de designación, etc.). **Impacto en sueldo** (diario, total, porcentaje, …) de licencias/artículos: **no** es liquidación de nómina; las opciones seleccionables viven en la **configuración del artículo** y catálogos del **módulo configuración** — ver Ticket / módulo artículos, **no** en el núcleo de `hlc_*`. |
| **Nómina / liquidación** | **Fuera de alcance** de esta aplicación: el portal **no** liquida sueldos. |

---

## 3. Principios de modelado

1. **`persona_id` única** por agente; **varios** `hlc_*` pueden estar **activos y vigentes a la vez** (mismo u otro efector, mismo u otro hospital según designación y cumplimiento).
2. **Efector de designación** vs **efector de cumplimiento:** pueden coincidir o no. Ambos son **FK a `efectores.id` (`efe_*`)**; catálogo mantenible por **módulo configuración**; **no** texto libre. La igualdad **`efector_designacion_id` == `efector_cumplimiento_id`** es **señal explícita** para reglas (bandejas, informes, Ticket). *RFC:* fusión 1:1 con un nodo `gdt_*` si el hospital lo exige.
3. **Grupos de trabajo** (`gdt_*`): el **organigrama** (servicio, sector, nodo de jerarquía). En `hlc_*`, **`grupo_de_trabajo_id`** fija el **encuadre principal** del acto; en **`hlg_*`**, **cada** vínculo persona–grupo tiene `grupo_de_trabajo_id`, **vigencia**, **`nivel_jerarquia_id`** y **carga por día** (**C10**). Un agente puede tener **varias** filas `hlg_*` (varias burbujas). **No** se mezcla `gdt_*` con el catálogo de efectores.
4. **Listas cerradas** = **`*_id` → `cfg_*`**: cada valor con **id única**; textos y vigencias solo en el catálogo (**[`MODULO_CONFIGURACION_V2.md`](./MODULO_CONFIGURACION_V2.md)** §1–§2). Causal de fin de vigencia = **`cfg_causal_fin_asignacion_laboral`** (u homónimo al fusionar Rulebook). **No** se borran filas de catálogo en producto: baja lógica y/o cierre de vigencia.
5. **Referencias legales** de designación: van **asociadas a cada cargo** con `fecha_desde`; detallan la normativa que designa el cargo (estructura en **§4.3** / campo `referencias_normativa_designacion`).
6. **No** persistir en `hlc_*` nombres de persona/servicio como SSoT: solo ids + joins.

---

## 4. Colecciones — contrato base

*Los nombres y prefijos coinciden con [`PLAN_DESARROLLO_VERSION2.md`](../../PLAN_DESARROLLO_VERSION2.md) (§ ESTRUCTURA DE BASE DE DATOS V2, apartados A–B, D).*

### 4.1 `grupos_de_trabajo` — id `gdt_<ULID>`

**Unidades de organigrama** (servicio, sector, nodo de jerarquía operativa). Alineado a [`PLAN_DESARROLLO_VERSION2.md`](../../PLAN_DESARROLLO_VERSION2.md) §B. **No** aloja el catálogo de efectores (eso es **`efectores`**).

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

### 4.2 `efectores` — id `efe_<ULID>`

**Catálogo** de lugares/efectores institucionales donde aplica la designación o el cumplimiento. Configurable (alta/edición vía módulo correspondiente); **ids estables** en `hlc_*` y Ticket.

| Campo | Tipo | Obl. | Descripción |
|-------|------|------|-------------|
| `id` | `efe_<ULID>` | **[O]** | |
| `codigo` | string \| null | **[X]** | |
| `nombre` | string | **[O]** | |
| `es_efector_institucional` | boolean | **[O]** | Marca del efector “de este portal”; **a lo sumo** un `true` por despliegue, según validación. |
| `activo` | boolean | **[O]** | |
| `vigente_desde`, `vigente_hasta` | Timestamp \| null | **[O]** | |
| `creado_en` / `actualizado_en` | Timestamp | **[O]** | |
| `schema_version` | number | **[O]** | |

**Índices sugeridos:** `activo` + `vigente_hasta`; `es_efector_institucional`.

### 4.3 `historial_laboral_cargos` — id `hlc_<ULID>`

Nivel 1 (cargo) — plan maestro §B. Cada documento = **un cargo** con su vigencia; el detalle operativo sigue en `historial_laboral_datos` y `historial_laboral_grupos` (`hld_*`, `hlg_*`).

| Campo | Tipo | Obl. | Descripción |
|-------|------|------|-------------|
| `persona_id` | string | **[O]** | FK `personas/{per_*}`. |
| `grupo_de_trabajo_id` | string | **[O]** | FK **`gdt_*`**: dependencia / encuadre operativo del cargo. |
| `efector_designacion_id` | string | **[O]** | FK **`efe_*`**: marco **normativo** de designación (valor **seleccionable** en catálogo). |
| `efector_cumplimiento_id` | string | **[O]** | FK **`efe_*`**: lugar **real** de cumplimiento de funciones. |
| `cargo_funcional_id` | string | **[O]** | FK **`cfg_cargo_funcional`**. |
| `tipo_vinculo_id` | string | **[O]** | FK **`cfg_tipo_vinculo_laboral`**. |
| `escalafon_id` | string \| null | **[X]** | FK **`cfg_escalafon`**. |
| `modalidad_jornada_id` | string \| null | **[X]** | FK **`cfg_modalidad_jornada`**. |
| `fecha_desde` | Timestamp | **[O]** | Inicio del cargo. |
| `fecha_hasta` | Timestamp \| null | **[C]** | `null` = cargo **vigente**. Si se cierra, obligatorio **`causal_fin_asignacion_id`**. |
| `causal_fin_asignacion_id` | string \| null | **[C]** | FK **`cfg_causal_fin_asignacion_laboral`**. **Obligatorio no-null** si `fecha_hasta` no es `null`. |
| `estado_asignacion_id` | string | **[O]** | FK **`cfg_estado_asignacion_laboral`**. |
| `carga_horaria_total` | number | **[O]** | Carga **total** del cargo en **horas** (*§4.5* reparte este total). |
| `referencias_normativa_designacion` | array de map | **[O]** | Referencias legales del acto (cada ítem: **`tipo_acto_id`** → **`cfg_tipo_acto_designacion`**, `numero` string, `fecha` Timestamp, `detalle` string opcional). *Excepciones: ver decisión C3.* |
| `nivel_jerarquico_numero` | number \| null | **[X]** | Opcional, **hint** a nivel cargo; el **nivel operativo en organigrama / burbuja** se define **por grupo** en **`hlg_*`** (`nivel_jerarquia_id`, **C10**). No sustituye el burbujeo de Ticket. |
| `es_asignacion_principal` | boolean | **[X]** | Hint UI / Ticket entre cargos vigentes. |
| `observaciones_rrhh` | string \| null | **[X]** | |
| `creado_por_persona_id` | string \| null | **[X]** | |
| `creado_en` / `actualizado_en` | Timestamp | **[O]** | |
| `schema_version` | number | **[O]** | |

**Reglas de integridad**

- **Varias vigentes:** permitido **N** `hlc_*` por `persona_id` con cierre abierto, según negocio.
- **Designación vs cumplimiento:** mismos o distintos `efe_*`; señal de igualdad = reglas comunes a Ticket/informes.
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
| `rol_id` | string \| null | **[X]** | FK `cfg_*` si aplica. |
| `escalafon_id` | string \| null | **[X]** | Opcional; puede duplicar o precisar el de `hlc_*` según reglas. |
| `agrupamiento_id` | string \| null | **[X]** | |
| `funcion_real_id` | string \| null | **[X]** | |
| `muro_id` | string \| null | **[X]** | |
| `nivel_jerarquico` | number \| null | **[X]** | *Legado / hint.* El **nivel de jerarquía** que gobierna **burbuja y Ticket** vive en **`hlg_*`**, **`nivel_jerarquia_id`** (**C10**). |
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
| `nivel_jerarquia_id` | string | **[O]** | FK **`cfg_nivel_jerarquia`**: nivel de jerarquía del agente **en este grupo** (no basta el opcional de `hlc_*`). Orden y etiquetas salen del catálogo. |
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

Incluir: alta/edición/cierre de `hlc_*`, cambios estructurales en **`gdt_*`**, **`efe_*`**, `hlg_*` cuando aplique, modificaciones a `referencias_normativa_designacion` o a carga horaria.

---

## 6. Inventario `cfg_*` — módulo datos laborales

| Catálogo / datos | Consumidor principal |
|------------------|-------------------------|
| Colección **`grupos_de_trabajo`** (no es `cfg_*`) | Estructura organigrama; `historial_laboral_cargos.grupo_de_trabajo_id`; `hlg_*.grupo_de_trabajo_id`. |
| Colección **`efectores`** (no es `cfg_*`) | `efector_designacion_id`, `efector_cumplimiento_id` en `hlc_*`; **`es_efector_institucional`**. |
| `cfg_tipo_grupo` | `grupos_de_trabajo.tipo_grupo_id` (si se tipifica el nodo). |
| `cfg_cargo_funcional` | `historial_laboral_cargos.cargo_funcional_id` |
| `cfg_tipo_vinculo_laboral` | `historial_laboral_cargos.tipo_vinculo_id` |
| `cfg_escalafon` | `historial_laboral_cargos.escalafon_id` |
| `cfg_modalidad_jornada` | `historial_laboral_cargos.modalidad_jornada_id` |
| `cfg_estado_asignacion_laboral` | `historial_laboral_cargos.estado_asignacion_id` |
| **`cfg_causal_fin_asignacion_laboral`** | **`historial_laboral_cargos.causal_fin_asignacion_id`** (motivo de finalización; **configurable**). |
| **`cfg_tipo_acto_designacion`** | **`referencias_normativa_designacion[].tipo_acto_id`** (decreto, resolución, etc.). |
| **`cfg_nivel_jerarquia`** | **`historial_laboral_grupos.nivel_jerarquia_id`** (nivel en la burbuja, **C10**). |
| **`cfg_dia_semana`** | Elementos de **`carga_por_dia_semana`**: `dia_semana_id` (patrón semanal de horas, **C10**). |

**Impacto sueldo en licencias/artículos:** catálogos y opciones por artículo → **módulo configuración** + **Ticket** (no duplicar aquí la matriz de impacto diario/total/porcentaje).

**Semilla:** ULID en despliegue; placeholders hasta script `seed-v2-laboral`.

---

## 7. Flujos de negocio (resumen)

### 7.1 Alta sin cargos

Igual que antes: tras Login/datos personales puede no existir `hlc_*` aún.

### 7.2 Alta / modificación por RRHH

1. Selección de `persona_id`.
2. Selección de documentos **`gdt_*`**, **`efe_*`** (altas = flujos **módulo configuración** u operativos acordados).
3. Alta de **`hlc_*`** con `grupo_de_trabajo_id` y **dos** `efe_*` (designación y cumplimiento), fechas, **`carga_horaria_total`** en **horas**, referencias normativas.
3bis. Asociar **`hld_*`** (si el flujo lo usa) y, por **cada grupo de trabajo (burbuja)** al que aplica el agente: **`hlg_*`** con `grupo_de_trabajo_id`, `fecha_inicio`/`fecha_fin`, **`nivel_jerarquia_id`**, **`carga_por_dia_semana`**, validado contra el total (C4/C10).
4. **Varios cargos paralelos:** nuevas filas **sin** cerrar las anteriores salvo que el acto administrativo sea reemplazo explícito (regla de negocio en Callable).
5. **Cierre** de un cargo: `fecha_hasta`, `causal_fin_asignacion_id`, `estado_asignacion_id` finalizada + cierre o baja lógica de `hlg_*` asociados + `evt_*`.

---

## 8. Matriz de ownership *(borrador)*

Agente lee lo propio; RRHH escribe **`hlc_*`**, `hld_*`/`hlg_*` y participa en criterios de **`gdt_*`**; **alta/estructura** de `gdt_*` y `efe_*` según roles. Catálogos/árbol los mantienen **administración / configuración** (no mezclar con edición masiva de cargos salvo política explícita).

---

## 9. Contrato con **Ticket** / otra PC

- **Misma filosofía:** IDs, `cfg_*`, estados por id, sin hardcoding.
- **Jerarquía / jefe inmediato:** lógica de **burbujeo** y comparación de **nivel** usando **`hlg_*.nivel_jerarquia_id` → `cfg_nivel_jerarquia`**; doc Ticket en otra PC; no `supervisor` en `hlc_*`/`hlg_*`.
- **Datos que Ticket puede leer:** `persona_id`, `hlc_*` vigentes, `hlg_*` (nivel y carga por burbuja), resolución vía joins de **`gdt_*`**, **`efe_*`**, `cfg_*` y campos de cargo/causal.
- **Otra PC / Ticket ya avanzado:** al **fusionar**, alinear nombres a **`grupos_de_trabajo`**, **`efectores`**, `hlc_*` (**§4.1–4.3**).
- **Mañana:** unificar nombres de campos/colecciones y prerequisitos de avisos con el documento Ticket ya desarrollado.

---

## 10. Acuerdos de producto *(registrados 23/04/2026)*

| Tema | Acuerdo |
|------|----------|
| Varios cargos vigentes | Sí; misma `persona_id`, varios `hlc_*` activos; mismo u otro hospital/efector. |
| Efectores | Dos FK por cargo a **`efectores` (`efe_*`)**: designación y cumplimiento. Marca **efector institucional** = **`es_efector_institucional`** en documentos de **`efectores`**. |
| Activo laboralmente | Al menos un `hlc_*` activo y vigente. |
| Fechas y causal | `fecha_desde` / `fecha_hasta`; si hay fin, **causal** seleccionable desde **configuración** (`cfg_*`). |
| Carga horaria | **`carga_horaria_total`**: **horas** a nivel `hlc_*`. **Reparto** y desglose **día a día** por **burbuja** en `hlg_*` (**`carga_por_dia_semana`**, §4.5; **C10**). Suma semanal reconciliable con el total. |
| Nivel en organigrama | **Por `grupo_de_trabajo` en `hlg_*`:** `nivel_jerarquia_id` → `cfg_nivel_jerarquia` (C10). **No** sustituye a la lógica de burbujeo de Ticket, pero alimenta comparaciones y visibilidad. |
| Jefe inmediato | **No** en `hlc_*` ni `hlg_*` como FK a persona; resolución en **Ticket** / burbujeo. |
| Referencias legales | Por cargo, asociadas a la designación con `fecha_desde` → array **`referencias_normativa_designacion`**. |
| Nómina | **No** liquida la app; impactos de sueldo vía **artículos/licencias** y **configuración**. |
| Firebase PIN | Por ahora **solo** política mínima PIN 6; revisar en la práctica ([`RULEBOOK_V2.md`](./RULEBOOK_V2.md), [`MODULO_LOGIN_V2.md`](./MODULO_LOGIN_V2.md)). |

**Cerrado (acuerdo con producto):** unidad de **`carga_horaria_total`** = **horas**. **Pendiente opcional (RFC):** 1:1 entre un `efe_*` y un `gdt_*`.

---

## 11. Checklist — cierre futuro del “plan doc” laboral

- [x] Criterios de §10 registrados (unidad carga horaria = horas; `efe_*` + `gdt_*`; pendiente opcional fusión `efe_*`–`gdt_*`).
- [ ] Matriz de acceso y Callables (ampliación [`ACCESO_Y_RULES_FIRESTORE_V2.md`](./ACCESO_Y_RULES_FIRESTORE_V2.md)).
- [ ] Semilla §6 + **`cfg_causal_fin_*`** / **`cfg_tipo_acto_designacion`** en script y `MODULO_CONFIGURACION_V2` §5.1.
- [ ] Unificación explícita con doc **Ticket** de la otra PC.
- [ ] Índices Firestore en emulador.
- [x] **§4.4–4.5** y **C10:** `hlg_*` con `nivel_jerarquia_id` y `carga_por_dia_semana` + catálogos `cfg_nivel_jerarquia`, `cfg_dia_semana` (seeds y Rulebook al codificar).
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
| 2026-04-23 | **C10:** `hlg_*` con `nivel_jerarquia_id` (nivel **por** grupo de trabajo) y `carga_por_dia_semana` (horas **por** día, `cfg_dia_semana`); tablas **§4.4.0–4.4.1** y **§4.5**; `cfg` §6; §1, §2, §3, §7.2, §9–10; `hld_*` ajuste `nivel_jerarquico` vs `hlg`. |
| 2026-04-23 | **§4.5.1–4.5.2:** reconciliación `S_hlg` / `carga_horaria_total` (ε, uno o N `hlg_*`); ejemplo JSON; unidad = horas por semana en el cargo (salvo RFC). |
