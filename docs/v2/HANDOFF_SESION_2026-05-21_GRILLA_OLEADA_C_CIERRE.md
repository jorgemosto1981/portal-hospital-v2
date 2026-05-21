# Handoff — Cierre épica Grilla licencias MDC (Oleada C) · 2026-05-21

**Rama:** `feature/ticketera-puente-campos-config`  
**Firebase:** `portal-hospital-v2` · `southamerica-east1`  
**Hosting prod:** https://portal-hospital-v2.web.app  
**Estado épica:** **CERRADA EN PROD** (C1 + C3 + C2c/d + C4)

> **Retomar en otra PC:** `git pull origin feature/ticketera-puente-campos-config` — commits `de176d8` (C2) + `f782ce2` (C4).

---

## 1. Qué se entregó (mapa rápido)

| Slice | Contenido | Commits (ref.) |
|-------|-----------|----------------|
| **C1** | Callable `obtenerVistaGrillaMesAgente` · pestaña calendario `vis_*` | `b938524` |
| **C3** | `obtenerResumenSolicitudArticuloGrilla` · modal día · `?sol_id=` bandejas · labels jefe/RRHH | `d692535` |
| **C2** | Callable `listarVistaGrillaMesPorGrupo` · fan-out HLg + `vis_*` por persona (máx. 60) | `de176d8` |
| **C2c** | `GrillaMesSelector`: TITULAR / EQUIPO / SECTOR (RRHH) · `resolverContextoLaboralSolicitud` · sin `gdt_*` hardcode | `de176d8` |
| **C2d** | Vista unificada `useGrillaMesVista` · un solo período al cambiar modo | `de176d8` |
| **C4** | `GrillaMesCeldaLicencia` tooltip · contraste `#3B82F6` / `#F59E0B` + borde pendiente · leyenda | `f782ce2` |

---

## 2. Deploy prod (verificado)

| Artefacto | Notas |
|-----------|--------|
| **Hosting** | Varias pasadas; bundle final C4: `index-OqGHvHMW.js` (rebuild antes de cada deploy). |
| **Functions** | `listarVistaGrillaMesPorGrupo` **creada** en prod (antes faltaba → `internal` en EQUIPO). Fix `getAll` Firestore en **chunks de 10** refs (`grillaMesAgenteCore.js`). |

### Smoke prod ✅

Ver [`OLEADA_C_SMOKE_HOSTING_2026-05-21_C2C_C2D.md`](./OLEADA_C_SMOKE_HOSTING_2026-05-21_C2C_C2D.md).

| # | Resultado |
|---|-----------|
| TITULAR · 2026-03 · día 21 `64-A` | ✅ |
| EQUIPO · Oficina PERSONAL · 4 personas · día 21 CHAPARRO | ✅ |
| Período persistente al cambiar vista | ✅ |
| Detalle C3 + bandeja | ✅ (sesión previa) |
| RRHH SECTOR | ⏳ opcional |
| C4 tooltip / leyenda | ✅ deploy `f782ce2` — validar hover en prod al retomar |

**Ruta UI:** `/portal/grilla` → pestaña **Calendario licencias (MDC)**.

---

## 3. Documentación (índice Oleada C)

| Doc | Rol |
|-----|-----|
| [`OLEADA_C_SLICE1_GSO_VISTA_MES.md`](./OLEADA_C_SLICE1_GSO_VISTA_MES.md) | Slice 1 + punteros C2/C4 |
| [`OLEADA_C_SLICE2_GSO_VISTA_GRUPO.md`](./OLEADA_C_SLICE2_GSO_VISTA_GRUPO.md) | Callable grupo + tabla |
| [`OLEADA_C2_HOJA_RUTA_GSO_EQUIPO.md`](./OLEADA_C2_HOJA_RUTA_GSO_EQUIPO.md) | Hoja de ruta producto C2 |
| [`OLEADA_C4_GSO_PULIDO_UX.md`](./OLEADA_C4_GSO_PULIDO_UX.md) | Cierre pulido UX |
| [`OLEADA_C_SMOKE_HOSTING_2026-05-21_C2C_C2D.md`](./OLEADA_C_SMOKE_HOSTING_2026-05-21_C2C_C2D.md) | Checklist smoke |
| [`TICKETERA_EVIDENCIA_2026-05-21_OLEADA_B_MDC_SOL_01KS57Y.md`](./TICKETERA_EVIDENCIA_2026-05-21_OLEADA_B_MDC_SOL_01KS57Y.md) | Datos MDC piloto `vis_*` / día 21 |

---

## 4. Archivos clave (otra PC)

**Web**

- `web/src/features/grilla/GrillaMesLicenciasPanel.jsx` — entrada unificada
- `web/src/features/grilla/useGrillaMesVista.js` — estado + cargar TITULAR/EQUIPO/SECTOR
- `web/src/features/grilla/GrillaMesSelector.jsx`
- `web/src/features/grilla/GrillaMesCeldaLicencia.jsx` — C4 tooltip
- `web/src/features/grilla/grillaMesCellUtils.js` — tokens MDC + estilos

**Functions**

- `functions/onCall/grilla/listarVistaGrillaMesPorGrupo.js`
- `functions/modules/shared/grillaMesAgenteCore.js` — `listarVistaGrillaMesPorGrupo` + chunk `getAll`

---

## 5. Contexto ticketera (sin reabrir grilla)

| Oleada | Estado |
|--------|--------|
| **A** autorización + TC | ✅ cerrada · `sol_01KS57Y…` |
| **B** MDC / `vis_*` | ✅ evidencia día 21 `64-A` |
| **C** GSO calendario licencias | ✅ **épica cerrada** (este handoff) |
| **F2 + paso 2 entorno** | ✅ cableado 21-may tarde · [`HANDOFF_SESION_2026-05-21_TICKETERA_PASO2_CIERRE.md`](./HANDOFF_SESION_2026-05-21_TICKETERA_PASO2_CIERRE.md) @ `72c8ae6` |

**No reabrir** Oleada C salvo regresión en prod. Mejoras futuras GSO (planificación rotativa, `vis_grupo_*`, export CSV) = **nueva épica**, no slice C.

---

## 6. Próxima sesión — sugerencias (prioridad)

1. **Otra PC:** `git pull` · `npm install` en `web/` y `functions/` si aplica · smoke 30 s C4 hover en EQUIPO.
2. **Ticketera / producto:** delegación jefe, 64-B masivo, LAO, o **read-model** pestaña «Vista laboral» en `/portal/grilla` (ya existía aparte del calendario MDC).
3. **Deuda opcional:** smoke RRHH **SECTOR** · script limpieza `eventos_bandeja_rrhh` históricos `modulo_origen: articulos` (§5.4 handoff bloque A).
4. **Alias callable:** `obtenerVistaGrillaEquipo` como alias de `listarVistaGrillaMesPorGrupo` (doc C2b, no urgente).

```text
PAUSA 2026-05-21 — Grilla licencias MDC lista para piloto operativo.
HEAD remoto ticketera: feature/ticketera-puente-campos-config @ 72c8ae6 (ver handoff paso 2).
```

---

*Sesión de altísimo rendimiento: de consulta manual a supervisión dinámica con MDC como fuente de verdad.*
