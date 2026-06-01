---
name: "Análisis integral: HLG → turnos → materialización → grilla operativa"
overview: "Mapa E2E de la cadena teórica: vínculo laboral (HLG), plan mensual (plt), materialización RDA (asi/vis), grilla operativa (GSO) y vistas VER del plan aprobado."
retomar_con: docs/v2/HANDOFF_SESION_2026-05-29_TURNO_MENSUAL_PR3_PAUSA.md
plan_epica: .cursor/plans/turno_mensual_jun-2026_371c6708.plan.md
---

# Análisis integral: HLG → turnos → materialización → grilla operativa

Documento maestro de **lectura y QA** (no sustituye el plan de implementación jun-2026). Última alineación: **29/05/2026** (post PR3 VER).

---

## 1. Cadena de datos (flujo)

```mermaid
flowchart TB
  subgraph config [Configuración]
    REG[cfg_regimen_horario]
    GDT[grupos_de_trabajo]
    CAL[calendario institucional]
  end

  subgraph laboral [Vínculo laboral]
    HLG[historial_laboral_grupo HLG]
    HLG -->|grupo_de_trabajo_id + regimen_horario_id + vigencia| REG
    HLG --> GDT
  end

  subgraph plan [Plan teórico mensual]
    PLT[planes_turno_servicio plt_*]
    PLT -->|agentes[].dias foto| FOTO[tipo_dia turno_id ingreso egreso feriado]
    PLT -->|al aprobar| GA[grilla_aprobada snapshot]
  end

  subgraph mat [Materialización]
    APR[aprobarPlanTurnoServicio]
    W[rdaTurnoTeoricoWorker]
    APR --> W
    W --> ASI[asistencia_diaria asi_*]
    W --> VIS[vistas_grilla_mes_agente vis_*]
    FOTO --> W
  end

  subgraph ui_ver [UI plan aprobado VER]
    VST[obtenerVistaPlanTurnoServicio]
    GA --> VST
    VST --> MOD[PlanGrillaVistaModal / Jefe detalle]
  end

  subgraph ui_gso [Grilla operativa GSO]
    VAG[obtenerVistaGrillaMesAgente]
    VGR[listarVistaGrillaMesPorGrupo]
    VIS --> VAG
    VIS --> VGR
    ASI --> VAG
  end

  HLG --> PLT
  REG --> PLT
  CAL --> PLT
```

---

## 2. Rol de cada eslabón

| Eslabón | Colección / artefacto | Qué define | Quién escribe |
|--------|------------------------|------------|---------------|
| **HLG** | `historial_laboral_grupo` | Persona en grupo, régimen, `fecha_inicio`/`fecha_fin`, ancla rotativo | RRHH |
| **Régimen** | `cfg_regimen_horario` | Patrón fijo / rotativo / **planificado**; `turnos_disponibles`; tolerancias | Config RRHH |
| **Plan borrador** | `plt_*` `agentes[].dias` | **Foto teórica** (intención jefe): solo `tipo_dia` + `turno_id` al guardar; enrich al persistir | Jefe |
| **Plan HABILITADO** | `grilla_aprobada` | Snapshot inmutable para VER / impresión | Aprobación RRHH |
| **Materialización** | `asi_*`, `vis_*` | Capa teórica día a día, `rda_*`, segmentos, `fichadas_esperadas` | Worker post-aprobación (+ triggers HLG fijo/rotativo) |
| **Overrides** | cambios turno / MDC | Desvío operativo del mes | Jefe / MDC (no toca `grilla_aprobada`) |

---

## 3. Dos capas (regla de oro)

```text
APROBADO (inmutable)              OPERATIVO (evoluciona en el mes)
────────────────────              ───────────────────────────────
plt_*.grilla_aprobada             asi_*.capa_teorica
plt_*.agentes[].dias (editor)     vis_*.dias (rda_ingreso/egreso, eventos)
      ↑ VER / imprimir                  ↑ /portal/grilla, equipo, RRHH GSO
```

- Divergencia **esperada** tras override o licencia: operativa ≠ snapshot del plan.
- Divergencia **bug** si VER del plan no coincide con `grilla_aprobada` guardada.

---

## 4. Tipos de régimen vs plan mensual

| `tipo_patron` | En editor mensual | En materialización |
|---------------|-------------------|---------------------|
| **planificado** | Jefe pinta grilla; foto en `dias` | Usa **foto** del plan (`aplicarFotoPlanDia`) |
| **fijo** | Solo lectura; horario desde régimen | Ciclo semanal + foto si hay excepción en plan |
| **rotativo** | Solo lectura; posición desde ancla HLG | Ciclo + ancla |

