# Handoff — Análisis orquestación HLG → grilla (29 may 2026, noche)

**Proyecto:** `portal-hospital-v2`  
**Rama habitual:** `feat/epic-multi-hlg-fase1-execution` (verificar con `git branch`)  
**Punto de reentrada:** §20 del plan (licencias largas + gate `depende_rda`; horizonte pedidos = ventana **M + M+1**)

---

## 1. Qué se hizo en esta sesión (solo análisis + plan)

- Se amplió el plan Cursor **§17–22**: orquestación día 5, ventana 45d, purge HLg, cierre D1/D5, licencias LAO, tabla evento→acción.
- Se creó [`MANUAL_CAPAS_ORQUESTACION_BORRADOR.md`](MANUAL_CAPAS_ORQUESTACION_BORRADOR.md) (resumen 1 página para RRHH/dev).
- **Sin nuevos commits de código** en esta ronda (sesión de planificación); código previo: `visSnapshotDegenerado` en functions ya desplegado.

**SSoT análisis completo:** `.cursor/plans/análisis_flujo_hlg-grilla_55e1f7c3.plan.md` (fuera del repo git; copiar a otra PC vía sync Cursor o clonar desde commit de `docs/v2/*`).

---

## 2. Decisiones / ideas registradas

### Materializar (definición + producto) — **cerrado en repaso**

- **Materializar** = recalcular capa 1; no es purge ni cierre de período.
- **Cada vez que la app materializa** debe quedar **identificado e informado** al usuario/RRHH (disparador, alcance, resultado). Deuda: unificar toasts/auditoría en callables + lazy.

### Ventana automática fijo/rotativo — **cerrado en repaso**

- **Alta HLg:** mes actual + mes siguiente (ya en código).
- **Ventana rodante:** M + M+1. **Días 1–4:** altas/cambios HLg rematerializan M y M+1 (movimientos de personal). **Día 5 (fijo/rotativo):** materializar **M+1 solo si falta** (idempotente; no pisar lo hecho el 1–4). **M** el día 5 solo si cambió la base.
- **Licencias:** mismos plazos (fin mes siguiente).
- **Licencias:** límites de `fecha_desde` alineados a la **misma ventana M + M+1** (no propuesta 45d corridos, salvo nueva decisión RRHH).

### HLg, régimen y purge (repaso Bloque 4 — cerrado)

- **Régimen en HLg vigente:** bloqueado → cerrar o eliminar HLg + nueva HLg.
- **Cerrar HLg:** `fecha_fin` → purge capa 1 desde **día siguiente** inclusive; UX warning + doble aceptación.
- **Eliminar HLg:** purge desde **`fecha_inicio`** inclusive; misma limpieza teórica; no tocar licencias/overrides/fichadas.
- **Turnos mensuales:** warning si usuario nuevo en plan existente; reapertura **paralela** solo para nuevo(s); sin cambiar quienes ya estaban.

### Licencias largas (Bloque 5 — cerrado salvo excepción documentada)

- `fecha_desde`: fin mes siguiente (M+M+1). `fecha_hasta`: sin tope.
- Artículos por **calendario / hábiles / corridos**: permitir alta sin RDA en todo el tramo.
- **`depende_rda`:** bloqueo si falta RDA en anclajes; optimización: leer **`fecha_hasta`** (no toda la cadena) si el tramo es lejano.
- **Rodante LAO:** cambio HLg solo capa 1; LAO no se toca; reintegro con nuevo `gdt` + mat.
- **`vis` mínimo:** MDC crea con merge; mat posterior fusiona `rda_*` en el mismo `vis_*`.
- Cola sin materializar + caso RRHH excepcional: **regla diferida** §20.4 (no materializar año por defecto).

### Cierre período — **cerrado en repaso**

- Día 1: usuario/jefe solo lectura M-1 en GSO (UI + callables).
- **Primera entrega:** cierre **manual RRHH** (botón en GSO + callable `cerrarPeriodoLiquidacion`); extender gates a MDC y `rematerializar*`.
- **Diferido:** auto-cierre día 5 vía Cloud Scheduler hasta que el equipo asimile el impacto de bloquear rematerialización y MDC sobre M-1.
- **Mes cerrado + licencias:** las **en trámite** que impactan M-1 siguen hasta aprobar/rechazar; **no** nuevas solicitudes que escriban M-1.

---

