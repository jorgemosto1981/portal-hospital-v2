# Unificación — otra PC (Ticket) y esta línea de trabajo

**Propósito:** que, al abrir el repo **mañana desde la otra PC**, puedas **actualizar**, **fusionar cambios** y **alinear criterios** entre la documentación / código desarrollado allí (sobre todo **Ticket**) y lo consolidado aquí en **`docs/v2/`** (datos laborales, configuración transversal, Rulebook).

**Fecha de registro:** 22 de abril de 2026.  
**Rama de referencia en esta sesión:** `refactorizacion-fase1` (remoto `origin/refactorizacion-fase1`).

### Estado del remoto — listo para continuar en la otra PC

- **Contenido publicado en `origin/refactorizacion-fase1`:** documentación V2: unificación (este archivo), datos laborales (`grupos_de_trabajo` / `efectores` / `hlc_*`, horas), configuración (`vigente_desde` / `vigente_hasta` en `cfg_*`), Rulebook, cuestiones Ticket/roles/estados, README y PLAN. **No** fijar aquí el hash del tip; el remoto es la fuente de verdad.
- **Comprobación en la otra PC:** tras `git fetch origin` y `git pull origin refactorizacion-fase1`, ejecutar **`git rev-parse HEAD`** y comparar con **`git rev-parse origin/refactorizacion-fase1`**: deben ser **iguales** cuando la rama local esté al día.
- **Fuera de esta entrega documental** (no van en los commits de `docs/v2/` de esta línea): cambios locales sueltos en `src/` o carpetas `backup*` / `backups/` si existen sin trackear; integrarlos solo en un PR aparte si corresponde.

### Objetivos tras la unificación (otra PC + esta línea)

1. **Sesión de mañana:** fusionar criterios y nombres con la **otra PC** (Ticket y lo que traigan en doc/código), usando las **pautas del §3** y el **checklist del §6**.
2. **Objetivo de documentación (núcleo inicial, en progreso):** **consolidar y revisar** (sin aprobación final) el plan de **Login**, **datos personales**, **datos laborales** y **configuración mínima `cfg_*`** que esos módulos consumen (más [`RULEBOOK_V2.md`](./RULEBOOK_V2.md) como borrador de convenciones), hasta alinear criterios para **iniciar código** y **base de datos nueva** (proyecto Firebase / instancia **distinta** de la V1) **sin conexión** con runtime, credenciales ni colecciones de la V1. Revisión según [`PLAN_DESARROLLO_VERSION2.md`](../../PLAN_DESARROLLO_VERSION2.md).
3. **Después:** seguir el **plan e implementación por fases** del resto de módulos (Ticket completo, menús extendidos, notificaciones, etc.) sobre esa misma base V2, sin acoplar al monolito V1.

**`PLAN_DESARROLLO_VERSION2.md` (raíz) vs módulos V2:** el consolidado de máquina de estados y BD vive en gran parte en [`PLAN_DESARROLLO_VERSION2.md`](../../PLAN_DESARROLLO_VERSION2.md). La **conciliación de nombres** (cuentas, laborales, auditoría, `cfg_*`) con `docs/v2` está en [`REVISION_ALINEACION_PLAN_V2.md`](./REVISION_ALINEACION_PLAN_V2.md).

---

## 1. Pasos recomendados al ingresar desde la otra PC

1. **Guardar** trabajo local no commiteado (stash o commit en rama propia).
2. **`git fetch origin`** y **`git checkout refactorizacion-fase1`** (o la rama acordada).
3. **`git pull origin refactorizacion-fase1`** para traer el commit que deja esta carpeta al día (laborales + `cfg_*` transversal + Rulebook + este informe).
4. Si en la otra PC hay commits **solo locales**, integrar con **`git merge`** o **`git rebase`** según convención del equipo; resolver conflictos priorizando las **pautas del §3** y el **checklist del §6**.
5. Abrir este archivo y [`RULEBOOK_V2.md`](./RULEBOOK_V2.md) en paralelo al doc de Ticket / código de la otra PC.

---

## 2. Qué quedó registrado en esta línea (resumen ejecutivo)

