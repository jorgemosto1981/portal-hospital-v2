# Handoff — Motor LAO v2 + piloto greenfield · PAUSA 2026-05-24

**Rama:** `feature/ticketera-puente-campos-config`  
**Firebase:** `portal-hospital-v2` · región `southamerica-east1`  
**Hosting prod:** https://portal-hospital-v2.web.app  
**Artículo LAO piloto:** `art_01KRNYDN5WR7RER7MWXRZ817E7`

> **Retomar en otra PC:**
> ```bash
> git fetch origin
> git checkout feature/ticketera-puente-campos-config
> git pull origin feature/ticketera-puente-campos-config
> ```
> **HEAD al cerrar sesión:** ver `git log -1` tras push de este handoff.

---

## 1. Punto exacto — RETOMAR AQUÍ

**Implementación RFC LAO motor wiring: CERRADA en código, prod y piloto E2E.**

| Estado | Detalle |
|--------|---------|
| RFC Fases 1–6 + greenfield §13 | ✅ |
| Piloto DNI `28914247` | ✅ LAO v2 + RRHH sustituta + grilla MDC |
| **Pausa** | Sin tareas obligatorias del RFC; retomar solo si producto pide nuevos artículos, más agentes o smoke acreditación |

**Opcional al retomar:**

- Smoke `acreditarLaoBolsaAgente` sin `cantidad_inicial` manual.
- Segundo agente / otro ejercicio LAO en configurador.
- Commit/PR merge de rama a `main` según acuerdo equipo.

---

## 2. Resumen sesión 2026-05-24 (esta continuación)

### Fase 4 — CI semántica muerta (R5) ✅

| Pieza | Ruta / comando |
|-------|----------------|
| Script | `scripts/auditar-campos-version-consumidos-lao.mjs` |
| Mapa SSoT | `scripts/lib/laoCamposVersionMapaRfc.mjs` |
| Walker Zod | `scripts/lib/zodVersionLeafPaths.mjs` |
| npm | `npm run audit:lao-campos-version` |
| Resultado | **80 hojas** schema · **0 huérfanos** |

### Fase 6 — Documentación ✅

- `MODULO_ARTICULOS_V2_SCHEMA_PRODUCT_FIRST.md` §4.1 — motor v2, `motor_snapshot`, sin hardcodes 180/01-07.
- `RFC_LAO_MOTOR_CONFIG_WIRING_V2.md` §15 — **11/11** criterios aceptación marcados.
- Estado RFC: **arquitectura cerrada**.

### Fase 5 — Greenfield prod ✅

```powershell
npm run db:greenfield-reset-lao-v2:apply -- --rda=all --saldos=all
```

| Recurso borrado/parcheado | Cantidad |
|---------------------------|----------|
| `solicitudes_articulo` | 41 |
| `asistencia_diaria` | 23 |
| `vistas_grilla_mes_agente` | 11 |
| `saldos_articulo_agente` | 9 |
| `mdc_comandos_aplicados` (sol_*) | 39 |
| Versiones LAO parcheadas (motor §11) | 6 |

### UI menú móvil compacto + fixes ✅

| Archivo | Cambio |
|---------|--------|
| `BottomNavigationBar.jsx` | Acordeón por rol, densidad compacta |
| `menuGrupoAcceso.js` | Visibilidad grupo por `CFG_*` HLC |
| `AppBrandHeader.jsx` | Header `h-12` móvil |
| `bandejaSolicitudExpandDatos.js` | Fix keys duplicadas React (`jefe_revision_*`) |
| `modulosEstado.js` | Grilla → **MVP** en menú jefe |
| `portalRole.js` | `claimsIncludeJefe` / `CFG_JEFE` en `hasAnyPortalRole` |

**Deploy hosting (24-may):** ✅ `firebase deploy --only hosting`

### Piloto E2E — DNI 28914247 (MOSTO) ✅

| Paso | Evidencia |
|------|-----------|
| Check-in + saldos | Bolsa 2023, descuento 5 días |
| Solicitud LAO | `sol_01KSCZGP8K1T52M3JJQTNQYWZZ` |
| Motor | `lao-preview-v2`, TSE 152/180, camino **stock**, preaviso advertencia |
| RRHH sustituta | `cfg_esa_aprobada`, eventos `rrhh_sustituta_aprobar` + `rrhh_toma_conocimiento` |
| Grilla MDC | Mayo 24–31 + junio día 1 **LAO-** consolidado; modal día 1 OK |