## 3. Problemas piloto (referencia rápida)

| ID | Caso | Estado análisis |
|----|------|-----------------|
| D2/D3 | Portería mayo MOSTO — 31× NL | Lazy capa 1 mitiga; capa 2 `resolverFijo` pendiente |
| D7 | LOKITO feriado vs horario | UI capa 3 prioriza `rda_*` si existe |
| D11 | CHAPARRO plan NL vs operativo | Motor Opción A Plan > HLG |

---

## 4. Preguntas abiertas (orden sugerido mañana)

1. ~~`depende_rda`~~ → **Cerrado:** tramo completo con RDA o bloqueo; hábiles/corridos/calendario permitidos.
2. ~~Horizonte~~ → **Cerrado:** fin mes siguiente.
3. ~~Congelar régimen~~ → **Rodante** (LAO no se toca al cambiar HLg; §20.5).
4. ¿Tabla evento→acción definitiva + manual RRHH?
5. ~~Cierre día 5 auto~~ → **Manual RRHH primero** (botón GSO + callable); Scheduler **después**.

---

## 5. Todos del plan (estado)

| ID | Estado |
|----|--------|
| doc-ssot, modelo-capas-reglas | completed (borrador) |
| p0-capa2-regimen-remat, p1-contrato-ui, qa-porteria-mayo, impl-materializar-rango | pending |
| orquestador-dia5-45d, hlg-purge-cierre, licencias-largas-gate, manual-rrhh-capas | pending (nuevos) |
| continuar-manana | **START HERE** |

---

## 6. Comandos al retomar en otra PC

```powershell
cd c:\Users\jorge\Desktop\portal-hospital-v2
git pull
git branch
```

Abrir plan: `.cursor/plans/análisis_flujo_hlg-grilla_55e1f7c3.plan.md`  
Leer: `docs/v2/MANUAL_CAPAS_ORQUESTACION_BORRADOR.md`, `docs/v2/REGISTRO_DEUDA_2026-05-30_CAPA_TEORICA_Y_GRILLA.md`

---

## 7. Roadmap sucesivo

Plan maestro F0–F4 (objetivos, DoD, avance esperado): [`ROADMAP_IMPLEMENTACION_SUCESIVA_V2.md`](ROADMAP_IMPLEMENTACION_SUCESIVA_V2.md).

---

## 8. Contención P0 inmediata (evaluación técnica equipo)

Tres riesgos **no** llevar a prod sin mitigar (detalle en [`ANALISIS_COHERENCIA_ORQUESTACION_VS_CODIGO.md`](ANALISIS_COHERENCIA_ORQUESTACION_VS_CODIGO.md) §5):

1. **Purge HLg** (O-P0-4) — fantasma teórico post `fecha_fin`.
2. **N+1** — gate anclas (O-P0-1) + listado sector bulk (O-P0-7), no 60 lazy en serie.
3. **Observabilidad GSO** (O-P0-5) — toasts/badges si lazy/batch falla o `materializado_lazy`.

---

## 9. Decisiones cerradas — repaso orquestación (Bloques 1–6)

| Bloque | Cierre |
|--------|--------|
| 1 | Solo documentar pilotos; capas 0–4 + materializar definido |
| 2 | M+M+1; día 5 fijo/rot idempotente; informar cada materialización |
| 3 | Cierre período **manual RRHH** primero; día 1 solo lectura M-1 |
| 4 | Régimen en HLg vigente bloqueado; purge capa1; turnos mensuales usuario nuevo |
| 5 | `depende_rda` anclas; hábiles/corridos/calendario OK; rodante LAO; `vis` mínimo MDC |
| 6 | Tabla §21 — **cerrado:** licencia **en trámite** en M-1 sigue hasta aprobar/rechazar tras cierre RRHH; **nuevas** en M-1 no |

---

## 10. Referencias código

- `functions/modules/shared/grillaMesAgenteCore.js` — lazy / degenerado
- `functions/modules/asistencia/rdaTurnoTeoricoWorker.js` — materialización
- `functions/modules/catalogosLaborales.js` — post-alta HLg
- `functions/modules/ticketera/grillaTurnoEntornoGate.js` — `depende_rda`
- `functions/modules/shared/validarFechasArticulo.js` — horizonte fechas
- `functions/modules/asistencia/asistenciaPeriodoLiquidacion.js` — cierre período