| Tema | Decisión / contrato | Documentos |
|------|---------------------|------------|
| Efectores y grupos de trabajo | Catálogo **`efectores`** (`efe_*`); organigrama **`grupos_de_trabajo`** (`gdt_*`); en `hlc_*`: `efector_designacion_id`, `efector_cumplimiento_id`, `grupo_de_trabajo_id`; marca **`es_efector_institucional`**. *Decisión **A2**.* | [`MODULO_DATOS_LABORALES_V2.md`](./MODULO_DATOS_LABORALES_V2.md) §4.1–4.3; plan maestro §B; [`DECISIONES_REVISION_PERSONALES_LABORALES_V2.md`](./DECISIONES_REVISION_PERSONALES_LABORALES_V2.md) |
| Carga horaria | **`carga_horaria_total`**: número en **horas** por cargo | Mismo módulo laboral §4.3, §4.5, §10 |
| Configuración transversal | Toda opción seleccionable desde módulo configuración = **doc `cfg_*` con id única**; **`vigente_desde`** / **`vigente_hasta`**; **sin borrado físico** — baja con **`activo: false`** y/o cierre de vigencia | [`MODULO_CONFIGURACION_V2.md`](./MODULO_CONFIGURACION_V2.md) §1–§2; Rulebook §2 |
| Jerarquía / jefe inmediato | **No** persistido en `hlc_*`; resolución en **Ticket** (burbujeo / nivel) | Módulo laboral §2, §9–§10 |
| Ancla entre módulos | **`persona_id`** (`per_<ULID>`); no DNI / email / `auth_uid` como FK entre módulos | [`PLAN_MODULOS_V2.md`](./PLAN_MODULOS_V2.md), Rulebook §1 |

---

## 3. Pautas de referencia para unificar (prioridad en conflicto)

1. **IDs y catálogos:** si el doc o código de la otra PC usa **strings libres** o nombres de efector/causal pegados en `hlc_*`, la **línea de referencia** V2 es **`*_id` → `cfg_*`** con **documento estable**; el texto solo en el catálogo.
2. **Compatibilidad hacia atrás:** si otra rama usaba **una** colección `grupos` o solo `efe_*` antiguo, migrar a **`gdt_*` + `efe_*`** (tabla de equivalencia; **no** reutilizar un id con otro significado). Ver plan maestro §B.
3. **Vigencia y bajas:** cualquier catálogo nuevo o fusionado debe incorporar **`vigente_desde` / `vigente_hasta`** y **`activo`** según [`MODULO_CONFIGURACION_V2.md`](./MODULO_CONFIGURACION_V2.md) §2; **no** eliminar documentos `cfg_*` en flujos de producto.
4. **Lógica condicional:** **`efector_designacion_id` == `efector_cumplimiento_id`** y el id con **`es_efector_institucional`** = **señales** para Ticket / informes; **centralizar** en helpers.
5. **Ticket consume laborales:** **`persona_id`** + `hlc_*` vigentes + joins a **`gdt_*`**, **`efe_*`**, `cfg_*`; no duplicar SSoT del cargo en Ticket salvo snapshot acordado.

---

## 4. Análisis de compatibilidad (matriz orientativa)

| Área | Riesgo si la otra PC asume otra cosa | Mitigación |
|------|--------------------------------------|------------|
| Efector único vs doble | Ticket o formularios con un solo “hospital” | Añadir segundo campo o migrar a dos FK; mapear “efector único” a **mismo id** en designación y cumplimiento hasta evolucionar UI |
| Código con `grupos` / `grp_*` unificado | Colección o prefijos distintos a `gdt_*`/`efe_*` | Capa repositorio + script de split/migración según plan maestro §B |
| Carga horaria (semana vs horas) | Validaciones numéricas distintas | Documentar factor solo si hay datos ya persistidos; preferir **normalizar a horas** en ingesta |
| Jefe en `datos_laborales` (V1) | V1 usaba `jefe_id` en usuario; V2 **no** en `hlc_*` | Ticket sigue algoritmo de jerarquía; no reintroducir `supervisor_persona_id` en `hlc_*` sin RFC |
| Estados / causales | Códigos hardcodeados en JS | Sustituir por `*_id` y lectura de `cfg_*` |

---

## 5. Criterios de aceptación al avanzar la unificación doc + código (*pend. revisión*)

