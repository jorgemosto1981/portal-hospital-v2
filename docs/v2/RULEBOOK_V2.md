# Rulebook v2 — Borrador de convenciones transversales *(v0)*

**Estado:** borrador vivo; se amplía con cada módulo; **ninguna aprobación final** — revisión continua y alineación a [`PLAN_DESARROLLO_VERSION2.md`](../../PLAN_DESARROLLO_VERSION2.md) y `docs/v2/`. **No** sustituye los módulos enlazados: fija **propuestas** de convención compartida para que implementación y revisión sean homogéneas.

**Índice V2:** [`README.md`](./README.md).

---

## 1. Identificadores

| Concepto | Formato | Notas |
|----------|---------|--------|
| Usuario del sistema (agente) | `per_<ULID>` | Documento `personas`; referencia **`persona_id`** en el resto de colecciones de negocio. |
| Cuenta de acceso | `usr_<ULID>` | `usuarios_cuenta`; enlace `auth_uid` ↔ `persona_id`. |
| Catálogos | `cfg_*` | Estados y listas cerradas como **`*_id`** → documento en `cfg_*`. |
| Auditoría | `evt_<ULID>` | `eventos_ticket`; **`tipo_evento_id`** → `cfg_tipo_evento`. |
| Grupo de trabajo (unidad / organigrama) | `gdt_<ULID>` | `grupos_de_trabajo`; árbol y asignación operativa (burbujeo, ticket). |
| Efector (catálogo) | `efe_<ULID>` | `efectores`; **configurable**; `hlc_*` referencia **dos** (`efector_designacion_id`, `efector_cumplimiento_id`). Ver plan maestro §B y [`MODULO_DATOS_LABORALES_V2.md`](./MODULO_DATOS_LABORALES_V2.md), [`DECISIONES_REVISION_PERSONALES_LABORALES_V2.md`](./DECISIONES_REVISION_PERSONALES_LABORALES_V2.md). |
| Asignación laboral (cargo) | `hlc_<ULID>` | `historial_laboral_cargos` (+ `hld_*` / `hlg_*`); `persona_id`, FK a **`grupos_de_trabajo`** y **`efectores`**, vigencia, causal, carga en horas según el plan maestro. |
| Otros agregados | `<prefijo>_<ULID>` | Definir prefijo al añadir módulo (ticket, …). |

**No usar** como clave primaria de enlace entre módulos: DNI, email, `auth_uid` (son datos de negocio o de proveedor, no ancla transversal).

---

## 2. Estados y configuración

- Persistencia: **solo** IDs (`estado_acceso`, `estado_perfil_datos_id`, …) → `cfg_*`. Cada valor seleccionable creado desde el **módulo de configuración** tiene **id única** (documento `cfg_*`) para que validaciones y lógica **no** dependan de textos renombrables.
- Texto humano (`titulo_ui`, `nombre`, `codigo_interno`) **solo** en documentos de catálogo, no como fuente de verdad en fichas de negocio.
- **Vigencia:** en `cfg_*`, usar **`vigente_desde`** / **`vigente_hasta`** (`null` en hasta = sin cierre) para normativas y cambios de catálogo; ver [`MODULO_CONFIGURACION_V2.md`](./MODULO_CONFIGURACION_V2.md) §2.
- **Bajas:** **no** borrar documentos `cfg_*` en producto; **deshabilitar** con **`activo: false`** y/o cerrar vigencia. Los ids ya referenciados siguen siendo válidos para lectura/auditoría.
- Flags de gating (menú, ticket, etc.) preferentemente en **`cfg_*`** según [`MODULO_CONFIGURACION_V2.md`](./MODULO_CONFIGURACION_V2.md).

---

## 3. Acceso a datos y seguridad

- Transiciones que mezclan Auth + Firestore + cambio de estados críticos: **solo** servidor (Callables / Admin SDK), no cliente sin validación. Ver [`ACCESO_Y_RULES_FIRESTORE_V2.md`](./ACCESO_Y_RULES_FIRESTORE_V2.md).
- **V2 greenfield:** sin lectura/escritura de colecciones de la V1 desde código V2 ([`PLAN_MODULOS_V2.md`](./PLAN_MODULOS_V2.md)).

---

## 4. Login (regla de producto)

- UI: **DNI + PIN** (6 dígitos numéricos); paso B incluye **correo**; proveedor Auth usa `username` + PIN como `password`. Detalle: [`MODULO_LOGIN_V2.md`](./MODULO_LOGIN_V2.md) §1.1.
- **Acuerdo 23/04:** por ahora **solo** esta política mínima (PIN 6); en la práctica se evaluará si hace falta otro mecanismo. Alinear consola Firebase en implementación.

---

## 5. Cambios de esquema

- Cambios que alteren forma de documentos en producción: **RFC** y reglas de gobernanza del repo (p. ej. `.cursorrules` reglas 64–66).

---

## Changelog

| Fecha | Cambio |
|-------|--------|
| 2026-04-22 | Creación v0: IDs, estados, acceso, login, cambios. |
| 2026-04-22 | Prefijos **`grp_*`** y **`hlc_*`** (datos laborales V2). |
| 2026-04-22 | §2: ids únicas en todo lo configurable; vigencia `vigente_desde` / `vigente_hasta` en `cfg_*`; sin borrado físico de catálogos (`activo` / vigencia). |
| 2026-04-23 | Nomenclatura alineada a [`PLAN_DESARROLLO_VERSION2.md`](../../PLAN_DESARROLLO_VERSION2.md): `usuarios_cuenta`, `eventos_ticket`, `tickets`/`tkt_*`, `hlc_*` / historiales. Laboral: `grupos_de_trabajo` (`gdt_*`) y `efectores` (`efe_*`); se **rechaza** mezclar ambos en una sola colección `grupos`. |
| 2026-04-23 | Título: “canónico” → convenciones transversales; política explícita de **sin aprobación final**; reemplazo ref. TAREA. |
