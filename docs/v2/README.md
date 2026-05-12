# Documentación — Versión 2 del portal

Todo el **plan y contratos de la versión 2** viven bajo esta carpeta (`docs/v2/`). La documentación histórica de la **versión 1** está en [`../portal-hospital-v1/portal-hospital/docs/referencia_v1/`](../../../portal-hospital-v1/portal-hospital/docs/referencia_v1/) (solo consulta). Mapa de la raíz V2: [README de `portal-hospital-v2`](../../README.md).

**Regla de arquitectura:** la V2 no comparte proyecto Firebase / datos ni código de despliegue con la V1; ver [`PLAN_MODULOS_V2.md`](./PLAN_MODULOS_V2.md). Config de deploy en la raíz: [`firebase.json`](../../firebase.json) (reglas/índices en [`firebase-v2/`](../../firebase-v2/), código en [`functions/`](../../functions)). V1: [`../portal-hospital-v1/portal-hospital/firebase.json`](../../../portal-hospital-v1/portal-hospital/firebase.json).

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
| [`DECRETO_1919_89_ANTIGUEDAD_Y_LAO_V2.md`](./DECRETO_1919_89_ANTIGUEDAD_Y_LAO_V2.md) | Criterios V2 de antigüedad + LAO (Art. 40 y Art. 46), no retroactividad, proporcional y base para Ticket/Solicitudes |
| [`LEY_8525_1979_EGAP_SANTA_FE_V2.md`](./LEY_8525_1979_EGAP_SANTA_FE_V2.md) | Ley 8525/79 — Estatuto General de la Administración Pública (Santa Fe): texto de consulta para RRHH, disciplina, derechos/deberes, indemnizaciones (referencia; validar ante fuente oficial) |
| [`CUESTIONES_ESTADOS_LABORAL_PERSONA_RRHH_V2.md`](./CUESTIONES_ESTADOS_LABORAL_PERSONA_RRHH_V2.md) | Estados agente: **activo laboral**, **inactivo laboral (baja)**, **deshabilitado**; RRHH; reactivación + login |
| [`CURSOR_RULES_BORRADOR_V2.md`](./CURSOR_RULES_BORRADOR_V2.md) | **Borrador** reglas Cursor/convenciones de código V2 (referencia; basado en buenas prácticas de la V1 + `docs/v2`) |
| [`RULEBOOK_V2.md`](./RULEBOOK_V2.md) | Convenciones transversales (IDs, estados, seguridad) — v0 |
| [`MODULO_DATOS_LABORALES_V2.md`](./MODULO_DATOS_LABORALES_V2.md) | Datos laborales — **borrador** (`grupos_de_trabajo` / `gdt_*`, `cfg_efectores`, `hlc_*`, `hld_*` / `hlg_*`; carga en horas + §4.5). Clarificación UX: Nivel 1 = Cargo (`HLc`), Nivel 2 = Grupo (`HLg`), con `HLd` como detalle técnico opcional. |
| [`MODULO_LOGIN_V2.md`](./MODULO_LOGIN_V2.md) | Login, estados de acceso, **DNI + PIN 6 + correo** |
| [`MODULO_DATOS_PERSONALES_PLAN_DESARROLLO_UNIFICADO_V2.md`](./MODULO_DATOS_PERSONALES_PLAN_DESARROLLO_UNIFICADO_V2.md) | **Plan único** Datos personales: decisiones + flujo A–E + gating (V2) |
| [`MODULO_DATOS_PERSONALES_V2.md`](./MODULO_DATOS_PERSONALES_V2.md) | Anexo: contrato `personas`, formación, DDJJ, campos (ítem a ítem) |
| [`DECISIONES_REVISION_PERSONALES_LABORALES_V2.md`](./DECISIONES_REVISION_PERSONALES_LABORALES_V2.md) | **Decisiones de revisión** (A–D) entre módulos personales y laborales; precedencia y criterios sin código |
| [`MODULO_CONFIGURACION_V2.md`](./MODULO_CONFIGURACION_V2.md) | Colecciones `cfg_*`, semillas |
| [`MODULO_CONFIGURACION_ARTICULOS_V2.md`](./MODULO_CONFIGURACION_ARTICULOS_V2.md) | **Artículos (licencias/franquicias):** contrato funcional ABM + solicitudes, norma/SARH, documentación diferida, eventos |
| [`DICCIONARIO_CFG_ARTICULOS_V2.md`](./DICCIONARIO_CFG_ARTICULOS_V2.md) | Inventario `cfg_*` y prefijos del dominio artículos (`art_`, `sol_`, `cfg_tcp_*`, `cfg_cfi_*`, `cfg_tev_art_*`, …) |
| [`ANEXO_NORMATIVO_ARTICULOS_1919_SARH_8525_V2.md`](./ANEXO_NORMATIVO_ARTICULOS_1919_SARH_8525_V2.md) | Jerarquía Decreto 1919 / SARH / Ley 8525 y trazabilidad |
| [`MATRIZ_ESCENARIOS_ARTICULOS_V2.md`](./MATRIZ_ESCENARIOS_ARTICULOS_V2.md) | Ocho escenarios operativos → parámetros y catálogos |
| [`BACKLOG_MODULOS_PARALELOS_ARTICULOS_V2.md`](./BACKLOG_MODULOS_PARALELOS_ARTICULOS_V2.md) | Interfaces con ticketera, asistencia/MDC, eventos, SLA, superposición |
| [`FLUJO_V2_LOGIN_Y_DATOS_PERSONALES.md`](./FLUJO_V2_LOGIN_Y_DATOS_PERSONALES.md) | Flujo A–E, gating, checklist de implementación |
| [`ACCESO_Y_RULES_FIRESTORE_V2.md`](./ACCESO_Y_RULES_FIRESTORE_V2.md) | Matriz de acceso, Callables, orientación Rules |
| [`DESARROLLO_ORDEN_LOGIN_DATOS_V2.md`](./DESARROLLO_ORDEN_LOGIN_DATOS_V2.md) | Orden de fases 0–6 para codificar |
| [`ARRANQUE_BD_Y_CODIGO_V2.md`](./ARRANQUE_BD_Y_CODIGO_V2.md) | **Checklist** para proyecto Firebase/BD nuevo + arranque de código (seguimiento) |
| [`TAREA_DEPLOY_FUNCTIONS_Y_SERVIDOR_2026-05-02.md`](./TAREA_DEPLOY_FUNCTIONS_Y_SERVIDOR_2026-05-02.md) | **Seguimiento:** `firebase.json` en raíz, deploy Blaze/Functions, IAM Cloud Build, `dev:web` |
| [`FASE_A_PASOS.md`](./FASE_A_PASOS.md) | **Fase A** — pasos iniciales (Auth consola, Functions stub, estructura `web/`) |
| [`INFORME_MAESTRO_DESARROLLO_LOGIN_DATOS_V2.md`](./INFORME_MAESTRO_DESARROLLO_LOGIN_DATOS_V2.md) | Evaluación y frase de encargo |
| [`V1_VS_V2_LOGIN_DATOS.md`](./V1_VS_V2_LOGIN_DATOS.md) | Lecciones desde la V1 (solo referencia; sin conexión técnica) |
| [`PROPUESTA_ESTADOS_USUARIO_V2.md`](./PROPUESTA_ESTADOS_USUARIO_V2.md) | Estados de usuario (propuesta) |
| [`HANDOFF_SESION_2026-04-30.md`](./HANDOFF_SESION_2026-04-30.md) | Continuidad de sesión: DDJJ onboarding, `CFG_PAR_OTROS`, evento a bandeja RRHH, limpieza usuarios test y próximos pasos |
| [`HANDOFF_SESION_2026-05-02.md`](./HANDOFF_SESION_2026-05-02.md) | Datos personales (`desde`/`hasta`, eventos auditoría), RRHH + flujo usuario/notificación, scroll anchoring / HMR, deploy hosting, próximos pasos |
| [`HANDOFF_SESION_2026-05-04.md`](./HANDOFF_SESION_2026-05-04.md) | Limpieza Fase 1+2 en Perfil RRHH, retiro callable legacy, deploy Hosting/Functions, continuidad hacia pantalla espejo rol Usuario y auditoría de estados duplicados |
| [`HANDOFF_SESION_2026-05-05.md`](./HANDOFF_SESION_2026-05-05.md) | **Última sesión:** auditoría FK catálogo + borrado `evt_*`; refactor formulario **Datos laborales** en `web/` (detalle abajo) |
| [`HANDOFF_SESION_2026-05-06.md`](./HANDOFF_SESION_2026-05-06.md) | **Última sesión:** auditoría end-to-end Datos Laborales, unificación visual actual/histórico, limpieza de flujo contextual, validaciones `VAL-HLD-003/004`, mensajes claros y continuidad en pulido de Datos Laborales, Datos Personales y Login |
| [`HANDOFF_SESION_2026-05-09.md`](./HANDOFF_SESION_2026-05-09.md) | Documentación módulo **Artículos** (`cfg_articulos`, SARH 1:N, Gate RFC), docs nuevos en `docs/v2/`, tag Git `snapshot-2026-05-09-articulos-docs-backup` antes de más código |
| [`HANDOFF_SESION_2026-05-12.md`](./HANDOFF_SESION_2026-05-12.md) | **Última sesión:** Artículos V2 — **Paso 0 LAO**, §7 en MODULO PF, guardián Bloque 4, migración `migrate-step0-lao-identity`, matriz UI (orden + duplicados + labels). **Próxima sesión:** [Fase 3b DatePicker](./ROADMAP_MOTOR_LAO_V2_POST_CHECKPOINT.md) → TZ `antiguedadCalculator` → Functions motor |
| [`ROADMAP_MOTOR_LAO_V2_POST_CHECKPOINT.md`](./ROADMAP_MOTOR_LAO_V2_POST_CHECKPOINT.md) | **Plan técnico** post-checkpoint Motor LAO V2 (fases 3b, 4, 5) y comando “retomar aquí” |
| [`REFACTOR_WEB_DATOS_LABORALES_FORMULARIO_V2.md`](./REFACTOR_WEB_DATOS_LABORALES_FORMULARIO_V2.md) | Refactor UI del formulario datos laborales: `LabeledSelect` / `LabeledTextField`, modo `bare`, fix edición por persona; lista de archivos y pendientes |

**Lecciones desde código V1 (en referencia V1):** [`../referencia_v1/PROBLEMA_LOGIN_PERMISOS.md`](../referencia_v1/PROBLEMA_LOGIN_PERMISOS.md) y el resto de `docs/referencia_v1/` según necesidad.
