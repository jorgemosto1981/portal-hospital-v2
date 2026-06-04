# Análisis aplicación vs criterios GSO (conflictos capas)

**Alcance:** código y comportamiento **as-built** frente a [`CRITERIOS_ACEPTACION_GSO_CONFLICTOS_CAPAS_V2.md`](./CRITERIOS_ACEPTACION_GSO_CONFLICTOS_CAPAS_V2.md) y acta [`HANDOFF_ACTA_GSO_RECONCILIACION_JUNIO_2026_SALA_V2.md`](./HANDOFF_ACTA_GSO_RECONCILIACION_JUNIO_2026_SALA_V2.md).  
**Método:** revisión estática (junio 2026). **Sin propuesta de diff** en este documento.  
**Backlog implementación (tickets US):** [`PENDIENTES_IMPLEMENTACION_V2.md`](./PENDIENTES_IMPLEMENTACION_V2.md) §2.  
**Nota:** Los datos del piloto junio Sala ya cumplen plan + `vis_*`; varias brechas son **defensas** para no repetir el incidente si vuelve un plan con huecos o la UI regresa a ocultar celdas.

---

## 1. Resumen ejecutivo

| Área | Alineado hoy | Brecha principal |
| :--- | :--- | :--- |
| **Backend plan** | Habilitar enriquece horarios; soft-delete `eliminado` | **US-9:** no rechaza `laborable`/`guardia` sin `turno_id` al habilitar |
| **Materialización** | `listarVistaGrillaMesPorGrupo` → `materializarGrupoMes`; licencias no pisadas en worker | Coherente con P6; riesgo si teoría cambia sin ⚠️ (US-3) |
| **GSO UI equipo/titular** | Licencias, turnos con horario, F, NL, feriados | **US-1/16:** hueco `laborable` sin `rda_*` y sin licencia → `tieneDatos=false` → celda vacía |
| **Reconciliación** | Modal día, overrides, cobertura | **US-3/4/14/15:** badges y acciones US-14 no completos |
| **Operaciones** | Toast materialización grupo en equipo | Parcial vs US-11; titular usa otro callable + lazy toast |

---

## 2. Matriz US ↔ as-built

| US | Prioridad | Criterio / acta | As-built (evidencia) | Gap |
| :--- | :--- | :--- | :--- | :--- |
| **US-1** | P0 | Anti-blanco; escenario T, C | `GrillaMesEquipoTabla.jsx`, `GrillaMesTitularCalendario.jsx`: `tieneDatos = licencia \| turno \| franco \| NL \| feriado` — **no** incluye `tipo_dia: laborable` sin `rda_*` | **Sí** — reproduce blanco si BD vuelve a hueco sin licencia |
| **US-16** | P0 | No operar blanco / INCOMPLETO | `disabled={!tieneDatos}` en celda; no distingue ERROR vs válido | **Sí** — mismo booleano; sin bloqueo explícito INCOMPLETO_PLAN |
| **US-9** | P0 | Error al habilitar con huecos | `planesTurnoServicio.js` `assertAgentesEnriquecidos`: valida horarios si hay `turno_id`, no exige `turno_id` en laborable | **Sí** — permitió planes rotos (piloto viejo) |
| **US-10** | P1 | Warning editor borrador | No verificado exhaustivamente en este análisis | **Probable** gap |
| **US-11** | P2 | Aviso al materializar | `useGrillaMesVista.js`: toast `materializacion_grupo` al listar equipo; `grillaMaterializacionToast.js` en titular por `materializado_lazy` | **Parcial** — equipo no usa mismo mensaje lazy por agente |
| **US-2** | P0 | Licencia sobre plan incompleto (B) | Con licencia, `tieneLicencia` → celda visible | **OK** si hay `codigo_grilla` |
| **US-3** | P1 | ⚠️ teoría/fichada post-licencia (A, Q9-4/5) | Sin badge en `GrillaMesCeldaLicencia` / tabla | **Sí** |
| **US-4** | P1 | 🔗 fan-out (E) | Parcial en etiquetas; sin ícono estándar acta | **Parcial** |
| **US-5** | P1 | 📅 post-purge HLg (F, Q3-2) | Copy no unificado en UI | **Sí** |
| **US-6** | P2 | ⏳ lazy (G) | Variante `vacio` en `varianteCeldaOperativa` | **Parcial** |
| **US-7** | P2 | ℹ️ licencia en franco (D) | Se ve F + licencia (rosa en captura piloto) | **Parcial** (hint opcional) |
| **US-8** | P1 | 🔒 mes cerrado (H) | `gso_solo_lectura`, acciones RRHH período | **Parcial** — revisar gates en modales turno |
| **US-13** | P1 | Matriz permisos teoría | Doc acta; código disperso (plan, override, HLg) | **Documental** |
| **US-14** | P1 | Acciones 1+2+3 ante ⚠️ | `DiaGrillaDetalleModal.jsx`: bandeja, enlaces gestión; sin flujo ⚠️ dedicado | **Sí** |
| **US-15** | P2 | Fichada por rol (Q9-3) | `grillaVisSanitizeGso.js` quita `fichadas_reales` a jefe; sin presente/ausente | **Sí** |
| **US-17** | P0 | Remediación planes | Operativo junio Sala **hecho** en BD/UI | Inventario global **pendiente** |

---

## 3. Análisis por capa

### 3.1 Renderizado celda (frontend)

**Archivos:** `web/src/features/grilla/GrillaMesEquipoTabla.jsx`, `GrillaMesTitularCalendario.jsx`, `grillaMesEquipoDisplay.js`, `grillaTurnosVisual.js`.

Flujo actual:

