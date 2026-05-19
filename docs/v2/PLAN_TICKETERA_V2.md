# Plan maestro — Ticketera / solicitudes V2

**Estado del documento:** plan vivo · **última revisión:** 2026-05-19 · **PAUSA implementación:** [`HANDOFF_TICKETERA_PAUSA_2026-05-19_FASE2-4.md`](./HANDOFF_TICKETERA_PAUSA_2026-05-19_FASE2-4.md)  
**Ámbito:** ingreso agente, motores por patrón de saldo, bandejas (jefe / médico futuro), relación con `cfg_articulos`.

**Visión de producto (incorporada):** [`CONCEPTO_TICKETERA_BANDEJA_DINAMICA_V2.md`](./CONCEPTO_TICKETERA_BANDEJA_DINAMICA_V2.md) — herramienta **dinámica**, fechas impuestas, preview, subflujos LAO y licencias médicas.

---

## 1. Dónde estamos hoy (respecto a este plan)

Leyenda: **Hecho** · **Parcial** · **Pendiente**

| Fase / entrega | Estado | Evidencia |
|----------------|--------|-----------|
| **F0 — Contrato artículos + saldos** | **Hecho** | `cfg_articulos`, patrones A/B/C, check-in, [`RFC_SALDOS_PATRONES_ABC_V2.md`](./RFC_SALDOS_PATRONES_ABC_V2.md) |
| **F1 — Slice 64-A MVP (Patrón B)** | **Hecho** | Matriz cerrada [`TICKETERA_SLICE_64A_MATRIZ_PRUEBAS.md`](./TICKETERA_SLICE_64A_MATRIZ_PRUEBAS.md), `sol_01KRYPR…` |
| **F1b — Roles HLC + claims + rules** | **Hecho** | [`RFC_ACCESO_ROLES_HLC_MENUS_V2.md`](./RFC_ACCESO_ROLES_HLC_MENUS_V2.md), deploy rules 2026-05-19 |
| **F1c — Slice 64-B (mismo carril B)** | **Hecho** | [`PLAN_TICKETERA_SLICE_64B_V2.md`](./PLAN_TICKETERA_SLICE_64B_V2.md), `sol_01KS015…` |
| **F2 — Ticketera dinámica (UX completa)** | **Hecho (piloto)** | [`TICKETERA_FASE2_EVIDENCIA_PILOTO.md`](./TICKETERA_FASE2_EVIDENCIA_PILOTO.md) — 64-A/64-B sept + preview |
| **F2a — Listado performante** | **Hecho** | Deploy `listarArticulosIngresoAgente` 2026-05-19 |
| **F2b — Preview + fechas impuestas** | **Hecho** | Deploy `previsualizarSolicitudPatronB` · evidencia F2-1 |
| **F3a — LAO dentro del concepto ticketera** | **Parcial** | Motor y ruta `/portal/solicitudes/lao`; no shell unificado |
| **F3b — Bandeja jefe** | **Hecho (piloto J2–J3)** | [`TICKETERA_FASE3_EVIDENCIA_PILOTO.md`](./TICKETERA_FASE3_EVIDENCIA_PILOTO.md) |
| **F4 — Bandeja RRHH solicitudes** | **Parcial (piloto R2)** | [`TICKETERA_FASE4_EVIDENCIA_PILOTO.md`](./TICKETERA_FASE4_EVIDENCIA_PILOTO.md) · R3 pendiente |
| **F5 — Lic. médicas + bandeja médico** | **Pendiente** | Concepto §4.3 del documento visión |
| **F6 — Delegación jefe → subordinado** | **Pendiente** | [`CUESTIONES_TICKET_SOLICITUD_POR_DELEGACION_JEFE_V2.md`](./CUESTIONES_TICKET_SOLICITUD_POR_DELEGACION_JEFE_V2.md) |

**Resumen en una frase:** el **motor** y los **filtros** de elegibilidad están probados en piloto (64-A/64-B); falta la **ticketera como producto** (una entrada, listado rápido, preview, fechas solo lectura, bandejas).

**Código sin commit (rama local):** cambios 64-B + UI multi-artículo + docs; conviene commit cuando cierre operador.

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
| 3 | Listado artículos elegibles | **Parcial** — P0 en core; deploy + shell única pendientes |
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

### Fase 4 — LAO integrado en shell ticketera

- Misma entrada menú; redirige a subflujo LAO existente.
- Mantener motor LAO sin duplicar validación Patrón B.

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
| [`TICKETERA_SLICE_64A_MATRIZ_PRUEBAS.md`](./TICKETERA_SLICE_64A_MATRIZ_PRUEBAS.md) | Pruebas Fase 1 |
| [`PLAN_TICKETERA_SLICE_64B_V2.md`](./PLAN_TICKETERA_SLICE_64B_V2.md) | Entrega 64-B |
| [`RFC_ACCESO_ROLES_HLC_MENUS_V2.md`](./RFC_ACCESO_ROLES_HLC_MENUS_V2.md) | Menú / claims transversal |
| [`ARTICULOS_BASICOS_OPERATIVOS_V2.md`](./ARTICULOS_BASICOS_OPERATIVOS_V2.md) | IDs piloto LAO/64-A/64-B/68-B |
| [`BACKLOG_MODULOS_PARALELOS_ARTICULOS_V2.md`](./BACKLOG_MODULOS_PARALELOS_ARTICULOS_V2.md) | Interfaces MDC, SLA, eventos |

---

## 5. Criterio de “siguiente sprint”

**Recomendado:** Fase **2.0 + 2.1** (RFC ticketera dinámica + listado performante) **antes** de más artículos en whitelist.

**Alternativa:** Fase **3** (bandeja jefe) si negocio prioriza cerrar ciclo aprobación del piloto 64-A.

---

## 6. Changelog

| Fecha | Cambio |
|-------|--------|
| 2026-05-19 | Plan maestro creado; visión dinámica incorporada; tabla “dónde estamos” vs fases. |
