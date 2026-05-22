# Handoff — Wizard LAO F3a.1 (callable + paso 1 UI) · 2026-05-22

**Rama:** `feature/ticketera-puente-campos-config`  
**Firebase:** `portal-hospital-v2` · región `southamerica-east1`  
**Hosting prod:** https://portal-hospital-v2.web.app  
**Dev local:** `npm run dev:web` → http://localhost:5173/

> **Retomar en otra PC (obligatorio):**
> ```bash
> git fetch origin
> git checkout feature/ticketera-puente-campos-config
> git pull origin feature/ticketera-puente-campos-config
> ```
> **HEAD al cerrar sesión:** `dde2043` (tip remoto). LAO: `d1dc641` UX+docs, `f1a9305` wizard, `7e0b148` callable, `07f3ed3` calendario.

---

## 1. Qué se hizo en esta sesión (cronología)

| Orden | Entrega | Commits / deploy |
|-------|---------|------------------|
| 1 | Calendario institucional + `readModoCalculo` + validación fechas Patrón B | `07f3ed3` |
| 2 | RFC wizard LAO definitivo + callable `obtenerContextoBolsaLaoAgente` + tests core | `7e0b148` · Functions deploy |
| 3 | FE: `useLaoContext`, hub → wizard, paso 1 shell, `callObtenerContextoBolsaLaoAgente` | `f1a9305` · push |
| 4 | Fix RRHH: `persona_id` en payload + fallback token en callable | Functions redeploy |
| 5 | UX paso 1: botón **Iniciar solicitud** arriba; bloque **Disponibles:** multilínea; sin selector bolsa; año civil en curso → `Disponibles = proporcional` | commit cierre sesión + Hosting deploy |

**Push remoto:** rama sincronizada para trabajar desde otra máquina.

---

## 2. Estado F3a (RFC)

| Subfase | Estado | Notas |
|---------|--------|-------|
| **F3a.0** | **Hecho** | [`RFC_TICKETERA_LAO_WIZARD_V2.md`](./RFC_TICKETERA_LAO_WIZARD_V2.md) |
| **F3a.1** | **Parcial — paso 1 hecho** | Callable + UI disponibilidad; **paso 2 fechas pendiente** |
| **F3a.2** | Pendiente | `simularLaoPreview` + `fecha_hasta` + `resumen_computo` |
| **F3a.3** | Pendiente | DatePicker hábil + polish paso 3 |

---

## 3. Rutas y UX actual (agente)

| Ruta | Componente |
|------|------------|
| `/portal/solicitudes` | Hub — tile LAO → wizard con `?fecha=YYYY-MM-DD&articulo_id=art_*` |
| `/portal/solicitudes/lao` | `LaoWizardTicketera.jsx` — 4 pasos UI; **solo paso 1 operativo** |
| `/portal/solicitudes/lao-formulario` | `SolicitudLaoAlta.jsx` — formulario legado (preview motor antiguo) |

**Paso 1 (prod):**

1. Botón primario **Iniciar solicitud** (debajo del stepper).
2. Bloque secundario **Disponibles:** — una entrada por bolsa en `bolsas_resumen`:
   - `Año LAO = {anio_origen}`
   - `- Total = {cantidad_inicial} Días`
   - `- Disponibles = {disponible}` **o** `proporcional` si `anio_origen` = año calendario de `fecha` query (ej. 2026).
3. **Sin** selector “consumir bolsa” — consumo **FIFO** vía backend (`anio_origen_bolsa_sugerido`).
4. **Iniciar solicitud** habilitado si: callable ok, no viola FIFO, y (bolsa FIFO con `disponible > 0` **o** bolsa del año calendario en curso).

---

## 4. Archivos clave

