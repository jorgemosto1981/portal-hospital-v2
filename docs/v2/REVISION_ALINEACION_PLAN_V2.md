# Alineación de `docs/v2` con `PLAN_DESARROLLO_VERSION2.md`

**Fecha:** 23 de abril de 2026.  
**Regla:** la **fuente de verdad** de nombres de **colecciones, prefijos de id y campos** del plan V2 es [`PLAN_DESARROLLO_VERSION2.md`](../../PLAN_DESARROLLO_VERSION2.md) (secciones *PLAN V2 CONSOLIDADO* y *ESTRUCTURA DE BASE DE DATOS V2*). La documentación modular bajo `docs/v2/` quedó **ajustada** a esos nombres (sustituyendo la línea de redacción que usaba términos de otra PC, p. ej. `cuentas_usuario` → `usuarios_cuenta`).

**Mapeo de referencia (otra PC → plan maestro / este repo):**

| Antes (borrador otra línea) | Ahora (canónico) |
|----------------------------|------------------|
| `cuentas_usuario` | `usuarios_cuenta` |
| `eventos_auditoria` | `eventos_ticket` |
| `fecha_aplicacion_desde` / `hasta` en `cfg_*` (donde aplica) | `vigente_desde` / `vigente_hasta` |
| `unidades_organizativas`, prefijo `uor_` | `grupos_de_trabajo`, prefijo `gdt_` (organigrama; ver plan maestro §B) |
| `asignaciones_laborales`, prefijo `lab_` (como fila única) | `historial_laboral_cargos` / `historial_laboral_datos` / `historial_laboral_grupos` — prefijos `hlc_` / `hld_` / `hlg_` |
| Efector / “lugar de trabajo” (catálogo) | `efectores`, prefijo `efe_*` (además: **dos** FK + **una** a `gdt_*` en `hlc_*`; *no* mezclar con `gdt_*` en un solo nodo) |
| Redacción intermedia “todo en `grupos` / `grp_*`” | **Sustituida** (abril 2026) por el modelo anterior; `MODULO_DATOS_LABORALES_V2.md` §4 y `DECISIONES_…` A2 |
| Campo correo en cuenta: `email_login` | `username` (en `usuarios_cuenta`, según `PLAN_DESARROLLO_VERSION2.md`; valor usado con proveedor Auth según `MODULO_LOGIN_V2`) |
| `estado_acceso_id` | `estado_acceso` (y catálogos `cfg_*` asociados en módulos) |

**Nota:** el **plan maestro** en la raíz del repo manda sobre nombres de entidad; `docs/v2` detalla por módulo. Si hubo contradicción histórica en redacción, prevalece `PLAN_DESARROLLO_VERSION2.md` + este mapeo.

## Changelog

| Fecha | Cambio |
|-------|--------|
| 2026-04-23 | Creación: matriz de reemplazos; plan maestro como fuente de verdad. |
| 2026-04-23 | Sustituido el contenido anterior (que priorizaba nombres de módulos frente al plan en raíz). |
| 2026-04-23 | Archivo renombrado desde `REVISION_ALINEACION_TAREA_EN_CURSO`; enlaces al plan `PLAN_DESARROLLO_VERSION2.md`. |
| 2026-04-23 | Mapeo laboral: `gdt_*` / `efe_*` (reemplaza fila única `grupos` / `grp_*` para unidad+efectores). |
