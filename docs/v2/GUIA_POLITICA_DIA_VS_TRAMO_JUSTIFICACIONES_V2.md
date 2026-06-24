# Guía de política institucional — Día completo vs tramo horario (justificaciones)

**Audiencia:** RRHH, jefes de servicio, supervisores de grilla.  
**Alcance:** interpretación operativa del enlace entre **asistencia** (teoría RDA + fichada + licencias) y **artículos** del Decreto 1919/89 en el portal.  
**No sustituye** el texto legal ni las fichas por inciso en [`LINEAMIENTOS_DECRETO_1919_89_POR_ARTICULO_V2.md`](./LINEAMIENTOS_DECRETO_1919_89_POR_ARTICULO_V2.md).

**Principio de producto:** la grilla y la ticketera **no actúan solas**. Unifican y validan capas; **no sugieren** artículos ni aplican sanciones. Toda justificación es **solicitud → validación → autorización** según `cfg_articulos` y workflow.

**Referencias:** [`ANALISIS_IMPACTO_GRILLA_ARTICULOS_1919_V2.md`](./ANALISIS_IMPACTO_GRILLA_ARTICULOS_1919_V2.md) · [`PLAN_LINEAMIENTOS_DECRETO_1919_MOTOR_SOLICITUDES_V2.md`](./PLAN_LINEAMIENTOS_DECRETO_1919_MOTOR_SOLICITUDES_V2.md) · [`ARTICULOS_BASICOS_OPERATIVOS_V2.md`](./ARTICULOS_BASICOS_OPERATIVOS_V2.md)

---

## 1. Unidades de medición: día calendario y tramos

1. **Cada día del mes** el agente tiene asignación: franco, día no laboral o **turno(s) teórico(s)** (RDA).
2. **Cada tramo o turno** dentro del día cuenta como **una asistencia** independiente para fichada y validación.
3. **Ejemplo M+T+N:** tres tramos (p. ej. mañana, tarde, noche) → tres asistencias el mismo día calendario; cada una con teoría de fichadas y marcas propias.
4. El portal **compone** teoría, fichada real y eventos MDC (licencias aprobadas/pendientes); **no** elige el artículo por el usuario.

---

## 2. Estados de asistencia (fuente de verdad técnica)

| Estado | Definición operativa | Rol del portal |
|--------|----------------------|----------------|
| **OK** | Hay fichadas y cumplen parámetros del tramo teórico (ingreso, egreso, carga horaria). | Muestra capas alineadas; sin gap. |
| **Inasistencia (tramo)** | Tramo con turno teórico y **sin** fichadas reales (o sin cobertura de licencia que el motor trate como cubierta según versión publicada). | Muestra gap; **no** auto-justifica. |
| **Asistencia incompleta** | Hay fichadas pero **no** cumplen parámetros (delta de horas). | Muestra incompleto / faltan horas; **no** auto-justifica. |

El cálculo de OK / incompleto / inasistencia es responsabilidad del **régimen horario** y la validación de fichada (`validacion_fichada_dia` / analítica), no del configurador de artículos.

---

## 3. Regla de absorción — inasistencia total del tramo

Cuando el agente **falta a la totalidad** de un tramo asignado:

- Solo puede justificarlo con artículos en **días** (`unidad_medida_id` = `cfg_uma_dias`) **o** con artículos en **horas** que consuman la **carga horaria completa** del tramo ausente (ej.: tramo de 8 h justificado con 8 h de saldo en **68-B**, si la versión publicada lo permite y hay saldo).
- **No** se fragmenta una inasistencia total del mismo tramo en varias solicitudes de horas del **mismo** artículo para “armar” el tramo (política RRHH; el motor valida topes y unidad, no la intención).
- La justificación **no es automática**: el agente (o quien corresponda por circuito) **solicita**; jefe/RRHH **aprueban** según workflow.

**Enlace asistencia en fichas:** `cubre_inasistencia_total` (por tramo o día según parametrización del `art_*`).

---

## 4. Regla del delta horario — fichada incompleta

Cuando hay **marcas** pero la carga del tramo **no** se cumple:

- Corresponde artículos por **horas** o franquicias horarias (**64-B** si aplica en días sin goce, **68-B**, **65–70 bis** cuando estén operativos), según `unidad_medida_id` y topes de la versión publicada.
- Hasta **Fase 5 grilla**, la cobertura por **franja** dentro del tramo puede ser limitada en UI; la ficha de cada artículo declara comportamiento **objetivo** vs **hoy**.

**Enlace asistencia en fichas:** `cubre_delta_horario`.

---

## 5. Cruce excepcional — artículo de día entero sobre delta incompleto

- Un artículo parametrizado en **día entero** puede, en casos excepcionales, justificar un **delta horario** incompleto solo mediante **acto explícito de RRHH** (aprobación en workflow).
- El portal **no** ofrece atajo en grilla ni wizard del tipo “por estar incompleto, use 64-A”.
- La decisión queda en acta / criterio supervisor y debe ser coherente con la ficha del artículo y topes.

---

## 6. Multievento y pila MDC el mismo día

- Pueden coexistir **varios** eventos MDC en un día (p. ej. licencias distintas en tramos distintos) si RRHH aprueba cada solicitud.
- La grilla refleja **pila** de códigos y `tiene_conflicto` según `nivel_ocupacion_dia_id` (`cfg_nod_exclusivo`, `cfg_nod_parcial`, `cfg_nod_informativo`).
- El sistema **no** resuelve automáticamente conflictos normativos; muestra estado y reglas de superposición configuradas.

---

## 7. Sin justificación y sanciones

- Si persiste inasistencia o delta sin licencia aprobada que cubra según motor, la grilla muestra el **gap**.
- **Sanciones disciplinarias:** fuera del portal (RRHH / SARH / procedimiento EGAP). El portal no impone sanciones en esta épica.

---

## 8. Coherencia en configurador (RRHH)

- Al guardar una versión, el ABM puede mostrar **advertencias de coherencia** (ej. unidad horas vs `nivel_ocupacion_dia_id` no parcial): son para **quien parametriza**, no mensajes al agente en grilla.

---

## 8. Coherencia con Bloque E (acta RRHH)

Los artículos **63.c–63.k** de justificación se parametrizan **solo por día entero exclusivo** (`cfg_nod_exclusivo`). No aplican justificaciones por tramo horario en esta oleada; ver [`LINEAMIENTOS_DECRETO_1919_89_POR_ARTICULO_V2.md`](./LINEAMIENTOS_DECRETO_1919_89_POR_ARTICULO_V2.md) Bloque E.

---

## Changelog

| Fecha | Cambio |
|-------|--------|
| 2026-06-24 | Creación P0 épica 1919 — tramos M+T+N, absorción tramo, delta, cruce RRHH, grilla pasiva. |
