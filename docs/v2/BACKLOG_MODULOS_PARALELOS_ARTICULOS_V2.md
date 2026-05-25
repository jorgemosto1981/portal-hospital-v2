# Backlog — Módulos paralelos al dominio Artículos — V2

**Propósito:** listar **dependencias e interfaces** entre la configuración de artículos / solicitudes y el resto del ecosistema V2. Sirve para RFC cruzados y orden de implementación.

**Fecha:** 9 de mayo de 2026.

**Estado:** **borrador**.

---

## 1. Tabla de interfaces

| Módulo | Entrada / salida con Artículos | Notas |
|--------|-------------------------------|--------|
| Motor de validación (callable/backend) | Lee `cfg_articulos` + `cfg_*`; crea/actualiza `solicitudes_articulo` | Rechazo con `motivo_*` tipificado |
| Ticketera / solicitud | CRUD solicitud; titular vs actor; `origen_alta_id`; delegación jefe | [`CUESTIONES_TICKET_SOLICITUD_POR_DELEGACION_JEFE_V2.md`](./CUESTIONES_TICKET_SOLICITUD_POR_DELEGACION_JEFE_V2.md) |
| Máquina de estados | Transiciones según matriz; **callable** donde reglas V2 lo exijan | Estados en `cfg_estado_solicitud_articulo` |
| Asistencia / MDC / RDA | **Próximos N días laborables del agente**; no recalcular francos en ticketera | [`ARQUITECTURA_MAESTRA_SIGAL_V2_MODULO_OPERATIVO_ASISTENCIA.md`](./ARQUITECTURA_MAESTRA_SIGAL_V2_MODULO_OPERATIVO_ASISTENCIA.md) |
| Calendario institucional | `cfg_calendario_feriados_institucional` (`cfg_cfi_*`) resta días en hábil compuesto | Alcance por `alcance_efector_id` |
| Motor de plazos documentales | Usa `cfg_tcp_*` + resultado Asistencia + `cfg_cfi_*` | Ver módulo artículos — documentación diferida |
| Superposición / prioridad | Políticas e incompatibilidades; eventos de resolución | Integración con reglas de asistencia para consolidación |
| SLA / burbujeo | Temporizadores por paso; escalamiento | Campos `vencimiento_en`, `sla_*`, `escalamientos_*` |
| Eventos RRHH | `eventos_ticket` / `cfg_tipo_evento`; prefijo `cfg_tev_art_*` | [`PLAN_UNIFICACION_EVENTOS_RRHH_2026-05-06.md`](./PLAN_UNIFICACION_EVENTOS_RRHH_2026-05-06.md) |
| Notificaciones | Derivadas de eventos y preferencias | Pendiente contrato unificado si aplica |
| Tomas de conocimiento | Paso opcional en workflow; burbujeo de acuse por `hlg_*.nivel_jerarquico` hacia grupo padre | `toma_conocimiento_limitada` (bool) + `niveles_burbujeo` (tope de niveles; UI-only por ahora). Cloud Function usará `niveles_burbujeo` como límite del bucle de escalamiento. Plantillas de conocimiento pendientes |
| Reemplazos / contrataciones | Flags `admite_reemplazo`, `dispara_evento_contrataciones`; señal upstream: `logistica_aviso_habilitada` en config de artículo | `logistica_aviso_habilitada` identifica artículos que generan necesidad de cobertura (ej. Art. 16-0, Tareas Diferentes). Backlog cruzado según política hospitalaria |

---

## 2. Contrato crítico: laborables del agente

- El módulo de artículos **no** calcula francos ni turnos.
- Debe consumir un contrato del área **Asistencia/MDC** del estilo: **lista de fechas laborables** del agente en un horizonte N, derivada de RDA/plantilla vigente.

---

## 3. Fuera de alcance MVP explícito

- **Recordatorios proactivos** antes del vencimiento documental (evaluar job programado en fase posterior, p. ej. v2.2).
- Detalle de implementación Cloud Scheduler / Functions: solo tras RFC de operaciones.

---

## 4. Referencias

- [`MODULO_CONFIGURACION_ARTICULOS_V2.md`](./MODULO_CONFIGURACION_ARTICULOS_V2.md)
- [`MATRIZ_ESCENARIOS_ARTICULOS_V2.md`](./MATRIZ_ESCENARIOS_ARTICULOS_V2.md)