**Known issue (documentado):** agentes fijos sin `turno_id` en la foto → `grilla_aprobada` con horarios pero `segmentos: []` y `fichadas_esperadas: 0`. Resolver en Épica R2 (Biometría).

---

## 5. Callables y pantallas

### Plan (teórico aprobado)

| Callable | Uso |
|----------|-----|
| `guardarPlanTurnoServicio` | Borrador + enrich foto |
| `aprobarPlanTurnoServicio` | HABILITADO + materializar + `grilla_aprobada` |
| `obtenerVistaPlanTurnoServicio` | VER único (PR3: comentarios, personas, historial, `turno_etiquetas`) |

| Pantalla | Ruta / componente |
|----------|-------------------|
| Explorador VER | RRHH → Explorador → VER → `PlanGrillaVistaModal` |
| Detalle grilla | Explorador → Detalle → pestaña Grilla |
| Bandeja | RRHH bandeja → Ver turno (mismo modal) |
| Jefe | Planes turno → detalle HABILITADO |

### Grilla operativa (GSO)

| Callable | Uso |
|----------|-----|
| `obtenerVistaGrillaMesAgente` | Titular |
| `listarVistaGrillaMesPorGrupo` | Equipo jefe |
| `obtenerCapaTeoricaDia` | Detalle celda |

| Pantalla | Ruta |
|----------|------|
| Agente | `/portal/grilla` |
| Jefe equipo | menú grilla actual |
| RRHH GSO (pendiente PR4) | `/portal/rrhh/grilla-operativa` |

---

## 6. Matriz de control integral (10 ítems)

Piloto sugerido junio: `plt_01KSSPY2H5EZA925FQP4S1G2XW` · mayo: `plt_01KSR8J55H1TN10M3ANSSWMPF2` · grupo `gdt_01KQA6QCA8TDQK9YBTHKYA4R2V`.

| # | Capa | Estado 29/05 |
|---|------|----------------|
| 1–4 | Vistas VER plan | Validado prod (PR3) |
| 5–6 | GSO UI | Pendiente QA / PR4 menú RRHH |
| 7–8 | `asi_*` / `vis_*` | Pendiente matriz C + scripts |
| 9 | Inmutabilidad `grilla_aprobada` | Diseño OK; probar post-override |
| 10 | Gate `depende_rda` | Smoke Fase 5D |

---

## 7. Código de referencia

| Tema | Archivo |
|------|---------|
| Plan / aprobar / vista | `functions/modules/asistencia/planesTurnoServicio.js` |
| Snapshot grilla | `functions/modules/asistencia/planGrillaAprobadaBuilder.js`, `planEnriquecimientoDias.js` |
| Materialización | `functions/modules/asistencia/rdaTurnoTeoricoWorker.js` |
| Capa segmentos | `functions/modules/asistencia/capaTeoricaSegmentosCore.js` |
| Horario display AR | `shared/utils/horarioInstitucionalDisplay.js` |
| UI VER | `web/src/features/planes/` |
| UI GSO | `web/src/features/grilla/` |

---

## 8. Documentos relacionados

| Doc | Contenido |
|-----|-----------|
| [HANDOFF_SESION_2026-05-29_TURNO_MENSUAL_PR3_PAUSA.md](./HANDOFF_SESION_2026-05-29_TURNO_MENSUAL_PR3_PAUSA.md) | Pausa implementación; rama git |
| [HANDOFF_SESION_2026-05-28_TURNOS_GRILLA_APROBADA.md](./HANDOFF_SESION_2026-05-28_TURNOS_GRILLA_APROBADA.md) | Matriz detallada + scripts |
| [RFC_GRILLA_APROBADA_PLAN_TURNO_V2.md](./RFC_GRILLA_APROBADA_PLAN_TURNO_V2.md) | Contrato snapshot |
| [CAPA_TEORICA_SEGMENTOS_V2.md](./CAPA_TEORICA_SEGMENTOS_V2.md) | Segmentos y fichadas esperadas |
| [PENDIENTES_PROXIMA_SESION.md](./PENDIENTES_PROXIMA_SESION.md) | Índice retomar |

---

## 9. Próximo trabajo (orden)

1. Merge `feat/epic-turno-mensual-fase2-pr3` → `feat/epic-turnos-compuestos-v2`.
2. **PR4:** display `rda_*` en GSO + ruta RRHH grilla operativa.
3. Ejecutar matriz **7–10** con scripts y acta en handoff jun-2026.
