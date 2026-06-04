# Handoff — Acta GSO reconciliación capas + piloto junio 2026 Sala

**Estado:** documentación cerrada (junio 2026) — **sin implementación de código** en esta sesión.  
**Fecha registro:** 4 de junio de 2026.  
**Contrato maestro:** [`CRITERIOS_ACEPTACION_GSO_CONFLICTOS_CAPAS_V2.md`](./CRITERIOS_ACEPTACION_GSO_CONFLICTOS_CAPAS_V2.md)  
**Análisis brechas app:** [`ANALISIS_APP_VS_CRITERIOS_GSO_CONFLICTOS_V2.md`](./ANALISIS_APP_VS_CRITERIOS_GSO_CONFLICTOS_V2.md)

---

## 1. Principio rector (RRHH + producto)

La **GSO operativa** (equipo, sector, titular) es un **tablero de reconciliación**:

- Capa 1 (teoría: turnos, francos, NL) **puede cambiar** (plan, HLg, régimen, feriados, materialización al abrir equipo).
- Capa 3 (licencias / trámites en `eventos[]`) es **relativamente estable**.
- La UI muestra **ambas** y señala desalineación; **no** oculta licencias ni “arregla” en silencio.

### Reglas duras acordadas

| Regla | Contenido |
| :--- | :--- |
| **Celda en blanco** | **Error** (defecto P0). **No se opera** (override, cobertura, gestión turno) sobre blanco. |
| **INCOMPLETO_PLAN** | `laborable`/`guardia` sin turno en plan habilitado: visible (rayado), **sin** mutación de turno hasta replan (Q9-1 B). |
| **Ningún día sin lectura** | Toda casilla muestra turno, F, NL, licencia, ⏳, rayado o mensaje de error — nunca “vacío” operativo. |
| **Remediación** | Planes ya habilitados con huecos/blancos → **rehacer** (US-17). **En adelante** US-9 + anti-blanco. |

---

## 2. Acta RRHH — primera ronda (P1–P8)

| # | Decisión |
| :--- | :--- |
| P1 | No habilitar plan con laborable/guardia sin turno o franco (**US-9**). |
| P2 | Foco en teoría que cambia **después** de la solicitud. |
| P3–P4 | Mismas reglas en vista **titular**. |
| P5 | Tras deshabilitar HLg: licencias preservadas; hint 📅 (copy Q3-2). |
| P6 | Aceptan materializar al abrir equipo + **aviso** (US-11). |
| P7 | Fichada en reconciliación (US-15). |
| P8 | Mes cerrado: licencia visible + 🔒 en edición turno. |

---

## 3. Acta — segunda y tercera ronda (Q9, Q3)

| ID | Respuesta | Resumen |
| :--- | :--- | :--- |
| Q9-1 | **B** | Corrección oficial del mes → plan en revisión; override solo urgencias. |
| Q9-2 | **A** | Motivo override: texto libre obligatorio. |
| Q9-3 | **C** | RRHH: fichada completa; jefe: presente/ausente; titular: sin fichada. |
| Q9-4 | **B** | ⚠️ por teoría ≠ referencia licencia **o** fichada ≠ teoría. |
| Q9-5 | **A** | ⚠️ también si cambió teoría al abrir equipo (causa-agnóstica). |
| Q9-6 | **1+2+3** | Bandeja + override (si no 🔒) + derivar plan/RRHH. |
| Q3-1 | **B** | ⚠️ sin licencia en juego → no; usar escenario C (rayado). |
| Q3-2 | **A** | Copy HLg: *Sin dotación en este grupo desde {fecha}. Licencias del período anterior conservadas.* |
| Q3-3 | Revocado → **§6.5** | Sí rehacer planes afectados (incl. junio Sala). |

**Pendiente opcional:** definición cerrada de “urgencia” para override bajo Q9-1 B (capacitación).

---

## 4. Piloto junio 2026 — Sala Internación 1

