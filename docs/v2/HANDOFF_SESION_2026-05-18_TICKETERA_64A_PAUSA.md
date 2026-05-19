# Handoff — Pausa implementación ticketera slice 64-A (Oleada 1)

**Fecha cierre sesión:** 2026-05-18 (noche)  
**Rama:** `feature/ticketera-puente-campos-config`  
**Firebase:** `portal-hospital-v2` · Functions región `southamerica-east1`  
**Piloto:** `per_01KQN9WXFXF69Z9DCT5YNJ3TFZ` (DNI **28914247**)

> **Retomar mañana desde aquí.** Este documento es el ancla única de continuidad para ticketera 64-A.  
> **Continuidad 2026-05-19:** claims `roles_hlc_vigentes` + deploy Functions — [`HANDOFF_SESION_2026-05-19_ROLES_HLC_CLAIMS.md`](./HANDOFF_SESION_2026-05-19_ROLES_HLC_CLAIMS.md).

**Relacionados:** [`RFC_TICKETERA_SLICE_64A_MVP_V2.md`](./RFC_TICKETERA_SLICE_64A_MVP_V2.md) · [`TICKETERA_SLICE_64A_MATRIZ_PRUEBAS.md`](./TICKETERA_SLICE_64A_MATRIZ_PRUEBAS.md) · [`ARTICULOS_BASICOS_OPERATIVOS_V2.md`](./ARTICULOS_BASICOS_OPERATIVOS_V2.md) · [`HANDOFF_SESION_2026-05-18_ARTICULOS_BASICOS_Y_CONTINUIDAD.md`](./HANDOFF_SESION_2026-05-18_ARTICULOS_BASICOS_Y_CONTINUIDAD.md)

---

## 1. Punto exacto de pausa (estado funcional)

| Ítem | Estado |
|------|--------|
| **Slice MVP 64-A — flujo agente** | **CERRADO en piloto** (alta → trigger → revisión jefe → descuento saldo) |
| **Solicitud de referencia OK** | `sol_01KRYPRDBP92V5MH77EWZ27RDM` |
| **Matriz ticketera T1–T8** | **Cerrada** — ver [`TICKETERA_SLICE_64A_MATRIZ_PRUEBAS.md`](./TICKETERA_SLICE_64A_MATRIZ_PRUEBAS.md) (2026-05-19) |
| **64-B en misma pantalla** | No probado end-to-end |
| **LAO solicitud** | Regresión R1 no re-ejecutada en esta sesión |
| **Hosting UI** | Cambios en `web/` — verificar deploy si se prueba URL publicada |

### Evidencia Firestore (piloto, post `sol_01KRYPRDBP92V5MH77EWZ27RDM`)

**Solicitud**

- `estado_solicitud_id`: `cfg_esa_en_revision_jefe`
- `patron_saldo`: `B`, `schema_version`: 2
- `fecha_desde` / `fecha_hasta`: `2026-05-18`, `dias_solicitados`: 1
- `motor_descuento_aplicado`: true, `motor_dias_descontados`: 1
- `hlc_id_elegibilidad`: `hlc_01KQPW4XZP7QS8025N5Z3TQZY7`
- `version_aplicada`: `ver_01KRNKNBXNBFC9HZN7CZJGPRDH`
- `_debito_origen[0]`: bolsa `bol_art_01KRNK10V10CH7W5M2W6V558GS_2026`, 1 día

**Saldo** `sal_2026_per_01KQN9WXFXF69Z9DCT5YNJ3TFZ`

- Bolsa **64-A**: `consumido` **2**, `disponible` **4** (antes del OK final: 1 / 5)
- Bolsa **64-B**: sin cambio (`consumido` 1, `disponible` 5)

**Solicitud rechazada (histórico — no reintentar)**

- `sol_01KRYP2M4PJRR6K7MJQ90ZWRKB` → `cfg_esa_rechazada`, `motor_codigos`: `CIRCUITO_ROL` (previo a fix circuito en config + trigger)

---

## 2. Lo implementado en esta sesión (Oleada 0 + Oleada 1)

### 2.1 Documentación (Oleada 0)

| Archivo | Contenido |
|---------|-----------|
| `RFC_TICKETERA_SLICE_64A_MVP_V2.md` | Contrato MVP 64-A, callables, trigger, D4 circuito vía **config** |
| `TICKETERA_SLICE_64A_MATRIZ_PRUEBAS.md` | T1–T8 + regresión R1–R2 |

### 2.2 Backend (Oleada 1) — desplegado a `portal-hospital-v2`

| Componente | Ruta / nombre |
|------------|----------------|
| Shared (fuente ESM) | `shared/utils/hlcVigenciaFecha.js`, `resolvePatronSaldo.js`, `solicitudElegibilidadLaboral.js` |
| Sync → Functions | `scripts/sync-shared-to-functions.mjs` (predeploy) |
| Callable listado | `listarArticulosIngresoAgente` |
| Callable contexto | `resolverContextoLaboralSolicitud` |
| Trigger Patrón B | `onSolicitudArticuloPatronBOnCreate` |
| Motor alta B | `functions/modules/shared/solicitudPatronBAltaMotor.js` |
| LAO trigger | early-return si `schema_version === 2` |
| Rules | `firebase-v2/firestore.rules` — create Patrón B `schema_version: 2` |
| Exports | `functions/index.js` |

**Deploy:** Functions ejecutado **varias veces** en la sesión (última con motor circuito solo-config).

