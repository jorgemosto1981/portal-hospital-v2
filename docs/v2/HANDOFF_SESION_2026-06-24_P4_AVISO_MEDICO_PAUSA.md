# Handoff de sesión — 24 de junio de 2026 (pausa P4 — aviso médico Caja Negra)

**Proyecto:** `portal-hospital-v2`  
**Rama:** `feat/1919-p4-licencias-medicas`  
**Firebase:** `portal-hospital-v2` · functions `southamerica-east1`  
**RFC:** [`RFC_TICKETERA_SLICE_MEDICO_CAJA_NEGRA_V2.md`](./RFC_TICKETERA_SLICE_MEDICO_CAJA_NEGRA_V2.md) (G1–G3, incompleta §0.2, plazos §2.4)  
**Plan:** [`PLAN_P4_LICENCIAS_MEDICAS_ART_11_14_V2.md`](./PLAN_P4_LICENCIAS_MEDICAS_ART_11_14_V2.md)

---

## 1. Punto exacto de continuación (retomar aquí)

**Estado al pausar:** código local **completo hasta modal “Completar solicitud existente”** + validaciones de período exclusivo + ampliación de contrato Zod/Rules/UI de aviso (contacto, clínica, familiar, fin de reposo). **No desplegado** en Firebase respecto de este paquete (último deploy remoto conocido en piloto: commit `d669b32` — Fase 2b incompleta sin modal ni `resumen` en `buscar`).

### Próximos pasos en orden sugerido

| # | Prioridad | Tarea |
|---|-----------|--------|
| 1 | **ALTA** | `git pull` en otra PC → rama `feat/1919-p4-licencias-medicas` (commit de pausa de esta sesión) |
| 2 | **ALTA** | Deploy: `firebase deploy --only functions,firestore:rules,hosting` (o subset acordado) — **functions obligatorio** por `buscarAvisoIncompletaVigente` con `resumen` y `validarPeriodoAvisoMedicoExclusivo` |
| 3 | **ALTA** | Smoke UAT agente: aviso provisorio → banner + botón → **modal** con fecha desde, vencimiento, familiar + link `#ddjj-grupo-familiar`, completar con certificado |
| 4 | **MEDIA** | Verificar piloto existente `sol_01KW22PV533H3YN00FEKGQZRW0` (24 h) contra UI nueva |
| 5 | **MEDIA** | Roadmap acordado: **`clasificarSolicitudMedicaAuditor`** antes que job §5.7 vencimiento automático |
| 6 | **BAJA** | Opcional: persistir `declaracion_contacto` en `actualizarAvisoMedicoIncompleto` (hoy el modal valida contacto en cliente pero el callable solo persiste fechas, clínica y adjuntos) |
| 7 | **BAJA** | Auto-abrir modal al detectar incompleta (hoy solo botón en banner) |

### Lo que NO hacer al retomar

- No crear un segundo aviso provisorio mientras `buscarAvisoIncompletaVigente` devuelva vigente (UI bloquea alta; mantener).
- No desplegar solo hosting sin functions si se prueba completar aviso (resumen y exclusividad viven en callables).
- No mezclar con oleada P2 (`feat/1919-p2-oleada-63`) salvo merge explícito acordado.

---

## 2. Resumen de la sesión (épica 1919 / P4)

### Ya en remoto antes de este commit de pausa

| Hito | Commit / notas |
|------|----------------|
| Fase 2b licencia incompleta | `d669b32` — `actualizarAvisoMedicoIncompleto`, `buscarAvisoIncompletaVigente`, plazo G3, toggle provisorio, rules |
| Seeds / parámetros LM | `66a5ae4`, docs G1–G4 |
| Wizard aviso P4.3 | `84de6da` |

### Implementado en working tree (esta pausa)

| Área | Contenido |
|------|-----------|
| **UI completar** | `CompletarAvisoMedicoModal.jsx` — modal con plazo, fecha desde, familiar, campos completos + certificado |
| **UX lista** | `AvisoMedicoForm` — banner + botón; alta nueva oculta si hay incompleta vigente |
| **Hook** | `useAvisoMedicoAlta` — `enviarCompletar`, estado modal, hidratar desde `resumen`, fechas sin clamp retroactivo en completar |
| **Callable buscar** | `avisoMedicoCajaNegraCore.buscarAvisoIncompletaVigente` → `resumen` (inicio, vencimiento ISO, tipo, familiar, contacto) |
| **Exclusividad días** | `validarPeriodoAvisoMedicoExclusivo` + `avisoMedicoExclusividadValidacion.js` + `shared/utils/avisoMedicoExclusividadPeriodoCore.js` |
| **Contrato create** | Zod: `declaracion_contacto` (email), `declaracion_clinica`, `familiar_atendido`, fin reposo; rules Firestore |
| **DDJJ / contacto** | `avisoMedicoDdjj.js`, `formatDomicilioPersona.js` — familiar desde DDJJ; contacto perfil u otros |
| **Perfil** | Ancla `id="ddjj-grupo-familiar"` en Mi perfil para link directo desde modal |
| **Tests** | `solicitudArticulo.schema.test.js`, `medAviso.test.js` — **8 tests OK** (vitest) |

