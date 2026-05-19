# RFC — Acceso por rol HLC (menú, sesión, artículos)

**Estado:** **Implementado** (backend + rules parcial + web parcial menú legacy) — 2026-05-19  
**Proyecto:** `portal-hospital-v2` · Functions `southamerica-east1`  
**Relación:** [`MODULO_LOGIN_V2.md`](./MODULO_LOGIN_V2.md) §3.3 · [`CUESTIONES_ROLES_MENUS_ARQUITECTURA_V2.md`](./CUESTIONES_ROLES_MENUS_ARQUITECTURA_V2.md) · [`RFC_TICKETERA_SLICE_64A_MVP_V2.md`](./RFC_TICKETERA_SLICE_64A_MVP_V2.md) §D4 · [`HANDOFF_SESION_2026-05-19_ROLES_HLC_CLAIMS.md`](./HANDOFF_SESION_2026-05-19_ROLES_HLC_CLAIMS.md)

---

## 1. Problema que se resolvió

- Existía un claim **`portal_role`** en Firebase Auth (`usuario`, `rrhh`, …) **desacoplado** del rol canónico en **`historial_laboral_cargos.rol_id`** (`cfg_rol`: `CFG_USUARIO`, `CFG_RRHH`, …).
- `applyLaborAwareSessionClaims` solo mapeaba **`CFG_RRHH` → `portal_role: "rrhh"`**; con **`CFG_USUARIO`** dejaba **`portal_role: null`**, y callables como **`listarArticulosIngresoAgente`** rechazaban al agente aunque tuviera HLC correcta.
- Tras cargar datos laborales (HLc/HLd/HLg), el token **no se refrescaba** hasta login manual o `syncSessionClaims`.

---

## 2. Decisión de producto (cerrada 2026-05-19)

| Tema | Decisión |
|------|----------|
| **Fuente de verdad del rol** | **`rol_id` en HLC** (FK `cfg_rol`), cadena vigente **HLc → HLd → HLg** a fecha Argentina. |
| **Multi-HLC** | Menú y permisos = **unión** de todos los `rol_id` en cadenas vigentes simultáneas. |
| **Claim canónico en JWT** | **`roles_hlc_vigentes: string[]`** (distinct, ordenado). |
| **`perfil_rol_id` / `portal_role`** | **Deprecados** — no escribir en claims nuevos (`null` al sync). Lectura legacy tolerada en rules/UI hasta limpieza. |
| **RRHH acceso menú** | Si `CFG_RRHH` ∈ `roles_hlc_vigentes` → **todos los bloques de menú** (usuario, jefe, médico, visualizador, RRHH y futuros). **No** bypass de circuito de artículos. |
| **Menú jefe** | Visible si **`tiene_subordinados`** (jerarquía real). RRHH ve bloque jefe **sin** exigir subordinados. Sin `CFG_JEFE` en catálogo por ahora. |
| **Artículos / solicitudes** | **`hlc.rol_id` ∈ `circuito_ingreso_ids`** de la versión + filtros laborales (escalafón, etc.). Sin puerta `portal_role` en circuito. |

---

## 3. Flujo de alta y cuándo se actualizan claims

| Paso | Callable / acción | Auth | Claims |
|------|-------------------|------|--------|
| **A — Pre-alta RRHH** | `rrhhAltaAgente` | No crea usuario Auth | — |
| **B — Primer acceso** | `registrarPrimerAcceso` | Crea `auth_uid` | `applyLaborAwareSessionClaims` (HL vacío → `cargo_activo: false`, `roles_hlc_vigentes: []`) |
| **Vínculo / fin onboarding** | `vincularCuentaConDni`, `onboardingMvpCompletar` | Sesión existente | Mismo helper |
| **Login** | Cliente `AccesoPortal` → `syncSessionClaims` + `getIdToken(true)` | — | Recalcula desde HL |
| **Guardado laboral** | `guardarRegistroLaboralTemporal` (HLc/HLd/HLg) | — | **`refreshSessionClaimsForPersona(persona_id)`** si ya hay `auth_uid` |
| **Deshabilitar HLC** | `rrhhDeshabilitarHlc` | — | Refresh claims del titular |

**Regla operativa:** después de completar cadena HL, el agente debe **cerrar sesión y entrar** o haber sido refrescado por guardado laboral / login.

---

## 4. Contrato de custom claims (JWT)

Escritos por **`applyLaborAwareSessionClaims`** (`functions/modules/shared/authClaims.js`):

