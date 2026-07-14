# Handoff — sesión 2026-07-14 Soft Launch UX + rules CAMBIO-DIA + calendario consulta

**Estado:** oleada documentada · **supersedido como “punto de retoma” por** [`HANDOFF_SESION_2026-07-14_CIERRE_DEPLOY_ETAPA1.md`](./HANDOFF_SESION_2026-07-14_CIERRE_DEPLOY_ETAPA1.md) (deploy hosting + functions + git sync ya hechos)  
**Baseline previa:** Soft Launch pausa `f5c8b5e` ([handoff 2026-07-08](./HANDOFF_SESION_2026-07-08_SOFT_LAUNCH_ETAPA1.md))  
**Commit oleada:** `6dee722`  
**Prod Firebase:** `portal-hospital-v2` · Hosting https://portal-hospital-v2.web.app  
**Chat:** continuación Soft Launch Etapa 1 (Mis solicitudes, CAMBIO-DIA, calendario usuario)

Relacionados: [`CHECKLIST_UAT_ETAPA1_V2.md`](./CHECKLIST_UAT_ETAPA1_V2.md) · [`CONTRATO_CONFIG_ARTICULO_CAMBIO_DIA_V2.md`](./CONTRATO_CONFIG_ARTICULO_CAMBIO_DIA_V2.md) · [`MODULO_CALENDARIO_INSTITUCIONAL.md`](./MODULO_CALENDARIO_INSTITUCIONAL.md)

---

## 1. Resumen ejecutivo

| Tema | Resultado |
|------|-----------|
| Mis solicitudes | Buckets Pendiente / Autorizada / Rechazada; histórico 3 meses AR; paginación 10; labels legibles |
| Acuse de rechazo | Gate bloqueante post-login + Callables + campos `agente_acuse_rechazo_*` en `sol_*` |
| Hub Etapa 1 | Tiles LAO / Aviso médico solo si flags `cfg_etapa1/runtime` |
| Patrón B / 63-J / 64-A UX | 1 día → “Fecha de ausencia”; 63-J fallecimiento; preview sin cupo/bolsa; conflicto fechas enriquecido |
| CAMBIO-DIA UX | ±10 días exactos; grupo desde `grupos_trabajo_vigentes`; un solo botón Enviar + TC obligatorio |
| Bug permissions CAMBIO-DIA | Causa: rules >1000 exprs · **fix desplegado en prod** (`firestore:rules`) |
| Calendario institucional (usuario) | Menú Rol usuario · solo lectura · 5 botones mes (hoy−2…hoy+2) |

---

## 2. Despliegues hechos en esta sesión

| Pieza | Estado |
|-------|--------|
| `firebase deploy --only firestore:rules` (`portal-hospital-v2`) | **Hecho** (2026-07-14) — create CAMBIO-DIA deja de fallar por límite 1000 exprs |
| Callables acuse (`registrarAcuseRechazoAgente`, `obtenerContextoAcuseRechazoAgente`) | **Desplegados** prod (2026-07-14) |
| Hosting (`npm run build:web` + `firebase deploy --only hosting`) | **Desplegado** → https://portal-hospital-v2.web.app |

---

## 3. Detalle por entrega

### 3.1 Mis solicitudes + acuse de rechazo

- Helpers: `web/src/features/solicitudes/misSolicitudesUi.js` (+ tests)
- UI: `MisSolicitudCard.jsx`, panel filtro/paginación, `useMisSolicitudesTitular.js`
- Cancelada → bucket Rechazadas (chip slate)
- Campos Firestore vía Callable (rules `update: false` en `solicitudes_articulo`):
  - `agente_acuse_rechazo_persona_id`
  - `agente_acuse_rechazo_en`
- Core: `functions/modules/shared/solicitudAcuseRechazoAgenteCore.js` (+ tests)
- Callables: `registrarAcuseRechazoAgente`, `obtenerContextoAcuseRechazoAgente`
- Gate: `RechazoAcuseGate.jsx` + `RechazoAcuseModal.jsx` en `PortalLayout.jsx` (cola + `key={sol.id}`)

### 3.2 Hub Etapa 1

- `TicketeraHub.jsx`: tiles LAO / Aviso médico condicionados a `lao_habilitada` / `licencias_medicas_habilitadas` (hoy `false` en runtime Soft Launch)

### 3.3 Patrón B UX (64-A / 63-J)

- Labels fecha 1 día / fallecimiento (`SolicitudPatronBForm.jsx`)
- Preview limpio (`PatronBPreviewInfo.jsx`)
- Conflictos fechas con trámite/estado (`patronBSuperposicionValidacion.js` + tests)