### Piloto / datos

- Persona piloto habitual: DNI **28914247** (MOSTO).
- Aviso provisorio de referencia (smoke anterior): `sol_01KW22PV533H3YN00FEKGQZRW0` (plazo 24 h según parámetro G3).

---

## 3. Inventario de archivos tocados (commit de pausa)

### Web

- `web/src/features/solicitudes/CompletarAvisoMedicoModal.jsx` **(nuevo)**
- `web/src/features/solicitudes/AvisoMedicoForm.jsx`
- `web/src/features/solicitudes/useAvisoMedicoAlta.js`
- `web/src/features/solicitudes/avisoMedicoDdjj.js` **(nuevo)**
- `web/src/features/solicitudes/formatDomicilioPersona.js` **(nuevo)**
- `web/src/pages/AvisoMedicoPage.jsx`
- `web/src/pages/PerfilUsuario.jsx`
- `web/src/schemas/solicitudArticulo.schema.js` (+ tests)
- `web/src/services/callables.js`, `solicitudesArticuloV2Service.js` (+ medAviso test)

### Functions / shared

- `functions/modules/shared/avisoMedicoCajaNegraCore.js`
- `functions/modules/shared/avisoMedicoExclusividadValidacion.js` **(nuevo)**
- `functions/modules/shared/avisoMedicoExclusividadPeriodoCore.js` **(nuevo)**
- `functions/onCall/solicitudes/actualizarAvisoMedicoIncompleto.js`
- `functions/onCall/solicitudes/validarPeriodoAvisoMedicoExclusivo.js` **(nuevo)**
- `functions/index.js`
- `shared/utils/avisoMedicoExclusividadPeriodoCore.js` **(nuevo)**
- `scripts/sync-shared-to-functions.mjs`

### Rules / tests

- `firebase-v2/firestore.rules`
- `tests/firestore-rules.mjs`

### Otros en el mismo commit (revisar si son de otra línea de trabajo)

- `docs/v2/RFC_TOPE_MOVIMIENTOS_WORKSHOP_RRHH_V2.md`
- `functions/modules/shared/calendarInstitucionalCore.js`
- `functions/modules/shared/opcionesConsumoSolicitud.js`
- `functions/modules/shared/validarFechasArticulo.js`

---

## 4. Comandos útiles al retomar

```bash
cd portal-hospital-v2
git fetch origin
git checkout feat/1919-p4-licencias-medicas
git pull origin feat/1919-p4-licencias-medicas

cd web
npm run test -- --run src/schemas/solicitudArticulo.schema.test.js src/services/solicitudesArticuloV2Service.medAviso.test.js

# Deploy (ajustar según política del día)
cd ..
npm run build:web
firebase deploy --only functions,firestore:rules,hosting
```

Ruta UI: `/portal/solicitudes/aviso-medico`

Callables relevantes: `buscarAvisoIncompletaVigente`, `actualizarAvisoMedicoIncompleto`, `validarPeriodoAvisoMedicoExclusivo`

---

## 5. Plan maestro P4 (recordatorio)

| Fase | Estado al pausar |
|------|------------------|
| P4.0 RFC / contrato | Avanzado (Caja Negra + incompleta documentada) |
| P4.1 Motor tramos | Core en repo (TDD) — integración auditoría pendiente |
| P4.2 Workflow junta | Pendiente |
| P4.3 Ticketera agente | **En curso** — aviso completo + incompleta + modal completar |
| P4.4 UAT formal | Pendiente post-deploy smoke |

---

## 6. Sesión Cursor / agente

- Transcript de referencia: proyecto `empty-window`, chat P4 aviso médico (modal completar).
- **Continuar leyendo:** este archivo §1 tabla “Próximos pasos”.
- TODOs globales oleada 63 / deploy hosting `8033605` son **rama P2**, no bloquean P4 salvo conflicto de merge.

---

*Documento generado al pausar implementación — 24-jun-2026.*