| Referencia | Valor |
| :--- | :--- |
| Grupo | `gdt_01KQA6QCA8TDQK9YBTHKYA4R2V` |
| Período | `2026-06` |
| Plan **vigente** (`eliminado: false`) | `plt_01KT9AZQGV0BRZVSEEMBT0141A` |
| Planes **eliminados** (histórico) | `plt_01KSXBAFCN14GSHXE7HMTZM3MK`, `plt_01KSSPY2H5EZA925FQP4S1G2XW` |
| Agentes en plan vigente | LOKITO `per_01KQQJA5Q1VKBTJ74RHQ0HSHSB`, MOSTO `per_01KQN9WXFXF69Z9DCT5YNJ3TFZ` |

### 4.1 Auditoría BD (post replan)

| Control | Resultado |
| :--- | :--- |
| Huecos en plan vigente (`laborable`/`guardia` sin `turno_id`) | **0** |
| MOSTO días 11, 18, 19, 26 en plan | 11 **franco**; 18–19 **N**; 26 **M+T** |
| `vis_*` MOSTO vs plan (misma muestra) | **Alineado**; día 11: franco + evento **64-A** |
| LOKITO plan vs `vis_*` (mes) | **0** desalineaciones; 0 riesgo blanco heurístico |
| CHAPARRO `per_01KR3HD24AMJ6YX3N7B3GPAZJ4` | **No** en plan vigente; `vis_*` junio Sala = `no_laborable` (HLg inactiva 01/06) — no es hueco de plan |

### 4.2 Validación UI (captura operador)

Calendario licencias · Sala · junio 2026:

- **2 filas** (LOKITO, MOSTO); sin CHAPARRO en equipo.
- Casillas 1–27 con color y lectura (verde jornada, gris F, rosa licencias MOSTO ~3–11).
- **Sin celdas blancas** en el tramo visible — coherente con remediación US-17 para este grupo/mes.

### 4.3 Estado US-17 (este piloto)

| Ítem | Estado documental |
| :--- | :--- |
| Replan junio Sala | **Hecho** (`plt_01KT9…`) |
| Verificación BD | **OK** |
| Verificación UI | **OK** (captura) |
| Inventario otros `gdt`/meses | **Pendiente** operativo |

---

## 5. Incidente original (contexto)

- **Síntoma:** celdas “blancas” con licencias existentes (MOSTO junio; días 11, 18, 19, 26).
- **Causa raíz datos:** plan habilitado con `tipo_dia: laborable` y `turno_id: null` + UI `tieneDatos` que ocultaba la celda.
- **No fue:** borrado de licencias por rematerializar; `eventos[]` se preservaron.

---

## 6. Épicas / historias (índice)

Ver tabla completa en [`CRITERIOS_ACEPTACION_GSO_CONFLICTOS_CAPAS_V2.md`](./CRITERIOS_ACEPTACION_GSO_CONFLICTOS_CAPAS_V2.md) §2.

Prioridad inmediata post-acta: **US-9**, **US-1**, **US-16**, **US-17** (remediación resto), **US-3**, **US-14**.

---

## 7. Documentos relacionados

| Documento | Uso |
| :--- | :--- |
| [`GSO_MATERIALIZACION_AL_ABRIR_EQUIPO_OPERACIONES_V2.md`](./GSO_MATERIALIZACION_AL_ABRIR_EQUIPO_OPERACIONES_V2.md) | Efecto observador `listarVistaGrillaMesPorGrupo` |
| [`RFC_GRILLA_APROBADA_PLAN_TURNO_V2.md`](./RFC_GRILLA_APROBADA_PLAN_TURNO_V2.md) | VER plan vs operativo |
| [`PLAN_GRILLA_MULTI_HLG_V2.md`](./PLAN_GRILLA_MULTI_HLG_V2.md) | CHAPARRO / bounded context |
| [`MANUAL_CAPAS_ORQUESTACION_BORRADOR.md`](./MANUAL_CAPAS_ORQUESTACION_BORRADOR.md) | Capas 1 / 3 |

---

**Fin del handoff**
