# Handoff — Pausa sesión 2026-06-19 · Grilla reactiva + supersession

> **RETOMAR AQUÍ:** QA piloto Sala Internación 1 · jun-2026 tras reset overrides; validar ciclo aplicar cambio (overlay + parche); intercambio Q4; cadena traslados N/M.  
> **Tope movimientos (solo doc):** [`RFC_BORRADOR_TOPE_MOVIMIENTOS_GESTION_TURNO_V2.md`](./RFC_BORRADOR_TOPE_MOVIMIENTOS_GESTION_TURNO_V2.md)

---

## Contexto piloto

- **GDT:** `gdt_01KQA6QCA8TDQK9YBTHKYA4R2V` (Sala Internación 1)  
- **Período:** 2026-06  
- **Plan:** [`PLAN_REACTIVIDAD_GRILLA_NODOS_V2.md`](./PLAN_REACTIVIDAD_GRILLA_NODOS_V2.md)

---

## Hecho en sesión (código + deploy)

| Tema | Detalle |
|------|---------|
| **Ciclo UI batch inmediato** | `grillaCicloAplicarCambioInmediato.js`: INICIO → SERVIDOR → PARCHE_CRITICO → `finally` FIN_BLOQUEO → POST (sanación background). |
| **Parches vis** | `resolverParchesVisTrasBatchExito`: prioriza `dias_actualizados`; fetch con timeout; merge batch gana. |
| **Supersession ida/vuelta** | Piernas opuestas mismo segmento (origen vs destino). |
| **Cadena N → franco → M** | `piernasOpuestasTrasladoMismoDia` + materialización: no forzar franco si hay destino v2 activo. |
| **Intercambio Q4** | Régimen por fecha (`grillaRegimenHorarioPorFecha.js`); `grupoTrabajoId` en modal cobertura. |
| **Deploy** | Functions + hosting → https://portal-hospital-v2.web.app |

### Archivos clave

- Web: `GrillaMesLicenciasPanel.jsx`, `useGrillaMesNodos.js`, `grillaMesNodosBatchParches.js`, `GrillaProcesandoCambioOverlay.jsx`
- Functions: `overridesTurnoSupersession.js`, `rdaTurnoTeoricoWorker.js`, `cambiosTurno.js`
- Tests: `overridesTurnoSupersession.test.js`, `reemplazoTrasladoMaterializacion.test.js`, `grillaMesNodosBatchParches.test.js`

---

## Incidente CAMPOS día 10 (historial vs teoría franco)

Tres lotes en el mismo `asi_*` del 10/06: incorporar N, trasladar N al 09 (origen franco), incorporar M. El tercero quedó en historial pero la celda seguía **franco** porque el override **origen franco (N)** no se revocaba al incorporar **M** (segmentos distintos). Corregido en supersession + materialización (ver arriba).

---

## Ops — reset overrides mes (fin de sesión)

Ejecutado **2026-06-19**:

```bash
ALLOW_FIRESTORE_SEED_V2=true node scripts/sanear-invalidar-overrides-grilla-gdt-mes.mjs \
  --gdt=gdt_01KQA6QCA8TDQK9YBTHKYA4R2V --periodo=2026-06 --apply
```

| Resultado | Valor |
|-----------|--------|
| Overrides invalidados | 31 (28 reemplazo, 3 cobertura_parcial) |
| `asi_*` tocados | 19 |
| `materializarGrupoMes` | ok, 146 celdas, ~97 s |

La grilla del mes queda según **plan/HLG** sin gestión de turno manual activa.

---

## Pendiente próxima sesión

1. QA Q1–Q4 desde grilla limpia (tras reset).  
2. Confirmar overlay no bloquea y teoría coincide con batch.  
3. Decidir si implementar **tope movimientos** (RFC borrador).  
4. Commit local en `master` (esta sesión); push si el equipo lo requiere.

---

## Changelog

| Fecha | Nota |
|-------|------|
| 2026-06-19 | Cierre pausa: ciclo UI, supersession, reset jun-2026, RFC tope movimientos. |
