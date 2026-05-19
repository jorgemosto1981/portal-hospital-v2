# Matriz de pruebas — Ticketera slice 64-A (MVP)

**RFC:** [`RFC_TICKETERA_SLICE_64A_MVP_V2.md`](./RFC_TICKETERA_SLICE_64A_MVP_V2.md)  
**Roles / claims:** [`RFC_ACCESO_ROLES_HLC_MENUS_V2.md`](./RFC_ACCESO_ROLES_HLC_MENUS_V2.md)  

**Artículo:** `art_01KRNK10V10CH7W5M2W6V558GS` (64-A)  
**Piloto T1:** `per_01KQN9WXFXF69Z9DCT5YNJ3TFZ`

Marcar **OK** / **Falla** / **N/A** · anotar `sol_*` y fecha.

**Última actualización operativa:** 2026-05-19 — handoff [`HANDOFF_SESION_2026-05-19_ROLES_HLC_CLAIMS.md`](./HANDOFF_SESION_2026-05-19_ROLES_HLC_CLAIMS.md).

**Estado:** matriz **cerrada** en piloto (confirmación operador 2026-05-19). Siguiente: slice 64-B / bandeja jefe o §13 formal RRHH si el hospital lo exige por escrito.

---

## Elegibilidad y circuito

| # | Caso | Esperado | OK | Notas |
|---|------|----------|-----|-------|
| T1 | Piloto 28914247 (ADMIN + rol HLC RRHH), circuito config | Puede crear; `cfg_esa_en_revision_jefe` | **OK** | `sol_01KRYPRDBP92V5MH77EWZ27RDM` 2026-05-18 |
| T2 | Agente 9282 (PROFESIONAL) / DNI **1234567** | **No** menú 64-A / ruta redirige; motor `ELEG_ESCALAFON` | **OK** | `per_01KQQJA5Q1VKBTJ74RHQ0HSHSB`; menú filtrado por `listarArticulosIngresoAgente` — 2026-05-19 |
| T3 | Rol HLC no en circuito | `CIRCUITO_ROL` o sin acceso menú | **OK** | DNI **1234567**: **no** menú 64-A (misma barrera elegibilidad que T2; no prueba envío con código `CIRCUITO_ROL` aislado) — 2026-05-19 |
| T4 | `fecha_desde` con HLC vigente | Sin HLC en fecha → `ELEG_SIN_HLC`; con HLC → lista/envío OK | **OK** | UI: *«No tenés un cargo vigente para la fecha elegida.»* — 2026-05-19 |

---

## Saldo Patrón B

| # | Caso | Esperado | OK | Notas |
|---|------|----------|-----|-------|
| T5 | Sin bolsa o disponible 0 | `SALDO_CICLO` / rechazada | **OK** | UI: *«No hay saldo disponible en el ciclo.»* — legajo sin saldo de ciclo usable (no confundir con T7 / `SALDO_MES`) — 2026-05-19 |
| T6 | 1 día OK | `consumido` +1, `disponible` -1 en `sal_2026_per_*` | **OK** | 64-A: consumido 2, disponible 4 (`sol_01KRYPR…`) |
| T7 | Segunda solicitud mismo mes | `SALDO_MES` (tope 1/mes) | **OK** | DNI **28914247** — UI: *«Ya usaste la solicitud permitida este mes.»* (1.er y 2.º intento tras T1/T6) — 2026-05-19 |
| T8 | `dias_solicitados` ≠ 1 | `SALDO_EVENTO` | **N/A** | MVP UI fija 1 día; motor en trigger — confirmado operador 2026-05-19 |

---

## Regresión

| # | Caso | Esperado | OK |
|---|------|----------|-----|
| R1 | LAO `/portal/solicitudes/lao` | Sigue funcionando (trigger distinto) | **OK** | 2026-05-19 |
| R2 | Check-in bolsa 64-A | Rectificación no rota saldo | **OK** | 2026-05-19 |

---

## Cierre slice 64-A

| Criterio | OK |
|----------|-----|
| T1 y T2 obligatorios pass | **OK** |
| T6 bolsa coherente en Firestore | **OK** piloto |
| `sol_*` registrado en handoff continuidad | **OK** — ver [`HANDOFF_SESION_2026-05-18_TICKETERA_64A_PAUSA.md`](./HANDOFF_SESION_2026-05-18_TICKETERA_64A_PAUSA.md) |
| RFC §13 aprobado por RRHH | **OK** | Cierre operativo piloto 2026-05-19 (confirmación operador; acta formal opcional) |
| Matriz T1–T8 + R1–R2 | **OK** | |
