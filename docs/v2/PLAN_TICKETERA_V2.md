# Plan maestro — Ticketera / solicitudes V2

**Estado del documento:** plan vivo · **última revisión:** 2026-05-22 · **Handoff sesión:** [`HANDOFF_SESION_2026-05-22_LAO_WIZARD_F3A1.md`](./HANDOFF_SESION_2026-05-22_LAO_WIZARD_F3A1.md) · anterior: [`HANDOFF_SESION_2026-05-21_TICKETERA_PASO2_CIERRE.md`](./HANDOFF_SESION_2026-05-21_TICKETERA_PASO2_CIERRE.md) · **Fase 2:** [`TICKETERA_EVIDENCIA_2026-05-21_FASE2_WIZARD.md`](./TICKETERA_EVIDENCIA_2026-05-21_FASE2_WIZARD.md) · **Oleada A:** [`TICKETERA_EVIDENCIA_2026-05-21_OLEADA_A_AUTORIZACION_TC.md`](./TICKETERA_EVIDENCIA_2026-05-21_OLEADA_A_AUTORIZACION_TC.md) · **Paso 2 entorno:** [`RFC_TICKETERA_FLUJO_PROGRESIVO_PASO2_ENTORNO_V2.md`](./RFC_TICKETERA_FLUJO_PROGRESIVO_PASO2_ENTORNO_V2.md)  
**Ámbito:** ingreso agente, motores por patrón de saldo, bandejas (jefe / médico futuro), relación con `cfg_articulos`.

**Visión de producto (incorporada):** [`CONCEPTO_TICKETERA_BANDEJA_DINAMICA_V2.md`](./CONCEPTO_TICKETERA_BANDEJA_DINAMICA_V2.md) — herramienta **dinámica**, fechas impuestas, preview, subflujos LAO y licencias médicas.

---

## 1. Dónde estamos hoy (respecto a este plan)

Leyenda: **Hecho** · **Parcial** · **Pendiente**

| Fase / entrega | Estado | Evidencia |
|----------------|--------|-----------|
| **F0 — Contrato artículos + saldos** | **Hecho** | `cfg_articulos`, patrones A/B/C, check-in, [`RFC_SALDOS_PATRONES_ABC_V2.md`](./RFC_SALDOS_PATRONES_ABC_V2.md) |
| **F1 — Slice 64-A MVP (Patrón B)** | **Hecho** | Matriz cerrada [`TICKETERA_SLICE_64A_MATRIZ_PRUEBAS.md`](./TICKETERA_SLICE_64A_MATRIZ_PRUEBAS.md), `sol_01KRYPR…` |
| **F1-create — Contrato alta Patrón B (Bloque A)** | **Hecho (21-may)** | `version_id_aplicada` + `grupo_trabajo_id_ancla` · [`TICKETERA_EVIDENCIA_2026-05-21_CREATE_PATRON_B.md`](./TICKETERA_EVIDENCIA_2026-05-21_CREATE_PATRON_B.md) |
| **F1b — Roles HLC + claims + rules** | **Hecho** | [`RFC_ACCESO_ROLES_HLC_MENUS_V2.md`](./RFC_ACCESO_ROLES_HLC_MENUS_V2.md), deploy rules 2026-05-19 |
| **F1c — Slice 64-B (mismo carril B)** | **Hecho** | [`PLAN_TICKETERA_SLICE_64B_V2.md`](./PLAN_TICKETERA_SLICE_64B_V2.md), `sol_01KS015…` |
| **F2 — Ticketera dinámica (UX completa)** | **Hecho (21-may)** | Wizard 3 pasos Patrón B · [`RFC_TICKETERA_FASE2_DINAMICA_V2.md`](./RFC_TICKETERA_FASE2_DINAMICA_V2.md) |
| **F2a — Listado performante (P0)** | **Hecho (21-may)** | `listarArticulosIngresoCore` MVP/catalogo · deploy Functions 21-may |
| **F2b — Preview + fechas impuestas** | **Hecho** | Paso 3 wizard + `fecha_hasta` RO en paso 2 |
| **F2c — Paso 2 entorno (HLg / grilla / turno)** | **Hecho (21-may)** | `validarEntornoOperativoSolicitud` + UI gate · commits `9319bf7`–`72c8ae6` |
| **F3a — LAO dentro del concepto ticketera** | **Parcial (22-may)** | Wizard paso 1 + callable bolsa · [`HANDOFF_SESION_2026-05-22_LAO_WIZARD_F3A1.md`](./HANDOFF_SESION_2026-05-22_LAO_WIZARD_F3A1.md) · paso 2 fechas pendiente |
| **F3b — Bandeja jefe** | **Hecho (22-may)** | Filtros, paginación, expand · piloto J2–J3 · [`TICKETERA_FASE3_EVIDENCIA_PILOTO.md`](./TICKETERA_FASE3_EVIDENCIA_PILOTO.md) |
| **F4 — Bandeja RRHH + Oleada A** | **Hecho (22-may)** | TC + cierre jefe; bandeja filtrable · [`RFC_TICKETERA_AUTORIZACION_TOMA_CONOCIMIENTO_V2.md`](./RFC_TICKETERA_AUTORIZACION_TOMA_CONOCIMIENTO_V2.md) · [`TICKETERA_EVIDENCIA_2026-05-21_OLEADA_A_AUTORIZACION_TC.md`](./TICKETERA_EVIDENCIA_2026-05-21_OLEADA_A_AUTORIZACION_TC.md) |
| **F5 — Lic. médicas + bandeja médico** | **Pendiente** | Concepto §4.3 del documento visión |
| **F6 — Delegación jefe → subordinado** | **Pendiente** | [`CUESTIONES_TICKET_SOLICITUD_POR_DELEGACION_JEFE_V2.md`](./CUESTIONES_TICKET_SOLICITUD_POR_DELEGACION_JEFE_V2.md) |

