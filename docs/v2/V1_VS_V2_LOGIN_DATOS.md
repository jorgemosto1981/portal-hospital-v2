# V1 vs V2 — Login y datos personales (referencia y lecciones)

**Propósito:** dejar **versionada** la comparación entre el comportamiento actual del código (V1) y el plan V2, para **aprender qué no repetir** y revisión de equipo. **Regla básica:** la V2 **no se conecta** a la V1: **sin** migración de datos, **sin** lectura/escritura de la BD o colecciones de la V1 desde código o despliegues de la V2, **sin** compartir proyecto Firebase / instancia Firestore con la app V1 en producción. La V2 es **greenfield** (nueva BD, nuevo código, datos nuevos). Este archivo **no** sustituye [`MODULO_LOGIN_V2.md`](./MODULO_LOGIN_V2.md), [`MODULO_DATOS_PERSONALES_V2.md`](./MODULO_DATOS_PERSONALES_V2.md) ni [`FLUJO_V2_LOGIN_Y_DATOS_PERSONALES.md`](./FLUJO_V2_LOGIN_Y_DATOS_PERSONALES.md).

**Fecha:** 22 de abril de 2026.

---

## Lecturas relacionadas

| Documento | Contenido |
|-----------|-----------|
| [`FLUJO_V2_LOGIN_Y_DATOS_PERSONALES.md`](./FLUJO_V2_LOGIN_Y_DATOS_PERSONALES.md) | Secuencia A–E, gating, checklist código |
| [`ACCESO_Y_RULES_FIRESTORE_V2.md`](./ACCESO_Y_RULES_FIRESTORE_V2.md) | Callables, Security Rules, matriz de acceso |
| [`MODULO_CONFIGURACION_V2.md`](./MODULO_CONFIGURACION_V2.md) | Flags en `cfg_*` para estados |
| [`PROBLEMA_LOGIN_PERMISOS.md`](../referencia_v1/PROBLEMA_LOGIN_PERMISOS.md) | Contexto histórico V1 (login sin auth) |

**Código V1 representativo:** `src/hooks/useAuth.js`, `src/components/CompletarDatosPersonales.jsx`, `src/services/usuariosService.js`, `firestore.rules` (`match /usuarios/{usuarioId}`).

---

## Tabla resumen

| Aspecto | V1 (hoy) | V2 (plan) | Riesgo si se acorta el diseño (solo capa visual) |
|---------|----------|-----------|-------------------------------|
| Modelo de usuario | Documento `usuarios` único (DNI/`uid`, email, flags) | `personas` + `usuarios_cuenta` + colecciones satélite | Datos duplicados o reglas incorrectas |
| ID de documento | A menudo derivado de DNI | `per_<ULID>`, `usr_<ULID>` | IDs incompatibles con enlaces existentes |
| Estados de acceso / perfil | Strings (`estado_registro`, flags booleanos) | `*_id` → `cfg_*` + flags en catálogo | Strings mágicos reaparecen en V2 |
| Email de acceso | Campo `email` en `usuarios` | `usuarios_cuenta.username` únicamente | Doble fuente de verdad |
| Credenciales de acceso | Email + contraseña heterogénea en producto | **DNI** en pantalla + **PIN 6 dígitos** + **correo** en paso B; Auth `password` = PIN ([`MODULO_LOGIN_V2.md`](./MODULO_LOGIN_V2.md) §1.1) | Complejidad mal alineada al proveedor Auth o PIN débil sin rate limit |
| Onboarding con sesión | `PENDIENTE` + Auth según flujo de registro | `estado_acceso` *onboarding datos* + wizard | Bloqueo de login o menú mal gating |
| Datos personales / formación | Campos planos y texto en `usuarios` | `personas` + `formacion_agente`, FK `cfg_*` | Especialidad/colegio otra vez como texto libre |
| Validación de cierre de ficha | Principalmente cliente (`alert`) | Callable + validación servidor + transacción | Inconsistencias y fraude de estado |
| Lookup por DNI sin auth | `firestore.rules`: lectura si `request.auth == null` en `usuarios` | Callable acotado, sin lectura anónima amplia | Se copia el patrón permisivo a V2 |
| Auditoría de cambios | `historial_cambios` embebido (Regla 55 `.cursorrules`) | `eventos_ticket` (`evt_*`) con `tipo_evento_id` | Dos sistemas de auditoría en paralelo |
| Sincronización `/usuarios/{uid}` | Espejo para reglas; fallo no bloquea login | Diseño sin espejo obligatorio (cuenta por `auth_uid`) | Lógica legacy arrastrada sin necesidad |

---

## `.cursorrules` (nota para implementación V2)