### 2.3 Frontend (Oleada 1)

| Componente | Ruta |
|------------|------|
| Página 64-A | `web/src/pages/Solicitud64AAlta.jsx` |
| Hook | `web/src/features/solicitudes/useSolicitud64AAlta.js` |
| Tests Vitest | `web/src/features/solicitudes/solicitudElegibilidadLaboral.test.js` |
| Servicio borrador + espera motor | `web/src/services/solicitudesArticuloV2Service.js` (`esperarValidacionMotorPatronB`) |
| Callables wrapper | `web/src/services/callables.js` |
| Menú / ruta | `modulosEstado.js`, `App.jsx`, `BottomNavigationBar.jsx`, `Inicio.jsx` |
| Ruta UI | `/portal/solicitudes/asuntos-particulares` |

### 2.4 Configuración RRHH (Firestore — hecho por operador)

**Circuito estándar** en `bloque_workflow_sla_cobertura.circuito_ingreso_ids`:

`CFG_USUARIO`, `CFG_RRHH`, `CFG_MEDICO`, `CFG_VISUALIZADOR`

**Artículos auditados OK** (`node scripts/auditar-circuito-ingreso-articulos.mjs` → 8/8):

| Artículo | Versión(es) |
|----------|-------------|
| 64-A | `ver_01KRNKNBXNBFC9HZN7CZJGPRDH` |
| 64-B | `ver_01KRYEX13QN7VBPMFQFES1QHB4` |
| 68-B | `ver_01KRYEFZRQF0RKHJ5JTK6244G8` |
| LAO 2022–2026 | `ver_01KRXKS1…`, `ver_01KRPPTZ…`, `ver_01KRNYDP…`, `ver_01KRPQDT…`, `ver_01KRPT6X…` |

**Decisión de producto cerrada:** roles de circuito en **configurador**, no herencia implícita en código (código solo hace `rol_id` HLC ∈ `circuito_ingreso_ids`).

**Login / menú agente:** `portal_role` RRHH, médico, etc. acceden al menú «Rol usuario» (`PORTAL_ROLES_FLUJO_AGENTE` en `solicitudElegibilidadLaboral.js`).

### 2.5 Scripts operativos nuevos

| Script | Uso |
|--------|-----|
| `scripts/diagnostico-listar-64a.mjs` | Por qué listado vacío (DNI) |
| `scripts/diagnostico-solicitud.mjs` | Estado `sol_*` + bolsa |
| `scripts/auditar-circuito-ingreso-articulos.mjs` | Auditoría circuito 64-A/B/68-B/LAO |
| `scripts/patch-circuito-ingreso-rrhh-medico.mjs` | Patch masivo circuito (dry-run / --apply) |
| `scripts/listar-versiones-lao-circuito.mjs` | Listado versiones LAO + circuito |
| `scripts/smoke-solicitud-64a-patron-b.mjs` | Referencia IDs piloto |

---

## 3. Decisiones técnicas (para no reabrir)

| Tema | Decisión |
|------|----------|
| D4 circuito | Lista en versión publicada; trigger **sin** token Auth (`skipPortalRoleCheck`) |
| Roles portal vs HLC | Portal: quién entra al menú agente; HLC `rol_id`: quién puede iniciar **por artículo** |
| Listado vs trigger | Misma elegibilidad; listado no valida saldo (solo trigger) |
| UI post-alta | `esperarValidacionMotorPatronB` — toast éxito solo si `cfg_esa_en_revision_jefe` |
| Patrón B MVP whitelist | `ARTICULO_IDS_MVP` en callable = solo `art_01KRNK10…` (64-A) |

---

## 4. Próximo paso exacto (mañana)

**Orden sugerido:**

1. **Clonar repo** en otra PC: rama `feature/ticketera-puente-campos-config` (tras push de esta sesión).
2. Leer **este handoff** + [`TICKETERA_SLICE_64A_MATRIZ_PRUEBAS.md`](./TICKETERA_SLICE_64A_MATRIZ_PRUEBAS.md).
3. **Completar matriz:** T2, T3, T4, T5, T7, T8, R1, R2 (anotar `sol_*`).
4. **Opcional producto:** misma pantalla para **64-B** (`art_01KRYEX0JZY4Y8J1GY3Q9F8BJQ`) — ampliar `ARTICULO_IDS_MVP` o quitar whitelist.
5. **Pendiente datos LAO:** `correspondencia_anio` vacío en versiones LAO en Firestore — completar en configurador si check-in por año falla (no bloquea 64-A).
6. **Deploy hosting** si se prueba fuera de `npm run dev`.
7. **No reimplementar** herencia circuito en código; mantener config como SSoT.

**Comando retomar auditoría:**

```bash
node scripts/auditar-circuito-ingreso-articulos.mjs
node scripts/diagnostico-listar-64a.mjs --dni=28914247
```

---

## 5. Git (al pausar)

- Commit de sesión: mensaje tipo `feat(ticketera): slice 64-A Oleada 1 — backend, UI, circuito config, T1 piloto OK`
- Push a `origin/feature/ticketera-puente-campos-config`
- **No** merge a `master` sin revisión

---

## 6. Fuera de alcance (no empezar mañana sin acuerdo)

- MDC / grilla asistencia
- Delegación jefe → subordinado
- Múltiples días por evento 64-A (MVP = 1 día)
- Ticketera completa (todos los artículos)