**Resumen en una frase:** ticketera Patrón B + bandejas en prod; **F3a.1 paso 1 LAO** (disponibilidad + callable) desplegado; **siguiente P1:** F3a.1 paso 2 (rango + `resumen_computo` FE) → F3a.2 backend preview.

**Rama remota:** `feature/ticketera-puente-campos-config` (ver último commit en GitHub).

---

## 2. Visión incorporada — ticketera dinámica

*(Resumen; detalle en [`CONCEPTO_TICKETERA_BANDEJA_DINAMICA_V2.md`](./CONCEPTO_TICKETERA_BANDEJA_DINAMICA_V2.md))*

### 2.1 Principios

1. **Un menú “Solicitudes” / ticketera**, no un ítem de menú por artículo (salvo subflujos muy distintos acordados).
2. **Listado filtrado** por `fecha_desde` + HLC + versión publicada + circuito (`roles_hlc_vigentes` / `rol_id` en HLC).
3. Al elegir artículo, **días y `fecha_hasta` los impone la versión** (solo lectura en UI).
4. Flujo: **listado → artículo → fechas → previsualizar → enviar → confirmación**.
5. **Subflujos:** LAO (Patrón A); licencias médicas (futuro, arranque genérico + auditoría médico).

### 2.2 Flujo objetivo (agente)

| # | Paso | Implementación actual |
|---|------|------------------------|
| 1 | Entrada ticketera | **Parcial** — menú **Solicitudes** → hub; LAO/Patrón B como carriles |
| 2 | `fecha_desde` | **Hecho** |
| 3 | Listado artículos elegibles | **Hecho** — P0 + wizard paso 1 |
| 4 | Elegir artículo | **Hecho** (selector 64-A/64-B) |
| 5 | `fecha_hasta` impuesta (RO) | **Parcial** — DTO + campo RO en asuntos partic.; motor sigue 1 día |
| 6 | Previsualizar | **Hecho** Patrón B; LAO mantiene `simularLaoPreview` |
| 7 | Enviar + validación | **Hecho** Patrón B; triggers |
| 8 | Confirmación | **Hecho** toast + `sol_*` |

### 2.3 Rendimiento (bloqueante antes de ~50 artículos)

| Prioridad | Acción |
|-----------|--------|
| **P0** | Rediseñar `listarArticulosIngresoAgente`: no `get()` total `cfg_articulos`; catálogo acotado + batch versiones |
| P1 | Cache sesión `persona_id` + `fecha_desde` |
| P2 | Búsqueda / paginación si listado > umbral |

### 2.4 Carriles dentro de la ticketera

| Carril | Patrón | Estado |
|--------|--------|--------|
| Asuntos particulares y similares | B | **Piloto** 64-A/64-B |
| LAO | A | **Parcial** (ruta dedicada) |
| Licencias médicas | TBD + médico | **Pendiente** |

---

## 3. Roadmap por fases (plan)

### Fase 1 — MVP motor Patrón B (cerrada 2026-05-19)