| Capa | Archivo |
|------|---------|
| Callable | `functions/onCall/solicitudes/obtenerContextoBolsaLaoAgente.js` |
| Core | `functions/modules/shared/obtenerContextoBolsaLaoCore.js` |
| Test | `functions/test/obtenerContextoBolsaLaoCore.test.js` |
| Hook FE | `web/src/features/lao/useLaoContext.js` |
| UI paso 1 | `web/src/features/lao/LaoDisponibilidadPaso.jsx` |
| Wizard | `web/src/pages/LaoWizardTicketera.jsx` |
| Hub | `web/src/pages/TicketeraHub.jsx` |
| Callables web | `web/src/services/callables.js` → `callObtenerContextoBolsaLaoAgente` |
| Calendario (transversal) | `shared/utils/validarFechasArticulo.js`, `modoComputoCalendario.js`, [`MODULO_CALENDARIO_INSTITUCIONAL.md`](./MODULO_CALENDARIO_INSTITUCIONAL.md) |

**Tests backend:** `node --test functions/test/obtenerContextoBolsaLaoCore.test.js`

---

## 5. Callables LAO (contrato rápido)

| Callable | Uso wizard |
|----------|------------|
| `obtenerContextoBolsaLaoAgente` | Paso 1 — **desplegado** |
| `simularLaoPreview` | Paso 3 (pendiente cablear en wizard; hoy en `lao-formulario`) |
| `crearSolicitudArticuloLaoBorrador` | Paso 4 (pendiente) |

**Payload paso 1:** `{ articulo_id, persona_id }` — `anio_origen_bolsa` opcional (omitir = FIFO).

---

## 6. Incidentes resueltos

| Síntoma | Fix |
|---------|-----|
| `RRHH debe enviar persona_id del agente` en paso 1 | FE envía `persona_id` desde claims; callable RRHH acepta token si no hay body |
| Selector bolsa confundía producto | Eliminado; solo listado informativo + FIFO |

---

## 7. Punto exacto — próxima sesión (P1)

**Implementar F3a.1 paso 2 — Fechas + `resumen_computo` en FE**

1. En `LaoWizardTicketera`, paso 2: inputs `fecha_desde` / `fecha_hasta` (fecha ref desde query).
2. Crear o reutilizar **`calcularResumenComputo`** en `shared/utils` (RFC §4) + hook (p. ej. calendario institucional subscribe / callable liviano si hace falta).
3. Mostrar bloque resumen según `modo_computo` (CORRIDOS vs HABILES) — sin campo editable de días.
4. Guardar en estado wizard: `version_aplicada_id`, `anio_origen_bolsa_activo` del paso 1 (`resumen_disponibilidad_lao`).

**Después (F3a.2):** extender `simularLaoPreview` con `fecha_hasta` + validar `dias_solicitados === dias_consumo`; paso 3 preview `eligible`.

**No rehacer:** paso 1 disponibilidad salvo bug; callable bolsa ya en prod.

---

## 8. Deploy (cerrar sesión)

```bash
npm run build:web
npx firebase deploy --project portal-hospital-v2 --only hosting
# Si se tocó solo UI, hosting alcanza. Callable ya desplegado en sesión.
```

---

## 9. Documentos relacionados

| Doc | Rol |
|-----|-----|
| [`RFC_TICKETERA_LAO_WIZARD_V2.md`](./RFC_TICKETERA_LAO_WIZARD_V2.md) | Contrato maestro F3a |
| [`PLAN_TICKETERA_V2.md`](./PLAN_TICKETERA_V2.md) | Plan maestro actualizado |
| [`TICKETERA_EVIDENCIA_2026-05-22_LAO_F3A1_PASO1.md`](./TICKETERA_EVIDENCIA_2026-05-22_LAO_F3A1_PASO1.md) | Evidencia smoke paso 1 |
| [`MODULO_CALENDARIO_INSTITUCIONAL.md`](./MODULO_CALENDARIO_INSTITUCIONAL.md) | Depende paso 2 hábiles |

---

## 10. Changelog handoff

| Fecha | Nota |
|-------|------|
| 2026-05-22 | Sesión F3a.1: callable bolsa + wizard paso 1 + UX Disponibles + push remoto |