1. `textoHorarioTurno(cell)` devuelve `""` si `tipo_dia: laborable` pero sin `rda_ingreso`/`rda_egreso`/`rda_turno_id`.
2. `tieneTurno` exige texto distinto de F/NL.
3. `tieneDatos` no contempla “laborable incompleto”.
4. `varianteCeldaOperativa` → `"vacio"` → celda sin contenido útil; `disabled` impide clic.

**Vs acta:** viola §1.1 (blanco = error) y escenario **C** (debe rayarse *Laborable sin turno* y derivar a plan). Con datos **ya corregidos** (junio Sala), `rda_*` poblado → la UI **parece** sana (captura verde/gris/rosa).

### 3.2 Habilitación de plan (backend)

**Archivo:** `functions/modules/asistencia/planesTurnoServicio.js`.

- Transición a `HABILITADO` ejecuta validaciones de régimen, enriquecimiento, reglas de planificación (warnings).
- **No** hay error tipo `[PLT-???] laborable sin turno_id` antes de habilitar.

**Vs US-9 / P1:** cualquier mes futuro puede repetir el incidente si el editor guarda huecos y RRHH habilita.

### 3.3 Listado equipo y materialización

**Archivos:** `functions/modules/shared/grillaMesAgenteCore.js`, `functions/modules/asistencia/rdaTurnoTeoricoWorker.js`, `functions/onCall/grilla/listarVistaGrillaMesPorGrupo.js`.

- Cada `listarVistaGrillaMesPorGrupo` invoca `materializarGrupoMes`.
- Worker actualiza capa 1 en `vis_*` por paths; **no** elimina `eventos[]` (coherente con análisis incidente).

**Vs Q9-5 / US-3:** si la teoría cambia, hoy **no** hay ⚠️ automático; el usuario puede solo ver el toast de sincronización (US-11 parcial).

### 3.4 Overrides y política Q9-1 B

**Archivos:** `registrarCambioTurno`, `ModalCambioTurno`, `DiaGrillaDetalleModal.jsx`.

- Override sigue disponible desde GSO si `puedeGestionarTurno` y celda habilitada (`tieneDatos`).
- **No** hay guard que impida override en día que era hueco de plan (INCOMPLETO_PLAN).
- **No** hay CTA prioritario “Corregir plan en revisión” en celda incompleta.

**Vs acta:** Q9-1 B es **proceso**; la app **no refuerza** la política.

### 3.5 Fichadas (Q9-3, Q9-4)

- Modelo: `fichadas_reales` / `capa_realidad` en `vis_*` (tests en `grillaVisSanitizeGso.test.js`).
- Listado GSO filtra datos sensibles para jefe.
- **No** hay indicador “presente/ausente” para jefe ni regla UI ⚠️ por contradicción fichada/teoría.

### 3.6 Planes eliminados y slot mensual

- `eliminado: true` excluye plan del listado activo (`planesTurnoServicio.js`).
- Documentos viejos pueden quedar `estado: HABILITADO` + `eliminado: true` (junio: 2 históricos + 1 vigente) — **no bloquea** slot si filtro es correcto.

---

## 4. Por qué el piloto junio “se ve bien” con brechas abiertas

| Factor | Efecto |
| :--- | :--- |
| Plan `plt_01KT9…` sin huecos | `rda_*` materializado → `tieneDatos` true → colores en UI |
| Licencias en `eventos[]` | Escenario T salva días con solo licencia |
| CHAPARRO fuera del plan | No aparece en tabla equipo de 2 agentes |
| Remediación manual | No depende aún de US-9 automático |

**Conclusión:** la **validación UI** del piloto **no** cierra el DoD de producto (§7 criterios); cierra **US-17** para ese `gdt`+mes en operación.

---

## 5. Orden sugerido de implementación (referencia)

1. **US-9** backend — bloquear habilitar con huecos (previene recurrencia).
2. **US-1 + US-16** — estado `INCOMPLETO_PLAN` / anti-blanco; clic → derivar plan, sin override.
3. **US-10** — editor plan alerta al guardar.
4. **US-3 + US-14 + US-15** — reconciliación visible y acciones acta.
5. **US-17** — script/inventario planes `HABILITADO` + `eliminado:false` con conteo huecos.
6. **US-5, US-4, US-6, US-7, US-8** — pulido.

---

## 6. Pruebas de regresión recomendadas (QA)

| # | Caso | Esperado post-implementación |
| :--- | :--- | :--- |
| R1 | Plan borrador con laborable sin turno → habilitar | Rechazo US-9 |
| R2 | `vis_*` con laborable sin `rda_*`, sin eventos | Rayado C, no blanco; sin override |
| R3 | Solo `eventos` con 64-A, sin teoría | Licencia visible (T) |
| R4 | Abrir equipo tras cambio teoría con licencia | ⚠️ + US-11 toast |
| R5 | Junio Sala `plt_01KT9…` | 2 agentes, sin blanco (baseline captura) |

---

## 7. Referencias de código (ancla rápida)

| Tema | Ruta |
| :--- | :--- |
| `tieneDatos` | `web/src/features/grilla/GrillaMesEquipoTabla.jsx` (~245–290) |
| Variante vacío | `web/src/features/grilla/grillaTurnosVisual.js` (`varianteCeldaOperativa`) |
| Listado + mat grupo | `functions/modules/shared/grillaMesAgenteCore.js` (`listarVistaGrillaMesPorGrupo`) |
| Habilitar plan | `functions/modules/asistencia/planesTurnoServicio.js` |
| Toast equipo | `web/src/features/grilla/useGrillaMesVista.js` (~308–317) |
| Sanitize fichada | `functions/modules/shared/grillaVisSanitizeGso.js` |

---

**Fin del análisis**