- [x] RFC 64-A, trigger, saldos, matriz T1–T8 + R1–R2 (operador).
- [x] 64-B en whitelist + UI selector.
- [x] Menú por elegibilidad (`ArticulosIngresoProvider`).
- [x] Claims `roles_hlc_vigentes`, Firestore rules RRHH.

**Docs:** [`RFC_TICKETERA_SLICE_64A_MVP_V2.md`](./RFC_TICKETERA_SLICE_64A_MVP_V2.md) · [`PLAN_TICKETERA_SLICE_64B_V2.md`](./PLAN_TICKETERA_SLICE_64B_V2.md).

### Fase 2 — Ticketera dinámica agente (siguiente)

| Oleada | Entregable | Depende de |
|--------|------------|------------|
| **2.0** | RFC contrato: DTO listado enriquecido, preview, `fecha_hasta` calculada | Concepto §2 |
| **2.1** | **P0 rendimiento** listado | 2.0 |
| **2.2** | Pantalla única `/portal/solicitudes` (wizard por `patron_saldo` / flags) | 2.1 |
| **2.3** | `fecha_hasta` solo lectura + reglas días desde versión | 2.2 |
| **2.4** | Callable **preview** + paso UI “Previsualizar” | 2.3 |
| **2.5** | Quitar whitelist MVP → “todos Patrón B publicados” (o flag entorno) | 2.1 estable |

### Fase 3 — Bandeja jefe

- Listar `sol_*` asignables por jerarquía / grupo.
- Aprobar / rechazar; transiciones `cfg_estado_solicitud_articulo`.
- Enlace con burbujeo (backlog [`BACKLOG_MODULOS_PARALELOS_ARTICULOS_V2.md`](./BACKLOG_MODULOS_PARALELOS_ARTICULOS_V2.md)).

### F3a — LAO wizard en ticketera (contrato 22-may)

**RFC definitivo:** [`RFC_TICKETERA_LAO_WIZARD_V2.md`](./RFC_TICKETERA_LAO_WIZARD_V2.md) · **Calendario / cómputo transversal:** [`MODULO_CALENDARIO_INSTITUCIONAL.md`](./MODULO_CALENDARIO_INSTITUCIONAL.md).

| Subfase | Entregable | Estado |
|---------|------------|--------|
| **F3a.0** | Contrato `resumen_computo`, pasos wizard, alineación `simularLaoPreview` | **Hecho (22-may)** |
| **F3a.1** | Shell wizard hub + paso 1 `obtenerContextoBolsaLaoAgente` + UI Disponibles | **Hecho paso 1 (22-may)** · paso 2 `calcularResumenComputo` pendiente |
| **F3a.2** | `simularLaoPreview` + trigger: `fecha_hasta`, `dias_solicitados` = `dias_consumo`, `resumen_computo` en respuesta | Pendiente |
| **F3a.3** | DatePicker hábil + polish paso 3 (preview derecho LAO) | Pendiente |

Reglas de producto (resumen): usuario solo elige rango; norma = `regla_computo_dias_id` del configurador (LAO con calendario institucional vía regla, no hardcode); sin campo editable de cantidad de días.

### Fase 4 — LAO integrado en shell ticketera (histórico roadmap)

- Cubierto por **F3a** arriba; ruta actual `/portal/solicitudes/lao` evoluciona al wizard de 4 pasos del RFC.

### Fase 5 — Licencias médicas + médico

- Wizard inicio: enfermedad personal / atención familiar (parámetros RRHH).
- Bandeja auditoría rol médico.
- RFC slice cuando exista catálogo en Firestore.

### Fase 6 — Delegación y extras

- Jefe inicia por subordinado ([`CUESTIONES_TICKET_SOLICITUD_POR_DELEGACION_JEFE_V2.md`](./CUESTIONES_TICKET_SOLICITUD_POR_DELEGACION_JEFE_V2.md)).
- 68-B y Patrón C en ticketera si aplica.

---

## 4. Mapa de documentos

