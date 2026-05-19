# Handoff sesión 2026-05-19 — Roles HLC, claims y deploy ticketera

**Rama:** `feature/ticketera-puente-campos-config`  
**Firebase:** `portal-hospital-v2`  
**Deploy Functions:** **OK** 2026-05-19 (2.º intento completó 8 funciones que fallaron por timeout API en el 1.º)  
**Deploy Hosting:** **OK** 2026-05-19 (menú 64-A por elegibilidad + mensaje `elegibilidad_vacia`)  
**Deploy Firestore rules:** **OK** 2026-05-19 (`firebase deploy --only firestore:rules`)

**RFC:** [`RFC_ACCESO_ROLES_HLC_MENUS_V2.md`](./RFC_ACCESO_ROLES_HLC_MENUS_V2.md)

---

## 1. Contexto de la sesión

- Continuidad desde pausa ticketera 64-A ([`HANDOFF_SESION_2026-05-18_TICKETERA_64A_PAUSA.md`](./HANDOFF_SESION_2026-05-18_TICKETERA_64A_PAUSA.md)).
- Piloto T2: usuario DNI **1234567** / uid **`4vnzLdKfRSSaFveelzebYg23rsi2`** — error “Tu perfil de acceso al portal no puede listar artículos…” por **`portal_role: null`** con **`perfil_rol_id: CFG_USUARIO`** en token.
- Acuerdo de producto: acceso por **rol HLC**, menú por unión multi-HLC, RRHH ve **todos** los menús, jefe solo con subordinados reales, artículos por **circuito en versión**.

---

## 2. Entregado (código + deploy)

| Ítem | Detalle |
|------|---------|
| Claims | `roles_hlc_vigentes[]`; `portal_role` / `perfil_rol_id` → `null` al sync |
| Alta / login | Sin cambio en `rrhhAltaAgente`; sync en B, onboarding, `syncSessionClaims` |
| Post-laboral | `refreshSessionClaimsForPersona` tras HLc/HLd/HLg y deshabilitar HLC |
| 64-A listado | Gate por `cargo_activo` + roles HLC; circuito solo `hlc.rol_id` |
| Rules | `portalRrhhOrAdmin` acepta `CFG_RRHH` en array |
| Web | `portalRole.js` lee `roles_hlc_vigentes` |
| Dev script | `dev-set-portal-role-rrhh.mjs` → `roles_hlc_vigentes: ["CFG_RRHH"]` |
| Tests | Vitest `solicitudElegibilidadLaboral` OK |
| Ticketera UX agente | `ArticulosIngresoProvider` + `articuloIngresoId` en menú; sin 64-A si no pasa filtros (DNI **1234567** **OK**) |
| Callable listado | `elegibilidad_vacia` cuando lista vacía (mensaje escalafón en pantalla) |
| Configurador RRHH | Tras **rules** + re-login: **Gestionar** versión OK (DNI **28914247**) |

---

## 3. Configurador de artículos — incidente y cierre

**Síntoma:** DNI **28914247** entraba a menú Artículos / grilla (callables), pero al **Gestionar** versión: *«Sin permiso para leer la versión…»* (`permission-denied` en `getDoc` cliente).

**Causa:** La grilla usa **`listarColeccion`** / **`listarVersionesCfgArticulo`** (Admin SDK + `assertRrhh`). El editor **`ArticuloConfigTabs`** lee la versión con **`getDoc`** directo → exige **`portalRrhhOrAdmin()`** en Rules. Tras migración de claims (`portal_role` → `null`, canónico `roles_hlc_vigentes`), las **rules en Firebase** aún no incluían `CFG_RRHH` en el array hasta el deploy del 19/05.

**Cierre operativo:** `npx firebase deploy --project portal-hospital-v2 --only firestore:rules` + **logout/login** → gestión de versión **OK**.

**Mejora futura (código):** cargar versión vía callable (misma vía que la grilla) para no depender de doble criterio cliente/Rules.

---

## 4. Matriz 64-A — estado

| Caso | Estado |
|------|--------|
| T1, T6 | **OK** (piloto 28914247) |
| T2 | **OK** — 1234567 sin menú 64-A (`ELEG_ESCALAFON`) |
| T7 | **OK** — 28914247, mensaje `SALDO_MES` |
| T5 | **OK** — mensaje saldo ciclo (`SALDO_CICLO`) |
| T3 | **OK** — 1234567 sin menú 64-A |
| T4 | **OK** — `ELEG_SIN_HLC` por fecha sin HLC vigente |
| T8 | **N/A** (UI 1 día) |
| R1, R2, §13 | **OK** — cierre matriz 2026-05-19 |

Ver [`TICKETERA_SLICE_64A_MATRIZ_PRUEBAS.md`](./TICKETERA_SLICE_64A_MATRIZ_PRUEBAS.md). Ancla histórica: [`HANDOFF_SESION_2026-05-18_TICKETERA_64A_PAUSA.md`](./HANDOFF_SESION_2026-05-18_TICKETERA_64A_PAUSA.md).

---

## 5. Qué debe hacer el operador ahora

1. Tras cambios en **claims** o **rules**: deploy rules si aplica + **re-login**.
2. Continuar matriz **T3–T8** y regresión **R1–R2** en piloto.
3. Token: `roles_hlc_vigentes` con `CFG_RRHH` para RRHH en configurador y callables.

---

## 6. Pendiente (producto / código)

- Menú por metadata `roles_hlc` en `MODULOS_PORTAL` (oleada C).
- Claim **`tiene_subordinados`** para bloque jefe.
- RFC §13 aprobación RRHH slice 64-A.
- Callable lectura única de versión configurador (opcional).
- Commits / push a remoto cuando cierre operador.

---

## 7. Comandos útiles

```bash
npm run firebase:deploy:functions
npx firebase deploy --project portal-hospital-v2 --only firestore:rules
cd web && npm run build && npx firebase deploy --project portal-hospital-v2 --only hosting
cd web && npm test -- --run solicitudElegibilidadLaboral
node scripts/diagnostico-listar-64a.mjs --dni=1234567
node scripts/diagnostico-listar-64a.mjs --dni=28914247
```