**Solicitud referencia piloto:** `sol_01KSCZGP8K1T52M3JJQTNQYWZZ`  
**Versión motor snapshot:** `ver_01KRPPTZ86XK1GR4MNCJA804TE` (display LAO-2023 / grilla LAO-2026 — coherente stock bolsa 2023).

### Menú Rol jefe — lección operativa ✅

`syncSessionClaims` **sobrescribe** `roles_hlc_vigentes` desde HLc→HLd→HLg. Claims manuales (`dev-set-roles-hlc`) no persisten tras login.

**Solución aplicada:**

```powershell
node scripts/dev-grant-jefe-hlc-chain.mjs 28914247 --apply
```

- Alta `hlc_01KSDC4DQPEC3WHN4TX7ZKFJWN` + HLd + HLg con `CFG_JEFE`.
- Claims estables: `["CFG_JEFE", "CFG_RRHH"]`.

Scripts dev relacionados:

| Script | Uso |
|--------|-----|
| `npm run dev:set-roles-hlc -- <DNI> CFG_JEFE` | Merge claims (no reemplaza; login puede pisar) |
| `npm run dev:grant-jefe-hlc -- <DNI> --apply` | **Canónico** para menú jefe persistente |
| `npm run db:greenfield-reset-lao-v2` | Dry-run greenfield |
| `npm run db:greenfield-reset-lao-v2:apply` | Apply nuclear (+ flags `--rda` `--saldos`) |

---

## 3. Historial RFC motor (sesiones previas en rama)

| Fase | Estado |
|------|--------|
| Ejes 1–3 + Fases 3, 1, 2 | ✅ commit `3ec35f2` |
| Fase 4 CI | ✅ esta sesión |
| Fase 6 docs | ✅ esta sesión |
| Fase 5 greenfield | ✅ esta sesión |

**Orden ejecutado:** 3 → 1 → 2 → 4 → 6 → 5 (BD).

---

## 4. Deploy prod (acumulado)

### Functions (`southamerica-east1`) — una por comando

```powershell
firebase deploy --only functions:simularLaoPreview
firebase deploy --only functions:onSolicitudArticuloLaoMotorValidate
firebase deploy --only functions:acreditarLaoBolsaAgente
firebase deploy --only functions:listarSolicitudesBandejaRrhh
```

### Hosting

```powershell
npm run build:web
firebase deploy --only hosting
```

Último deploy hosting sesión 24-may: **OK** (menú compacto + grilla MVP + fix bandeja).

---

## 5. Archivos clave

| Pieza | Ruta |
|-------|------|
| RFC SSoT | [`RFC_LAO_MOTOR_CONFIG_WIRING_V2.md`](./RFC_LAO_MOTOR_CONFIG_WIRING_V2.md) |
| MODULO §4.1 | [`MODULO_ARTICULOS_V2_SCHEMA_PRODUCT_FIRST.md`](./MODULO_ARTICULOS_V2_SCHEMA_PRODUCT_FIRST.md) |
| Orquestador | `functions/modules/shared/laoAltaMotorCompleto.js` |
| Greenfield | `scripts/greenfield-reset-lao-v2.mjs` |
| CI campos | `scripts/auditar-campos-version-consumidos-lao.mjs` |
| Jefe HL | `scripts/dev-grant-jefe-hlc-chain.mjs` |
| Grilla UI | `web/src/pages/GrillaOperativa.jsx` (ruta `/portal/grilla`) |

---

## 6. Tests

```powershell
npm run audit:lao-campos-version
node --test functions/test/laoMotorCore.test.js functions/test/laoAltaMotorCompleto.test.js functions/test/laoPreviewDateUtils.test.js
```

---

## 7. Comandos útiles

```powershell
npm run dev:web
npm run build:web
firebase deploy --only hosting
npm run audit:lao-campos-version
```

---

## 8. Continuidad documental

- Wizard F3a: [`HANDOFF_SESION_2026-05-22_LAO_WIZARD_F3A1.md`](./HANDOFF_SESION_2026-05-22_LAO_WIZARD_F3A1.md)
- Grilla MDC épica: [`HANDOFF_SESION_2026-05-21_GRILLA_OLEADA_C_CIERRE.md`](./HANDOFF_SESION_2026-05-21_GRILLA_OLEADA_C_CIERRE.md)
- Roles HLC claims: [`HANDOFF_SESION_2026-05-19_ROLES_HLC_CLAIMS.md`](./HANDOFF_SESION_2026-05-19_ROLES_HLC_CLAIMS.md)

---

*Sesión pausada — implementación LAO motor wiring considerada cerrada · 2026-05-24.*
