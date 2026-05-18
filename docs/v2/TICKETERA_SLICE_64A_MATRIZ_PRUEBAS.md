# Matriz de pruebas — Ticketera slice 64-A (MVP)

**RFC:** [`RFC_TICKETERA_SLICE_64A_MVP_V2.md`](./RFC_TICKETERA_SLICE_64A_MVP_V2.md)  
**Artículo:** `art_01KRNK10V10CH7W5M2W6V558GS` (64-A)  
**Piloto T1:** `per_01KQN9WXFXF69Z9DCT5YNJ3TFZ`

Marcar **OK** / **Falla** / **N/A** · anotar `sol_*` y fecha.

---

## Elegibilidad y circuito

| # | Caso | Esperado | OK | Notas |
|---|------|----------|-----|-------|
| T1 | Piloto 28914247 (ADMIN + rol HLC RRHH), circuito config | Puede crear; `cfg_esa_en_revision_jefe` | **OK** | `sol_01KRYPRDBP92V5MH77EWZ27RDM` 2026-05-18 |
| T2 | Agente 9282 (PROFESIONAL) | No lista / rechaza `ELEG_ESCALAFON` | | |
| T3 | Rol HLC no en circuito | `CIRCUITO_ROL` | | Con config estándar, RRHH en cargo OK |
| T4 | `fecha_desde` con HLC vigente | OK según HLC en fecha | | |

---

## Saldo Patrón B

| # | Caso | Esperado | OK | Notas |
|---|------|----------|-----|-------|
| T5 | Sin bolsa o disponible 0 | `SALDO_CICLO` / rechazada | | |
| T6 | 1 día OK | `consumido` +1, `disponible` -1 en `sal_2026_per_*` | **OK** | 64-A: consumido 2, disponible 4 (`sol_01KRYPR…`) |
| T7 | Segunda solicitud mismo mes | `SALDO_MES` (tope 1/mes) | | |
| T8 | `dias_solicitados` ≠ 1 | `SALDO_EVENTO` | | |

---

## Regresión

| # | Caso | Esperado | OK |
|---|------|----------|-----|
| R1 | LAO `/portal/solicitudes/lao` | Sigue funcionando (trigger distinto) | |
| R2 | Check-in bolsa 64-A | Rectificación no rota saldo | |

---

## Cierre slice 64-A

| Criterio | OK |
|----------|-----|
| T1 y T2 obligatorios pass | T1 OK; T2 pendiente |
| T6 bolsa coherente en Firestore | **OK** piloto |
| `sol_*` registrado en handoff continuidad | **OK** — ver [`HANDOFF_SESION_2026-05-18_TICKETERA_64A_PAUSA.md`](./HANDOFF_SESION_2026-05-18_TICKETERA_64A_PAUSA.md) |
| RFC §13 aprobado por RRHH | |