- **Regla 3** (estructura Firebase): actualizar cuando el repo adopte colecciones V2 (`personas`, `usuarios_cuenta`, `cfg_*`, …).
- **Regla 55** (historial de perfil): reinterpretar como **trazabilidad obligatoria**; en V2 preferir **`evt_*`** coherente con [`MODULO_DATOS_PERSONALES_V2.md`](./MODULO_DATOS_PERSONALES_V2.md) §2.4 y §3.11; cualquier persistencia de array embebido requiere **RFC** (Reglas 64–65).
- **Reglas 64–66**: aplican plenamente a **evoluciones de esquema dentro de V2** (RFC, cambios atómicos por pantalla/servicio).

---

## Independencia V2 respecto de V1 (regla de arquitectura)

- **Proyecto y datos:** la V2 vive en **proyecto Firebase / BD distintos** a los de la V1 en producción. Colecciones y reglas **solo** del modelo V2 (`personas`, `usuarios_cuenta`, `cfg_*`, …).
- **Código y runtime:** **prohibido** leer o escribir colecciones, Auth o Functions del despliegue V1 desde la aplicación o backend V2. No hay tuberías, jobs ni scripts oficiales del producto V2 que sincronicen datos con la V1.
- **V1 como referencia:** el código y la BD de la V1 se consultan **solo** en documentación o en el repo como *lección aprendida* (p. ej. tabla de arriba); no forman parte del grafo de dependencias en tiempo de ejecución de la V2.

---

## Riesgos principales al implementar V2 (sin relación con datos V1)

| Riesgo | Mitigación documentada |
|--------|-------------------------|
| Reglas permisivas copiadas a V2 | [`ACCESO_Y_RULES_FIRESTORE_V2.md`](./ACCESO_Y_RULES_FIRESTORE_V2.md) §3–§7 |
| Doble verdad email / persona | V2 SSoT `username`; §2.2 datos personales |
| Estados inconsistentes cuenta/perfil | Reconciliación diaria + Callable admin; [`FLUJO_V2_LOGIN_Y_DATOS_PERSONALES.md`](./FLUJO_V2_LOGIN_Y_DATOS_PERSONALES.md) §11 P1.3 |
| Pérdida de auditoría Regla 55 | Mapear eventos críticos a `evt_*`; RFC si se conserva array embebido |

---

## Criterios de alineación (guía; *pend. revisión* — módulo Login + datos personales V2)

**No** constituyen cierre ni aprobación. Sirven para **saber** cuándo la documentación del bloque Login + datos personales + `cfg_*` mínima está **lo bastante alineada** para pasar a implementación (decisión de equipo, tras revisar el plan maestro y [`PLAN_MODULOS_V2.md`](./PLAN_MODULOS_V2.md)):

1. [`FLUJO_V2_LOGIN_Y_DATOS_PERSONALES.md`](./FLUJO_V2_LOGIN_Y_DATOS_PERSONALES.md) — P0 y **P1** razonados por escrito (§11).
2. [`MODULO_CONFIGURACION_V2.md`](./MODULO_CONFIGURACION_V2.md) — inventario `cfg_*` §5 + semilla §6 (ids ejemplo **sustituibles** por ULID reales al desplegar).
3. [`ACCESO_Y_RULES_FIRESTORE_V2.md`](./ACCESO_Y_RULES_FIRESTORE_V2.md) — matriz y Callables definidos en documento (código = fase distinta).
4. [`PLAN_MODULOS_V2.md`](./PLAN_MODULOS_V2.md) — fila del módulo actualizada con el estado de documentación vigente (p. ej. *doc avanzada; pend. nueva revisión*).

*La implementación (Cloud Functions, reglas `.rules`, UI) no forma parte de esta guía de documentación.*

**Al iniciar código:** usar [`DESARROLLO_ORDEN_LOGIN_DATOS_V2.md`](./DESARROLLO_ORDEN_LOGIN_DATOS_V2.md) y la **frase de encargo** en [`INFORME_MAESTRO_DESARROLLO_LOGIN_DATOS_V2.md`](./INFORME_MAESTRO_DESARROLLO_LOGIN_DATOS_V2.md) §1.

---

## Changelog

| Fecha | Cambio |
|-------|--------|
| 2026-04-22 | Creación: tabla V1/V2, riesgos de implementación, nota `.cursorrules`. |
| 2026-04-22 | Estrategia de migración (obsoleta tras decisión greenfield), riesgos, criterios de alineación (antes *Definition of Done* plan documental). |
| 2026-04-22 | **V2 greenfield** y **regla estricta:** sin conexión V1↔V2 ni migración de datos; sección de independencia; riesgos = solo implementación V2; tabla sin columna “migra UI”. |
| 2026-04-22 | Criterios de alineación: enlace a orden de implementación (`DESARROLLO_ORDEN`) e informe maestro. |
| 2026-04-23 | Sustitución *Definition of Done* / “cerrado” → **Criterios de alineación (guía)**, *pend. revisión*; alineado a política del plan maestro. |
| 2026-04-22 | Tabla: fila **credenciales** V2 (DNI + PIN 6 + correo). Documentación V2 bajo `docs/v2/`. |
