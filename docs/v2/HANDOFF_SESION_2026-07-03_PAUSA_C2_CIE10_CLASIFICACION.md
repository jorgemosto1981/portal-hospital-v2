# Handoff — Pausa sesión 2026-07-03 · C2 CIE-10 clasificación bandeja auditor

> **RETOMAR AQUÍ:** UAT visual local (escenarios A/B) → merge `feat/1919-c2-cie10-clasificacion` → `master`.  
> **Rama:** `feat/1919-c2-cie10-clasificacion`  
> **Base:** `master` @ `84bc28c` (post-merge C1 + fix smoke `initDb`)  
> **Piloto:** https://portal-hospital-v2.web.app · proyecto `portal-hospital-v2`  
> **Brechas:** [`BRECHAS_FUNCIONALES_BANDEJA_AUDITOR_MEDICA_P4_V2.md`](./BRECHAS_FUNCIONALES_BANDEJA_AUDITOR_MEDICA_P4_V2.md)

---

## 1. Veredicto sesión — **PAUSA (dev + deploy callables OK; UAT visual pendiente)**

| Bloque | Estado | Nota |
|--------|--------|------|
| **C1 paginación** | ✅ en `master` | Tag `v1919-C1-bandeja-optimizada` |
| **C2 backend** | ✅ código + tests | `clasificarSolicitudMedicaAuditor` acepta `cie10` en payload |
| **C2 callable catálogo** | ✅ desplegado | `listarCie10BandejaAuditor` (evita `VAL-CFG-003` de listado temporal) |
| **C2 UI** | ✅ código local | `BandejaAuditorCie10Imputacion` + validación larga obligatoria |
| **Smoke C2** | ✅ PASS | `node scripts/smoke/med-c2-cie10-clasificacion.mjs` — 20 códigos `cfg_cie10` |
| **UAT visual A/B** | ☐ pendiente | Hard refresh en `npm run dev:web` — checklist §3 |
| **Hosting piloto UI** | ☐ pendiente | Solo callables desplegados; UI C2 aún no en `web.app` |

---

## 2. Incidente resuelto — `VAL-CFG-003`

**Síntoma:** bandeja auditor mostraba `[VAL-CFG-003] Colección no permitida en listado temporal` al cargar CIE-10.

**Causa:** `useCie10Catalogo` usaba `listarColeccionPublicaTemporal({ collectionName: "cfg_cie10" })`; en piloto el auditor médico no tiene canal RRHH y la whitelist desplegada no cubría el flujo.

**Solución:** callable dedicado `listarCie10BandejaAuditor` con `assertAuditorMedico` (mismo patrón que `listarArticulosLicenciaMedicaAuditor`).

---

## 3. Contrato implementado

### Payload clasificación

```json
{
  "solicitud_id": "sol_...",
  "cie10": { "codigo": "J06.9", "descripcion": "..." },
  "dictamen_favorable": true
}
```

### Reglas

| Artículo imputado | CIE-10 |
|-------------------|--------|
| Larga (Art. 16/19) | **Obligatorio** — `CIE10_REQUERIDO` en core; botón favorable deshabilitado en UI |
| Corta (Art. 14) | **Opcional** — se persiste si el auditor elige código |

### Persistencia Firestore

- `sol_*.cie10` — `{ codigo, descripcion, fecha_imputacion }`
- `auditor_medico_clasificacion.cie10` — mismo objeto en dictamen favorable

---

## 4. Archivos clave

| Capa | Ruta |
|------|------|
| Core catálogo | `functions/modules/shared/listarCie10BandejaAuditorCore.js` |
| Callable catálogo | `functions/onCall/solicitudes/listarCie10BandejaAuditor.js` |
| Core clasificar | `functions/modules/shared/clasificarSolicitudMedicaAuditorCore.js` |
| UI sección CIE-10 | `web/src/features/solicitudes/BandejaAuditorCie10Imputacion.jsx` |
| Hook catálogo | `web/src/features/solicitudes/useCie10Catalogo.js` |
| Página bandeja | `web/src/pages/BandejaAuditorSolicitudes.jsx` |
| Smoke | `scripts/smoke/med-c2-cie10-clasificacion.mjs` |

---

## 5. Deploy realizado (sesión)

```bash
firebase deploy --only functions:listarCie10BandejaAuditor,functions:clasificarSolicitudMedicaAuditor
```

**Resultado:** Successful create/update en `southamerica-east1`.

---

## 6. Tests

```bash
cd functions
node --test test/clasificarSolicitudMedicaAuditorCore.test.js test/listarCie10BandejaAuditorCore.test.js
```

**Esperado:** 9/9 PASS (8 clasificar + 1 catálogo CIE-10).

---

## 7. Checklist UAT visual — próxima sesión

**URL local:** `http://localhost:5177/portal/medico/solicitudes` (puerto puede variar)  
**Login:** usuario con claim auditor médico.

### Escenario A — Licencia larga (Art. 16)

| # | Paso | OK |
|---|------|-----|
| A1 | Selector → Art. 16 / larga episodio | ☐ |
| A2 | CIE-10 marcado obligatorio | ☐ |
| A3 | Sin código → favorable **deshabilitado** | ☐ |
| A4 | Buscar `J06` → opciones en select | ☐ |
| A5 | Elegir código → favorable habilitado | ☐ |
| A6 | Limpiar → vuelve a bloquear favorable | ☐ |

### Escenario B — Licencia corta (Art. 14)

| # | Paso | OK |
|---|------|-----|
| B1 | CIE-10 opcional; copy “puede continuar” | ☐ |
| B2 | Favorable sin CIE-10 permitido | ☐ |
| B3 | CIE-10 opcional persiste si se elige | ☐ |

### Post-UAT

1. `npm run build` en `web/` + `firebase deploy --only hosting` (UI C2 en piloto).
2. Re-ejecutar smoke C2.
3. Merge → `master` + tag opcional `v1919-C2-cie10-clasificacion`.

---

## 8. Backlog post-C2 (sin cambios de prioridad)

| Ítem | Estado |
|------|--------|
| **C3** Señales §5.8 | Pendiente |
| **C4** Modal historial completo | Pendiente |
| **P4.4** Largas (causal editable auditor) | Pendiente |

---

## Changelog handoff

| Fecha | Cambio |
|-------|--------|
| 2026-07-03 | Pausa C2 — dev + deploy callables; UAT visual pendiente |