| Documento | Rol en el plan |
|-----------|----------------|
| **Este archivo** | Plan maestro + **estado actual** |
| [`CONCEPTO_TICKETERA_BANDEJA_DINAMICA_V2.md`](./CONCEPTO_TICKETERA_BANDEJA_DINAMICA_V2.md) | Visión producto (incorporada en §2) |
| [`RFC_TICKETERA_SLICE_64A_MVP_V2.md`](./RFC_TICKETERA_SLICE_64A_MVP_V2.md) | Contrato Fase 1 slice A |
| [`RFC_TICKETERA_FASE2_DINAMICA_V2.md`](./RFC_TICKETERA_FASE2_DINAMICA_V2.md) | Contrato Fase 2 listado / preview |
| [`RFC_TICKETERA_FLUJO_PROGRESIVO_PASO2_ENTORNO_V2.md`](./RFC_TICKETERA_FLUJO_PROGRESIVO_PASO2_ENTORNO_V2.md) | Callable paso 2 entorno |
| [`RFC_TICKETERA_LAO_WIZARD_V2.md`](./RFC_TICKETERA_LAO_WIZARD_V2.md) | Contrato wizard LAO F3a |
| [`MODULO_CALENDARIO_INSTITUCIONAL.md`](./MODULO_CALENDARIO_INSTITUCIONAL.md) | SSoT feriados + motor C4 / hábiles |
| [`HANDOFF_SESION_2026-05-22_LAO_WIZARD_F3A1.md`](./HANDOFF_SESION_2026-05-22_LAO_WIZARD_F3A1.md) | **Retomar otra PC (LAO wizard)** |
| [`HANDOFF_SESION_2026-05-21_TICKETERA_PASO2_CIERRE.md`](./HANDOFF_SESION_2026-05-21_TICKETERA_PASO2_CIERRE.md) | Patrón B paso 2 entorno |
| [`TICKETERA_EVIDENCIA_2026-05-22_LAO_F3A1_PASO1.md`](./TICKETERA_EVIDENCIA_2026-05-22_LAO_F3A1_PASO1.md) | Smoke paso 1 LAO |
| [`TICKETERA_SLICE_64A_MATRIZ_PRUEBAS.md`](./TICKETERA_SLICE_64A_MATRIZ_PRUEBAS.md) | Pruebas Fase 1 |
| [`PLAN_TICKETERA_SLICE_64B_V2.md`](./PLAN_TICKETERA_SLICE_64B_V2.md) | Entrega 64-B |
| [`RFC_ACCESO_ROLES_HLC_MENUS_V2.md`](./RFC_ACCESO_ROLES_HLC_MENUS_V2.md) | Menú / claims transversal |
| [`ARTICULOS_BASICOS_OPERATIVOS_V2.md`](./ARTICULOS_BASICOS_OPERATIVOS_V2.md) | IDs piloto LAO/64-A/64-B/68-B |
| [`BACKLOG_MODULOS_PARALELOS_ARTICULOS_V2.md`](./BACKLOG_MODULOS_PARALELOS_ARTICULOS_V2.md) | Interfaces MDC, SLA, eventos |

---

## 5. Criterio de “siguiente sesión” (2026-05-22)

**Cerrado en esta rama:** smoke E2E wizard + Oleada A (`sol_01KS7N68…`) · bandejas jefe/RRHH (filtros, lazy load, expand) · deploy Hosting + callables bandeja.

**P1:** **F3a.1 paso 2** — fechas + `calcularResumenComputo` en wizard LAO ([`HANDOFF_SESION_2026-05-22_LAO_WIZARD_F3A1.md`](./HANDOFF_SESION_2026-05-22_LAO_WIZARD_F3A1.md) §7). Alternativas: **F3a.2** backend · **merge** rama → `main`.

**P2:** índice Firestore historial jefe (`jefe_revision_persona_id` + estado) si falla en prod · TC superiores (RFC §2 ítem 9) · matriz bloqueos paso 2 (opcional).

**No reabrir salvo bug:** Grilla Oleada C · motor MDC base.

---

## 6. Changelog

| Fecha | Cambio |
|-------|--------|
| 2026-05-19 | Plan maestro creado; visión dinámica incorporada; tabla “dónde estamos” vs fases. |
| 2026-05-21 | F2c paso 2 entorno; handoff [`HANDOFF_SESION_2026-05-21_TICKETERA_PASO2_CIERRE.md`](./HANDOFF_SESION_2026-05-21_TICKETERA_PASO2_CIERRE.md); rama @ `72c8ae6`. |
| 2026-05-22 | Oleada A E2E; bandejas RRHH/jefe; UX listado 3 renglones; plan §1 actualizado. |
| 2026-05-22 | Calendario institucional + `readModoCalculo` en motor Patrón B; RFC F3a LAO wizard; plan §F3a. |
| 2026-05-22 | F3a.1 paso 1: callable `obtenerContextoBolsaLaoAgente` + wizard Disponibles; handoff LAO; deploy hosting/functions. |
