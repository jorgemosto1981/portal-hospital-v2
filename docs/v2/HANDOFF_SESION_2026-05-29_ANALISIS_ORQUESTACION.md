# Handoff — Análisis orquestación HLG → grilla (29 may 2026, noche)

**Proyecto:** `portal-hospital-v2`  
**Rama habitual:** `feat/epic-multi-hlg-fase1-execution` (verificar con `git branch`)  
**Punto de reentrada mañana:** §20 del plan (licencias largas + horizonte 45d + gate `depende_rda`)

---

## 1. Qué se hizo en esta sesión (solo análisis + plan)

- Se amplió el plan Cursor **§17–22**: orquestación día 5, ventana 45d, purge HLg, cierre D1/D5, licencias LAO, tabla evento→acción.
- Se creó [`MANUAL_CAPAS_ORQUESTACION_BORRADOR.md`](MANUAL_CAPAS_ORQUESTACION_BORRADOR.md) (resumen 1 página para RRHH/dev).
- **Sin nuevos commits de código** en esta ronda (sesión de planificación); código previo: `visSnapshotDegenerado` en functions ya desplegado.

**SSoT análisis completo:** `.cursor/plans/análisis_flujo_hlg-grilla_55e1f7c3.plan.md` (fuera del repo git; copiar a otra PC vía sync Cursor o clonar desde commit de `docs/v2/*`).

---

## 2. Decisiones / ideas registradas (pendiente validación)

### Ventana automática fijo/rotativo

- Alta HLg: mes actual + siguiente (ya en código).
- **Día 5:** M+1 siempre; mes en curso solo si cambió la base.
- Alinear con **45 días** hacia adelante (propuesta unificar materialización y `fecha_desde` máxima de solicitudes).

### Cierre HLg

- Desde `fecha_fin + 1`: **purge explícito** slice `gdt` en `asi`/`vis` (rematerializar solo no alcanza).
- Nueva HLg: materializar burbuja nueva + purge vieja forward.

### Licencias largas (LAO 1 año)

- `fecha_hasta` sin tope; `fecha_desde` máx hoy+45 (propuesto).
- **No** materializar año automático; MDC pinta capa 3.
- **Problema:** `depende_rda` recorre todo el tramo → definir L-A / L-B / L-D mañana.

### Cierre período

- Día 1: usuario/jefe solo lectura M-1.
- Día 5: RRHH auto-cierre M-1 (`CFG_EPL_LIQUIDADO_CERRADO`).

---

## 3. Problemas piloto (referencia rápida)

| ID | Caso | Estado análisis |
|----|------|-----------------|
| D2/D3 | Portería mayo MOSTO — 31× NL | Lazy capa 1 mitiga; capa 2 `resolverFijo` pendiente |
| D7 | LOKITO feriado vs horario | UI capa 3 prioriza `rda_*` si existe |
| D11 | CHAPARRO plan NL vs operativo | Motor Opción A Plan > HLG |

---

## 4. Preguntas abiertas (orden sugerido mañana)

1. ¿`depende_rda` en LAO largo: solo `fecha_desde` (L-A) o por mes (L-B)?
2. ¿Implementar horizonte 45d en `validarFechasArticulo.js`?
3. ¿Congelar régimen/HLg al aprobar solicitud larga o rodante?
4. ¿Tabla evento→acción definitiva + manual RRHH?
5. ¿Orquestador día 5 manual RRHH primero vs job Cloud Scheduler?

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

## 7. Referencias código

- `functions/modules/shared/grillaMesAgenteCore.js` — lazy / degenerado
- `functions/modules/asistencia/rdaTurnoTeoricoWorker.js` — materialización
- `functions/modules/catalogosLaborales.js` — post-alta HLg
- `functions/modules/ticketera/grillaTurnoEntornoGate.js` — `depende_rda`
- `functions/modules/shared/validarFechasArticulo.js` — horizonte fechas
- `functions/modules/asistencia/asistenciaPeriodoLiquidacion.js` — cierre período
