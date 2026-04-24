# Estados de agente — laboral, baja y deshabilitado (V2, RRHH)

**Estado:** **pautas orientativas** para cerrar con modelo de datos (`personas`, `hlc_*`, `usuarios_cuenta`) y pantallas RRHH. Complementa la definición de “activo laboralmente” en [`MODULO_DATOS_LABORALES_V2.md`](./MODULO_DATOS_LABORALES_V2.md) y los flags de `personas` en [`MODULO_DATOS_PERSONALES_V2.md`](./MODULO_DATOS_PERSONALES_V2.md). **No** sustituye la propuesta histórica [`PROPUESTA_ESTADOS_USUARIO_V2.md`](./PROPUESTA_ESTADOS_USUARIO_V2.md) (orientada a V1/`usuarios`); al implementar V2, migrar conceptos aquí.

**Fecha:** 22 de abril de 2026.

---

## 1. Tres conceptos distintos (no mezclar en un solo booleano)

| Concepto | Significado operativo | Datos / reglas (orientativo) |
|----------|----------------------|------------------------------|
| **Activo laboral** | El agente **cuenta** para listados y procesos de “personal activo”. | **Derivado** de datos laborales: existe al menos un `hlc_*` en estado **activo** y **vigente** (sin `fecha_hasta` o vigencia actual según regla documentada en módulo laboral). Opcionalmente cacheable en `personas` solo como **denormalización** con invalidación al cambiar `hlc_*`. |
| **Inactivo laboral (baja)** | Quita al usuario de **listados de activos** y de **consultas/procesos** pensados para personal en actividad (bandejas, asignaciones, etc.). **No** implica borrar historia. | Debe constar **`fecha_baja_laboral`** y **`motivo_baja_laboral_id`** → **`cfg_*`** (catálogo configurable, ids únicos, vigencia según [`MODULO_CONFIGURACION_V2.md`](./MODULO_CONFIGURACION_V2.md) §1–§2). **Integridad:** no debe quedar ningún `hlc_*` **vigente** sin cierre: todo cargo abierto debe cerrarse (`fecha_hasta` + `causal_fin_asignacion_id`) **en la misma operación** o **antes** de fijar la baja laboral (Callable transaccional). |
| **Deshabilitado** | Motivos distintos de la baja laboral (error de alta, duplicado, política interna, etc.). **No** se borra el registro; **sí** se permite **dar de alta un nuevo agente con el mismo DNI** como **nuevo** `persona_id` (`per_<ULID>`), manteniendo el histórico del documento anterior. | Convención: `personas.activo === false` (o equivalente) **y** marca explícita de tipo de baja **`deshabilitado_registro`** vs **`inactivo_laboral`** — ver §2. Las consultas de **unicidad de DNI** deben aplicar solo sobre personas “**elegibles para operación**” (p. ej. activas o activas laboralmente), no sobre filas deshabilitadas archivadas. |

---

## 2. Modelado recomendado (pendiente de fijar nombres en Rulebook)

Para no sobrecargar un solo campo:

- **`estado_vida_agente_rrhh_id`** → **`cfg_estado_vida_agente_rrhh`** (ejemplos de `codigo_interno`: `ACTIVO_LABORAL`, `INACTIVO_LABORAL`, `DESHABILITADO_REGISTRO`). Cada documento en `cfg_*` con **`vigente_desde` / `vigente_hasta`** y **`activo`**.
- Campos en **`personas`** (o subdocumento de RRHH si se prefiere):
  - **`fecha_baja_laboral`**, **`motivo_baja_laboral_id`** — obligatorios cuando el estado es **inactivo laboral**; `null` en otros estados.
  - Para **deshabilitado**, usar **`motivo_baja_id`** / **`cfg_motivo_baja_persona`** ya previstos en datos personales **o** catálogo específico **`cfg_motivo_deshabilitacion_persona`** si el hospital separa semántica de “baja laboral” vs “baja de ficha”.

La clave es que **RRHH y las Rules** puedan filtrar por **un id de estado**, no por inferencia frágil desde varios booleans sueltos.

---

## 3. Inactivo laboral — exclusión de consultas y reactivación

- **Listados “activos”:** filtros estándar del portal y de jobs deben usar **`estado_vida_agente_rrhh_id`** (o regla equivalente) **más** la condición de cargos vigentes, según producto.
- **Reactivación (poco frecuente, p. ej. reincorporación):** debe poder **volver a Activo laboral** sin perder historia: mismos `per_*` / `usr_*`, mismos `hlc_*` históricos, altas de **nuevos** `hlc_*` si corresponde.
- **Login inicial de nuevo:** al reactivar, forzar **`estado_acceso`** (y, si aplica, **`estado_perfil_datos_id`**) a la rama de **re-verificación** acordada (equivalente a “primer acceso controlado”: revalidar PIN/email según política). Documentar en [`MODULO_LOGIN_V2.md`](./MODULO_LOGIN_V2.md) / Callables como **`reactivacion_laboral_post_baja`** con **`evt_*`**.
- **Auditoría:** toda transición Inactivo laboral ↔ Activo laboral y Deshabilitado debe generar **`eventos_ticket`** con tipo configurable.

---

## 4. Menú RRHH — visualización por estado

- En las pantallas de **gestión de agentes**, los filtros o pestañas deben incluir explícitamente las tres líneas de trabajo: **Activos laborales**, **Inactivos laborales (bajas)**, **Deshabilitados** (y opcionalmente “todos” solo para roles con permiso).
- Coherencia con [`CUESTIONES_ROLES_MENUS_ARQUITECTURA_V2.md`](./CUESTIONES_ROLES_MENUS_ARQUITECTURA_V2.md): ítems de menú o rutas protegidas por `cfg_rol`.

---

## 5. Relación con módulos existentes

| Documento | Aporte |
|-----------|--------|
| [`MODULO_DATOS_LABORALES_V2.md`](./MODULO_DATOS_LABORALES_V2.md) | Definición de cargo vigente, cierre con `fecha_hasta` y causal |
| [`MODULO_DATOS_PERSONALES_V2.md`](./MODULO_DATOS_PERSONALES_V2.md) | `personas.activo`, `motivo_baja_id`, unicidad DNI en ficha |
| [`MODULO_LOGIN_V2.md`](./MODULO_LOGIN_V2.md) | `usuarios_cuenta`, `estado_acceso` tras reactivación |
| [`CUESTIONES_ROLES_MENUS_ARQUITECTURA_V2.md`](./CUESTIONES_ROLES_MENUS_ARQUITECTURA_V2.md) | Menú RRHH y roles |

---

## 6. Pendientes al implementar

- [ ] Nombre final de colección **`cfg_estado_vida_agente_rrhh`** y de **`cfg_motivo_baja_laboral`** (o reutilización de `cfg_motivo_baja_persona`).
- [ ] Callable único **`aplicarBajaLaboral`** / **`reactivarAgenteLaboral`** con transacción `hlc_*` + `personas`.
- [ ] Índices Firestore: listados RRHH por `estado_vida_agente_rrhh_id` + `apellido` / `dni` según UX.
- [ ] Regla de **unicidad DNI** al crear `per_*` nueva tras deshabilitado.

---

## 7. Changelog

| Fecha | Cambio |
|-------|--------|
| 2026-04-22 | Creación: activo / inactivo laboral / deshabilitado; fecha y motivo cfg; reactivación + login inicial; menú RRHH; sin borrado. |
