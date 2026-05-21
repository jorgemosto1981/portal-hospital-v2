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
| [`RFC_ACCESO_ROLES_HLC_MENUS_V2.md`](./RFC_ACCESO_ROLES_HLC_MENUS_V2.md) | **Implementado:** `roles_hlc_vigentes`, menú RRHH, circuito artículos, flujo claims post-alta/laboral |
| [`HANDOFF_SESION_2026-05-19_ROLES_HLC_CLAIMS.md`](./HANDOFF_SESION_2026-05-19_ROLES_HLC_CLAIMS.md) | Sesión 2026-05-19: fix T2/portal_role, deploy Functions, retomar matriz 64-A |
| [`CUESTIONES_TICKET_SOLICITUD_POR_DELEGACION_JEFE_V2.md`](./CUESTIONES_TICKET_SOLICITUD_POR_DELEGACION_JEFE_V2.md) | Ticket: solicitud iniciada por **jefe** para **subordinado** (configurable por artículo, auditoría) |
| [`DECRETO_1919_89_ANTIGUEDAD_Y_LAO_V2.md`](./DECRETO_1919_89_ANTIGUEDAD_Y_LAO_V2.md) | Criterios V2 de antigüedad + LAO (Art. 40 y Art. 46), no retroactividad, proporcional y base para Ticket/Solicitudes |
| [`PLAN_LAO_BOLSAS_CHECKIN_SOLICITUD_V2.md`](./PLAN_LAO_BOLSAS_CHECKIN_SOLICITUD_V2.md) | **Plan maestro LAO:** bolsas por año, check-in (&lt; A), acreditación antigüedad (≥ A), una solicitud por año, FIFO de año, `cfg_*` acordados |
| [`LAO_VERSIONES_RRHH_BACKLOG.md`](./LAO_VERSIONES_RRHH_BACKLOG.md) | Checklist versiones LAO por `correspondencia_anio` (2024/2023/2025/2026 ejemplo piloto) |
| [`CUESTION_VER_VERSIONES_ARTICULO_V2.md`](./CUESTION_VER_VERSIONES_ARTICULO_V2.md) | **Implementado:** grilla + página opcional + callable `listarVersionesCfgArticulo` — inventario de todas las `versiones/{ver_id}` |
| [`REGISTRO_FASE_DOCUMENTAL_SALDOS_ABC_V2.md`](./REGISTRO_FASE_DOCUMENTAL_SALDOS_ABC_V2.md) | **Registro maestro** saldos V2.1: fase doc + **D2 ayuda web** (§8), inventario archivos, D3–D6 pendientes |
| [`RFC_SALDOS_PATRONES_ABC_V2.md`](./RFC_SALDOS_PATRONES_ABC_V2.md) | **Capa contable:** patrones A/B/C, consumo al iniciar trámite (§10), cierre configurable, Callable «Mis saldos», check-in universal |
| [`CASOS_BORDE_SALDOS_V2.md`](./CASOS_BORDE_SALDOS_V2.md) | **SSoT casos borde 1–8** (cruce año, FIFO reverso, cierre ciclo, ajustes RRHH, feriados, LAO+enfermedad) |
| [`GUIA_RRHH_SALDOS_V2.md`](./GUIA_RRHH_SALDOS_V2.md) | Manual operativo RRHH: resumen contable, ajustes, retroactivo, export PDF desde modal |
| [`GUIA_ALTA_ARTICULO_68B_COMPENSATORIO_V2.md`](./GUIA_ALTA_ARTICULO_68B_COMPENSATORIO_V2.md) | Alta configurador: **68-B** compensatorio, Patrón C, unidad horas |
| [`ARTICULOS_BASICOS_OPERATIVOS_V2.md`](./ARTICULOS_BASICOS_OPERATIVOS_V2.md) | **Catálogo básico** LAO + 64-A + 64-B + 68-B (ids y patrón check-in) |
| [`MODULO_CALENDARIO_FERIADOS_V2.md`](./MODULO_CALENDARIO_FERIADOS_V2.md) | Calendario institucional `cfg_cal_YYYY` — feriados y asuetos para cómputo de días hábiles |
| [`RFC_LAO_CHECKIN_SALDOS_V2.md`](./RFC_LAO_CHECKIN_SALDOS_V2.md) | RFC check-in → bolsas + `version_id_origen` |
| [`RFC_LAO_SOLICITUD_VERSION_FIFO_V2.md`](./RFC_LAO_SOLICITUD_VERSION_FIFO_V2.md) | RFC solicitud: versión por bolsa + FIFO |
| [`RFC_LAO_ACREDITACION_ANUAL_V2.md`](./RFC_LAO_ACREDITACION_ANUAL_V2.md) | RFC acreditación motor (años ≥ A) |
| [`HANDOFF_SESION_2026-05-15.md`](./HANDOFF_SESION_2026-05-15.md) | Sesión **producto/doc** 2026-05-15: guía LAO 2024, política saldos/check-in, plan persistente |
| [`HANDOFF_SESION_2026-05-16.md`](./HANDOFF_SESION_2026-05-16.md) | Sesión 2026-05-16: versiones RRHH, smoke LAO Fase 3, fix check-in merge; **§9** cierre fase documental saldos A/B/C |
| [`HANDOFF_SESION_2026-05-18_CHECKIN_SALDOS.md`](./HANDOFF_SESION_2026-05-18_CHECKIN_SALDOS.md) | UI check-in saldos A/B/C, rectificación, `cerrarCheckinGlobal`, callables y rutas web |
| [`CHECKIN_SALDOS_BACKLOG.md`](./CHECKIN_SALDOS_BACKLOG.md) | **Backlog** check-in saldos: tareas S/M/L, oleadas y decisiones de producto |
| [`HANDOFF_SESION_2026-05-18_TICKETERA_64A_PAUSA.md`](./HANDOFF_SESION_2026-05-18_TICKETERA_64A_PAUSA.md) | **PAUSA ticketera** — slice 64-A Oleada 1 hecha; T1/T6 OK piloto; **retomar mañana aquí** |
| [`HANDOFF_SESION_2026-05-18_PAUSA_ALTA_CHECKIN.md`](./HANDOFF_SESION_2026-05-18_PAUSA_ALTA_CHECKIN.md) | Epic **check-in + alta RRHH** cerrado (oleadas 1–3); siguiente: ticketera básica |
| [`HANDOFF_SESION_2026-05-18_ARTICULOS_BASICOS_Y_CONTINUIDAD.md`](./HANDOFF_SESION_2026-05-18_ARTICULOS_BASICOS_Y_CONTINUIDAD.md) | **Registro + plan:** catálogo LAO/64-A/64-B/68-B, piloto BD, cómo seguir |
| [`RFC_TICKETERA_SLICE_64A_MVP_V2.md`](./RFC_TICKETERA_SLICE_64A_MVP_V2.md) | **Oleada 0:** contrato MVP solicitud 64-A (elegibilidad HLC, trigger Patrón B, fuera de alcance MDC) |
| [`TICKETERA_SLICE_64A_MATRIZ_PRUEBAS.md`](./TICKETERA_SLICE_64A_MATRIZ_PRUEBAS.md) | Matriz T1–T8 + regresión slice 64-A (**cerrada** piloto 2026-05-19) |
| [`PLAN_TICKETERA_SLICE_64B_V2.md`](./PLAN_TICKETERA_SLICE_64B_V2.md) | **Plan** slice 64-B (Patrón B sin goce) — piloto cerrado 2026-05-19 |
| [`PLAN_TICKETERA_V2.md`](./PLAN_TICKETERA_V2.md) | **Plan maestro ticketera** — dónde estamos, fases, roadmap (Fase 1 cerrada → Fase 2 dinámica) |
| [**`HANDOFF_SESION_2026-05-20_MDC_OLEADA_B_PAUSA.md`**](./HANDOFF_SESION_2026-05-20_MDC_OLEADA_B_PAUSA.md) | **RETOMAR AQUÍ** — Oleada B MDC desplegada; validaciones; grupo ancla; §8 próximo paso |
| [`HANDOFF_SESION_2026-05-19_AUTORIZACION_TICKETERA.md`](./HANDOFF_SESION_2026-05-19_AUTORIZACION_TICKETERA.md) | RFC autorización + plan (doc); superseded por handoff 20-may para código |
| [`HANDOFF_TICKETERA_PAUSA_2026-05-19_FASE2-4.md`](./HANDOFF_TICKETERA_PAUSA_2026-05-19_FASE2-4.md) | PAUSA Fase 2–4 MVP bandejas (AS-IS desplegado) |
| [`TICKETERA_EVIDENCIA_2026-05-21_GRILLA_RDA_REJECT.md`](./TICKETERA_EVIDENCIA_2026-05-21_GRILLA_RDA_REJECT.md) | Prueba rechazo **GRILLA_NO_AUTORIZADA** (motor/trigger, sin descuento) |
| [`TICKETERA_EVIDENCIA_2026-05-21_CREATE_PATRON_B.md`](./TICKETERA_EVIDENCIA_2026-05-21_CREATE_PATRON_B.md) | Evidencia Bloque A create + `sol_01KS4ZG2…` / `sol_01KS50G2…` |
| [`TICKETERA_EVIDENCIA_2026-05-21_OLEADA_A_AUTORIZACION_TC.md`](./TICKETERA_EVIDENCIA_2026-05-21_OLEADA_A_AUTORIZACION_TC.md) | E2E TO-BE jefe cierra + TC RRHH · `sol_01KS57Y…` + eventos `evt_*` |
| [`TICKETERA_EVIDENCIA_2026-05-21_OLEADA_B_MDC_SOL_01KS57Y.md`](./TICKETERA_EVIDENCIA_2026-05-21_OLEADA_B_MDC_SOL_01KS57Y.md) | MDC `asi_*` / `vis_*` con flujo Oleada A limpio (misma `sol_01KS57Y…`) |
| [`OLEADA_C_SLICE1_GSO_VISTA_MES.md`](./OLEADA_C_SLICE1_GSO_VISTA_MES.md) | Oleada C slice 1 — UI calendario + callable `obtenerVistaGrillaMesAgente` |
| [`HANDOFF_SESION_2026-05-21_BLOQUE_A_Y_CONTINUIDAD.md`](./HANDOFF_SESION_2026-05-21_BLOQUE_A_Y_CONTINUIDAD.md) | **Oleada A cerrada** — retomar §5 (Oleada B MDC vs hardening UI RRHH) |
| [`RFC_TICKETERA_AUTORIZACION_TOMA_CONOCIMIENTO_V2.md`](./RFC_TICKETERA_AUTORIZACION_TOMA_CONOCIMIENTO_V2.md) | RFC contrato — autorización, TC RRHH, MDC, oleadas A/B/C |
| [`SOLICITUD_ARTICULO_AUTORIZACION_CAMPOS_V2.md`](./SOLICITUD_ARTICULO_AUTORIZACION_CAMPOS_V2.md) | Campos `sol_*` Oleada A + estados TO-BE |
| [`PLAN_IMPLEMENTACION_RFC_AUTORIZACION_TICKETERA_V2.md`](./PLAN_IMPLEMENTACION_RFC_AUTORIZACION_TICKETERA_V2.md) | Plan código Oleada A → B → C |
| [`ANEXO_ALINEACION_RDA_GEMINI_V6_A_V2.md`](./ANEXO_ALINEACION_RDA_GEMINI_V6_A_V2.md) | Mandato RDA diario `asi_*` + vista `vis_*` (vs Gemini V6) |
| [`CONCEPTO_TICKETERA_BANDEJA_DINAMICA_V2.md`](./CONCEPTO_TICKETERA_BANDEJA_DINAMICA_V2.md) | Visión producto (incorporada en plan maestro §2) |
| [`CHECKIN_SALDOS_MATRIZ_PRUEBAS.md`](./CHECKIN_SALDOS_MATRIZ_PRUEBAS.md) | Matriz manual check-in + guía alta + § H artículos básicos |
| [`GUIA_OPERATIVA_CHECKIN_SALDOS_RRHH.md`](./GUIA_OPERATIVA_CHECKIN_SALDOS_RRHH.md) | Guía operador RRHH check-in (copy SSoT en `checkinSaldosAyudaRrhh.js`) |
| [`FLUJO_ONBOARDING_RRHH_ALTA_AGENTE_V2.md`](./FLUJO_ONBOARDING_RRHH_ALTA_AGENTE_V2.md) | Ciclo propuesto alta RRHH: cáscara → `/portal/laboral` → `/portal/rrhh/checkin-saldos` |
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
| [`HANDOFF_SESION_2026-05-12.md`](./HANDOFF_SESION_2026-05-12.md) | Artículos V2 — Paso 0 LAO, §7 en MODULO PF, guardián Bloque 4, migración `migrate-step0-lao-identity`, matriz UI |
| [`HANDOFF_SESION_2026-05-13.md`](./HANDOFF_SESION_2026-05-13.md) | Refactorización UX/UI "RRHH-First" del Configurador de Artículos — 3 pestañas humanas, widgets extraídos, labels/ayuda contextual, banner Reactivar, campos cupo/frecuencia/evento, definición operativa workflow/burbujeo, corrección `ambito_consumo_id` |
| [`HANDOFF_SESION_2026-05-19.md`](./HANDOFF_SESION_2026-05-19.md) | **Datos laborales:** fechas YMD BA, BOLA, `rrhhDeshabilitarHlg`, planilla 7 días, HLg ocultos en UI, panel HLD, refactor web (tarjetas/modales/hooks), docs arquitectura + auditoría |
| [`ROADMAP_MOTOR_LAO_V2_POST_CHECKPOINT.md`](./ROADMAP_MOTOR_LAO_V2_POST_CHECKPOINT.md) | **Plan técnico** post-checkpoint Motor LAO V2 (fases 3b, 4, 5) y comando “retomar aquí” |
| [`REFACTOR_WEB_DATOS_LABORALES_FORMULARIO_V2.md`](./REFACTOR_WEB_DATOS_LABORALES_FORMULARIO_V2.md) | Refactor UI del formulario datos laborales: `LabeledSelect` / `LabeledTextField`, modo `bare`, fix edición por persona; lista de archivos y pendientes |
| [`DATOS_LABORALES_ARQUITECTURA_WEB_V2.md`](./DATOS_LABORALES_ARQUITECTURA_WEB_V2.md) | **Arquitectura web** Datos laborales: árbol `datos-laborales/`, hooks, snapshots, tarjetas/modales, reglas UI (HLg ocultos, HLD vs HLc/HLg, guardar deshabilitado) |
| [`DATOS_LABORALES_AUDITORIA_E_IMPLEMENTACION_2026-05-19.md`](./DATOS_LABORALES_AUDITORIA_E_IMPLEMENTACION_2026-05-19.md) | Auditoría e implementación **may 2026**: fechas YMD, BOLA, `rrhhDeshabilitarHlg`, planilla 7 días, IAM callables; enlace a arquitectura web |

**Lecciones desde código V1 (en referencia V1):** [`../referencia_v1/PROBLEMA_LOGIN_PERMISOS.md`](../referencia_v1/PROBLEMA_LOGIN_PERMISOS.md) y el resto de `docs/referencia_v1/` según necesidad.