### 3.4 CAMBIO-DIA UX

- Destino: **exactamente** ausencia ± 10 días corridos (sin piso preaviso en calendario destino) — `cambioDiaUi.js` + server `cambioDiaSolicitudCore.js`
- Grupo: API `grupos_trabajo_vigentes` / `grupo_de_trabajo_id` + `etiqueta_ui`
- Flujo: un botón **Enviar** (valida entorno + preview + `setDoc` + espera motor)
- TC obligatorio para habilitar envío

### 3.5 Fix rules — `Missing or insufficient permissions`

- **Causa real:** al crear borrador CAMBIO-DIA, `solicitudArticuloCreateShape()` evaluaba Lao ∥ PatronB(×3 fieldsValid) ∥ C ∥ MedAviso y superaba **1000 expresiones** Firebase. El cliente muestra permission-denied genérico.
- **Fix:** discriminadores `patron_saldo` / `schema_version` primero; una sola pasada `fieldsValid` + ramas por `es_cambio_dia` / causal larga.
- Tests: `tests/firestore-rules.mjs` (create CAMBIO-DIA OK)
- **Prod:** rules liberadas en Cloud Firestore

### 3.6 Calendario institucional — consulta agente

- Menú **Rol usuario** → `Calendario institucional` · path `/portal/calendario-institucional`
- Solo lectura (sin modal ABM); RRHH sigue en `/portal/rrhh/calendario-institucional`
- Navegación: 5 botones mes relativos a hoy BA (`[-2,-1,0,1,2]`)
- Archivos:
  - `web/src/pages/CalendarioInstitucionalConsulta.jsx`
  - `web/src/features/calendario/calendarioMesUi.js` (+ test)
  - `web/src/features/calendario/CalendarioMesGrilla.jsx`
  - Wire: `modulosEstado.js`, `App.jsx`, `BottomNavigationBar.jsx`, `pantallasCatalogo.js`
  - `subscribeEventos…` acepta `onError` opcional

---

## 4. Estado git (al cierre)

- Rama alineada a `master` @ `f5c8b5e` + **muchos cambios locales sin commit**
- Incluye modified + untracked de Mis solicitudes / acuse / CAMBIO-DIA / rules tests / calendario
- Scripts `scripts/_tmp-*` untracked → **no** commitear (temporales de inspección)
- **No** hubo `git commit` ni push en esta sesión (salvo consignas explícitas futuras)

---

## 5. Backlog próxima sesión

1. **Commit** agrupado de esta oleada UI + rules tests + callables acuse (sin `_tmp-*`).
2. **`npm run build:web`** + `firebase deploy --only hosting --project portal-hospital-v2`.
3. Confirmar / redeploy Functions acuse si prod no las tiene:
   ```powershell
   npm run firebase:deploy:functions -- --only "functions:registrarAcuseRechazoAgente,functions:obtenerContextoAcuseRechazoAgente"
   ```
4. **UAT Soft Launch vivo** (checklist 2026-07-08): 64-A + CAMBIO-DIA → jefe → B-BATCH; re-probar envío CAMBIO-DIA tras fix rules.
5. Altas RRHH restantes / elegibilidad celda RDA / Go-No-Go oleada (mismo backlog handoff 07-08).

---

## 6. Cómo retomar

```powershell
cd C:\Users\jorge\Desktop\portal-hospital-v2
git status
# revisar working tree; commit cuando se pida
npm run build:web
firebase deploy --only hosting --project portal-hospital-v2
```

Smoke rápido:

1. Login agente Soft Launch → gate acuse si hay rechazos sin acusar.
2. Hub sin tiles LAO/LM (flags off).
3. CAMBIO-DIA → Enviar con TC → debe crear `sol_*` (rules OK).
4. Rol usuario → Calendario institucional → 5 meses, sin edición.
5. RRHH → Calendario (ABM) intacto.

---

## 7. IDs operativos (sin cambio)

| Recurso | ID |
|---------|-----|
| Artículo CAMBIO-DIA | `art_01KX0Z07N5PFY7ZG0ZZP93EJ8H` |
| Versión | `ver_01KX0Z07N70GZKBKF1P27C78SY` |
| GDT piloto | `gdt_01KX107ZZTPKF12A1ED2XVKNMM` |

---

**Cierre formal sesión 2026-07-14** — retomar: commit + hosting + UAT CAMBIO-DIA / Soft Launch.