- [ ] Un solo **Rulebook** o sección “diff” firmada donde nombres de colección/campos difieran temporalmente.
- [ ] Inventario **`cfg_*`** en [`MODULO_CONFIGURACION_V2.md`](./MODULO_CONFIGURACION_V2.md) §5 / §5.1 **alineado** con lo que consuma Ticket (nombres finales o alias documentados).
- [ ] Lista de **Callables** compartidos o evitados (quién escribe `hlc_*`, quién solo lee).
- [ ] **Seeds:** orden sugerido (config con vigencias → `gdt_*` / `efe_*` → `hlc_*`) y ningún catálogo sin `vigente_desde` / `activo` en entornos reales.
- [ ] **Ticket:** alta de solicitud **delegada por jefe de grupo** (flags en artículo, titular vs actor, auditoría) alineada a [`CUESTIONES_TICKET_SOLICITUD_POR_DELEGACION_JEFE_V2.md`](./CUESTIONES_TICKET_SOLICITUD_POR_DELEGACION_JEFE_V2.md).
- [ ] **Persona / RRHH:** estados **activo laboral**, **inactivo laboral (baja con fecha y motivo cfg)**, **deshabilitado** (mismo DNI en nuevo `per_*`), filtros en menú RRHH y reactivación con **login inicial** — [`CUESTIONES_ESTADOS_LABORAL_PERSONA_RRHH_V2.md`](./CUESTIONES_ESTADOS_LABORAL_PERSONA_RRHH_V2.md).

---

## 6. Checklist del día de fusión (copiar a issue o nota)

1. [x] Pull de `refactorizacion-fase1` y confirmación de que `docs/v2/` incluye este archivo. *(hecho 23/04/2026 en esta PC — ver §7)*
2. [ ] Diff del doc Ticket / rama otra PC vs [`MODULO_DATOS_LABORALES_V2.md`](./MODULO_DATOS_LABORALES_V2.md) §9–§10.
3. Tabla de **renombres** (columna “antes otra PC” / “después V2”).
4. Decisión explícita sobre **código** existente: migrar, adapter, o feature flag (con fecha límite).
5. Actualizar **changelog** del módulo que toque (laboral, config, Ticket) en el mismo PR.
6. **Push** conjunto o PR a `origin` para que ambas PCs queden en el mismo commit.

---

## 7. Registro de commits / doc (trazabilidad)

Los cambios documentales quedan **versionados en git** en la rama **`refactorizacion-fase1`**. Tras cada `git pull`, anotar aquí (o en el PR) el **hash** del commit de fusión si el equipo lo requiere para trazabilidad hospitalaria. A partir de la sesión con la otra PC, cada acuerdo Ticket + laborales conviene **un commit** o **un PR** que referencie este documento.

| Fecha | Contexto | Rama | `HEAD` (completo) | Nota |
|-------|----------|------|-------------------|------|
| 2026-04-23 | Esta PC: `git pull` tras desarrollos remotos (docs V2, certificados, etc.) | `refactorizacion-fase1` | `d339a4dbc80384c41774f0e783604ceeace039a7` | Alineado con `origin/refactorizacion-fase1`; checklist §6 ítem 1 hecho. |

---

## 8. Changelog de este informe

| Fecha | Cambio |
|-------|--------|
| 2026-04-22 | Creación: pasos otra PC, pautas, matriz compatibilidad, criterios de aceptación, checklist. |
| 2026-04-22 | Bloque **“Estado del remoto”**: alcance de docs; comprobación con `git rev-parse` frente a `origin/refactorizacion-fase1` (sin hash fijo en el texto). |
| 2026-04-22 | Enlace y criterio §5: solicitud por delegación jefe → subordinado ([`CUESTIONES_TICKET_SOLICITUD_POR_DELEGACION_JEFE_V2.md`](./CUESTIONES_TICKET_SOLICITUD_POR_DELEGACION_JEFE_V2.md)). |
| 2026-04-22 | Estados laborales / baja / deshabilitado y menú RRHH ([`CUESTIONES_ESTADOS_LABORAL_PERSONA_RRHH_V2.md`](./CUESTIONES_ESTADOS_LABORAL_PERSONA_RRHH_V2.md)). |
| 2026-04-22 | **Objetivos post-unificación:** consolidar doc del núcleo (Login + datos personales + datos laborales + `cfg_*`) → luego código y BD nueva sin V1; resto de módulos en fases posteriores. |
| 2026-04-23 | Objetivo §2 y §3: lenguaje sin “cerrado/100% canónico” final; criterios §5 como *pend. revisión*; pautas = referencia, no aprobación. |
| 2026-04-23 | **§7:** tabla de trazabilidad; registro pull PC local — `d339a4d…` (checklist §6.1). |
| 2026-04-23 | Párrafo previo a §1: enlace a [`REVISION_ALINEACION_PLAN_V2.md`](./REVISION_ALINEACION_PLAN_V2.md) (`TAREA` ↔ módulos). |
| 2026-04-23 | Efectores / unidades: criterio **`gdt_*` + `efe_*`** (decisión A2), sustituyendo la fila de tabla y §3/§4 que unificaba todo en `grupos`. |
