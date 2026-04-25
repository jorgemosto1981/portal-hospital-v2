# Documentación — Versión 2 del portal

Todo el **plan y contratos de la versión 2** viven bajo esta carpeta (`docs/v2/`). La documentación histórica de la **versión 1** está en [`../portal-hospital-v1/portal-hospital/docs/referencia_v1/`](../../../portal-hospital-v1/portal-hospital/docs/referencia_v1/) (solo consulta). Mapa de la raíz V2: [README de `portal-hospital-v2`](../../README.md).

**Regla de arquitectura:** la V2 no comparte proyecto Firebase / datos ni código de despliegue con la V1; ver [`PLAN_MODULOS_V2.md`](./PLAN_MODULOS_V2.md). Config y despliegue Firestore **V2** en la raíz de este repo: carpeta [`firebase-v2/`](../firebase-v2/). V1: [`../portal-hospital-v1/portal-hospital/firebase.json`](../../../portal-hospital-v1/portal-hospital/firebase.json).

### Módulo operativo y de asistencia (biblia de referencia)

| Documento | Rol |
|-----------|-----|
| **[`ARQUITECTURA_MAESTRA_SIGAL_V2_MODULO_OPERATIVO_ASISTENCIA.md`](./ARQUITECTURA_MAESTRA_SIGAL_V2_MODULO_OPERATIVO_ASISTENCIA.md)** | **Entrada principal:** RDA, MDC, GSO, fusión 1:N, turnos nocturnos, jerarquía de verdad, identificadores y principios transversales |

## Índice rápido

| Documento | Rol |
|-----------|-----|
| [`PLAN_MODULOS_V2.md`](./PLAN_MODULOS_V2.md) | Marco modular, `persona_id`, regla de independencia V1/V2 |
| [`REVISION_ALINEACION_PLAN_V2.md`](./REVISION_ALINEACION_PLAN_V2.md) | **Conciliación** `PLAN_DESARROLLO_VERSION2.md` ↔ `docs/v2` (nombres de colecciones, laborales, auditoría) |
| [`UNIFICACION_OTRA_PC_Y_TICKET.md`](./UNIFICACION_OTRA_PC_Y_TICKET.md) | Fusión otra PC + Ticket — pasos git, pautas, compatibilidad, checklist |
| [`CUESTIONES_ROLES_MENUS_ARQUITECTURA_V2.md`](./CUESTIONES_ROLES_MENUS_ARQUITECTURA_V2.md) | Roles (`cfg_rol`), menús, módulo “Jefe”, master, UX/mobile — orientación y pendientes |
| [`CUESTIONES_TICKET_SOLICITUD_POR_DELEGACION_JEFE_V2.md`](./CUESTIONES_TICKET_SOLICITUD_POR_DELEGACION_JEFE_V2.md) | Ticket: solicitud iniciada por **jefe** para **subordinado** (configurable por artículo, auditoría) |
| [`CUESTIONES_ESTADOS_LABORAL_PERSONA_RRHH_V2.md`](./CUESTIONES_ESTADOS_LABORAL_PERSONA_RRHH_V2.md) | Estados agente: **activo laboral**, **inactivo laboral (baja)**, **deshabilitado**; RRHH; reactivación + login |
| [`CURSOR_RULES_BORRADOR_V2.md`](./CURSOR_RULES_BORRADOR_V2.md) | **Borrador** reglas Cursor/convenciones de código V2 (referencia; basado en buenas prácticas de la V1 + `docs/v2`) |
| [`RULEBOOK_V2.md`](./RULEBOOK_V2.md) | Convenciones transversales (IDs, estados, seguridad) — v0 |
| [`MODULO_DATOS_LABORALES_V2.md`](./MODULO_DATOS_LABORALES_V2.md) | Datos laborales — **borrador** (`grupos_de_trabajo` / `gdt_*`, `efectores` / `efe_*`, `hlc_*`, `hld_*` / `hlg_*`; carga en horas + §4.5) |
| [`MODULO_LOGIN_V2.md`](./MODULO_LOGIN_V2.md) | Login, estados de acceso, **DNI + PIN 6 + correo** |
| [`MODULO_DATOS_PERSONALES_PLAN_DESARROLLO_UNIFICADO_V2.md`](./MODULO_DATOS_PERSONALES_PLAN_DESARROLLO_UNIFICADO_V2.md) | **Plan único** Datos personales: decisiones + flujo A–E + gating (V2) |
| [`MODULO_DATOS_PERSONALES_V2.md`](./MODULO_DATOS_PERSONALES_V2.md) | Anexo: contrato `personas`, formación, DDJJ, campos (ítem a ítem) |
| [`DECISIONES_REVISION_PERSONALES_LABORALES_V2.md`](./DECISIONES_REVISION_PERSONALES_LABORALES_V2.md) | **Decisiones de revisión** (A–D) entre módulos personales y laborales; precedencia y criterios sin código |
| [`MODULO_CONFIGURACION_V2.md`](./MODULO_CONFIGURACION_V2.md) | Colecciones `cfg_*`, semillas |
| [`FLUJO_V2_LOGIN_Y_DATOS_PERSONALES.md`](./FLUJO_V2_LOGIN_Y_DATOS_PERSONALES.md) | Flujo A–E, gating, checklist de implementación |
| [`ACCESO_Y_RULES_FIRESTORE_V2.md`](./ACCESO_Y_RULES_FIRESTORE_V2.md) | Matriz de acceso, Callables, orientación Rules |
| [`DESARROLLO_ORDEN_LOGIN_DATOS_V2.md`](./DESARROLLO_ORDEN_LOGIN_DATOS_V2.md) | Orden de fases 0–6 para codificar |
| [`ARRANQUE_BD_Y_CODIGO_V2.md`](./ARRANQUE_BD_Y_CODIGO_V2.md) | **Checklist** para proyecto Firebase/BD nuevo + arranque de código (seguimiento) |
| [`FASE_A_PASOS.md`](./FASE_A_PASOS.md) | **Fase A** — pasos iniciales (Auth consola, Functions stub, estructura `web/`) |
| [`INFORME_MAESTRO_DESARROLLO_LOGIN_DATOS_V2.md`](./INFORME_MAESTRO_DESARROLLO_LOGIN_DATOS_V2.md) | Evaluación y frase de encargo |
| [`V1_VS_V2_LOGIN_DATOS.md`](./V1_VS_V2_LOGIN_DATOS.md) | Lecciones desde la V1 (solo referencia; sin conexión técnica) |
| [`PROPUESTA_ESTADOS_USUARIO_V2.md`](./PROPUESTA_ESTADOS_USUARIO_V2.md) | Estados de usuario (propuesta) |

**Lecciones desde código V1 (en referencia V1):** [`../referencia_v1/PROBLEMA_LOGIN_PERMISOS.md`](../referencia_v1/PROBLEMA_LOGIN_PERMISOS.md) y el resto de `docs/referencia_v1/` según necesidad.