| Claim | Tipo | Descripción |
|-------|------|-------------|
| `persona_id` | string | `per_*` |
| `cuenta_id` | string | `usr_*` |
| **`roles_hlc_vigentes`** | `string[]` | Roles `cfg_rol` de HLc con cadena HL completa vigente a hoy |
| `cargo_activo` | boolean | Al menos una cadena HLc→HLd→HLg operativa |
| `labor_rol_conflicto` | boolean | Más de un `rol_id` distinto en cadenas vigentes |
| `portal_role` | null | Legacy — no usar |
| `perfil_rol_id` | null | Legacy — no usar |

Cálculo: **`computeLaborProfileForPersona`** (`functions/modules/shared/laborProfile.js`).

---

## 5. Callables y sesión agente

### 5.1 ¿Puede operar solicitudes / listar artículos?

**`isPortalRoleUsuario(token)`** (`shared/utils/solicitudElegibilidadLaboral.js`):

1. **`cargo_activo === true`** y **`roles_hlc_vigentes.length > 0`**, o  
2. Legacy: `portal_role` en lista histórica, o `CFG_RRHH` en token legacy.

**`listarArticulosIngresoAgente`:** usa la regla anterior; mensaje orientativo si falla por HL incompleta.

### 5.2 Circuito por artículo

**`evaluarCircuitoIngreso`:** solo **`hlc.rol_id` ∈ `circuito_ingreso_ids`**. No evalúa `portal_role`.

### 5.3 RRHH (gestión)

**`tokenHasRrhhLaborAccess`:** `CFG_RRHH` ∈ `roles_hlc_vigentes` o legacy `portal_role` rrhh/admin.

Firestore **`portalRrhhOrAdmin()`:** `roles_hlc_vigentes.hasAny(['CFG_RRHH'])` + legacy.

---

## 6. Menú web (estado y pendiente)

**Implementado hoy:** bloque RRHH en sidebar sigue usando **`MANAGEMENT_PORTAL_ROLES`** leyendo claims vía **`portalRole.js`** (actualizado para **`roles_hlc_vigentes`**).

**Pendiente (oleada C):** metadata por ítem en `MODULOS_PORTAL` (`roles_hlc`, `requiere_subordinados`), filtro con regla RRHH “ve todo”, Vitest de menú.

Ver §2 de [`CUESTIONES_ROLES_MENUS_ARQUITECTURA_V2.md`](./CUESTIONES_ROLES_MENUS_ARQUITECTURA_V2.md) — este RFC **supersede** la idea de `usuarios_cuenta.role_ids` como driver principal.

---

## 7. Scripts y desarrollo

| Script | Uso |
|--------|-----|
| `npm run firebase:deploy:functions` | Deploy (predeploy sync `shared` → `functions`) |
| `node scripts/dev-set-portal-role-rrhh.mjs <email\|DNI>` | Dev sin HLC: fuerza **`roles_hlc_vigentes: ["CFG_RRHH"]`** (ya no `portal_role`) |
| Login DNI | `syncSessionClaims` automático en cliente |

---

## 8. Ticketera 64-A — impacto en pruebas

| Caso | Esperado |
|------|----------|
| Agente `CFG_USUARIO` + HL completa | Callable OK; artículo visible solo si escalafón/circuito pasan |
| **T2** PROFESIONAL / DNI piloto | **Lista vacía** o rechazo **`ELEG_ESCALAFON`** — **no** error “perfil portal” |
| RRHH con solo `CFG_RRHH` en HLC | Menú amplio; 64-A solo si circuito incluye su `rol_id` en HLC usada |

Matriz: [`TICKETERA_SLICE_64A_MATRIZ_PRUEBAS.md`](./TICKETERA_SLICE_64A_MATRIZ_PRUEBAS.md).

---

## 9. Archivos de código tocados (referencia)

| Área | Rutas |
|------|--------|
| Perfil + token | `functions/modules/shared/laborProfile.js`, `authClaims.js` |
| RRHH assert | `functions/modules/shared/helpers.js` |
| Elegibilidad / circuito | `shared/utils/solicitudElegibilidadLaboral.js` → sync CJS |
| Listado 64-A | `functions/onCall/solicitudes/listarArticulosIngresoAgente.js` |
| Refresh post-HL | `functions/modules/catalogosLaborales.js` |
| Login sync | `functions/modules/login.js` |
| Rules | `firebase-v2/firestore.rules` (`portalRrhhOrAdmin`) |
| Web claims UI | `web/src/features/routing/portalRole.js` |
| Tests | `web/src/features/solicitudes/solicitudElegibilidadLaboral.test.js` |

---

## 10. Changelog

| Fecha | Cambio |
|-------|--------|
| 2026-05-19 | RFC creado; implementación claims `roles_hlc_vigentes`; deprecación escritura `portal_role`; refresh post-guardado laboral; deploy Functions OK. |
| 2026-05-19 | Deploy rules + Hosting; menú 64-A por elegibilidad; configurador RRHH validado tras rules (28914247). |
