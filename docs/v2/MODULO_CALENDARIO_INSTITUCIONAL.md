# Calendario institucional (SSoT)

## Firestore

- Ruta: `config/calendario_institucional/eventos/{YYYY-MM-DD}`
- Campos: `tipo` (`feriado` | `asueto` | `institucional`), `descripcion`, `multiplicador`, `anual`
- Lectura: cualquier usuario autenticado
- Escritura: `portalRrhhOrAdmin()` (claims `CFG_RRHH` / `portal_role` rrhh|admin)

## Lógica compartida

- `shared/utils/calendarInstitucionalCore.js` — reglas puras (índice, días hábiles, multiplicador)
- Sincronizado a Functions vía `scripts/sync-shared-to-functions.mjs`

## Backend

- `functions/modules/shared/calendarService.js` — cache TTL 5 min, lectura subcolección completa
- API: `esDiaHabil`, `getInfoDia`, `contarDiasHabiles`, `obtenerProximoDiaHabil`, `invalidateCalendarioInstitucionalCache`

Regla de día hábil: no fin de semana y **sin** documento de evento (incluye feriado, asueto e institucional).

## Frontend RRHH

- `/portal/rrhh/calendario-institucional` — `CalendarioConfig.jsx`
- Servicio: `web/src/services/calendarioInstitucionalService.js` (misma core que Functions)

## Integración solicitudes (transversal)

- **Selector maestro:** `bloque_topes_plazos_computo.regla_computo_dias_id` (`cfg_rcd_corridos` | `cfg_rcd_habiles_simple` | `cfg_rcd_habiles_compuesto`).
- **`readModoCalculo`** (`shared/utils/modoComputoCalendario.js`) deriva modo interno y si aplica C4.
- Campo espejo en Firestore: `usa_calendario_institucional` (se sincroniza al guardar versión; no es knob independiente en UI).
- Middleware: `shared/utils/validarFechasArticulo.js` — C1, C2, C4 según modo.
- Backend: `validarFechasArticuloEnMotor` en `runPatronBAltaMotor` y `validarEntornoOperativoSolicitud`.
- Frontend: `useValidacionCalendario` + resumen en `PatronBPreviewInfo` cuando el preview devuelve `calendario_resumen`.

## Pendiente

- Wizard LAO: [`RFC_TICKETERA_LAO_WIZARD_V2.md`](./RFC_TICKETERA_LAO_WIZARD_V2.md) (`resumen_computo`, rango de fechas, `dias_consumo` calculado).
- Horas compensatorias: `getInfoDia` / multiplicador.
- DatePicker: deshabilitar días no hábiles en modos hábiles.
