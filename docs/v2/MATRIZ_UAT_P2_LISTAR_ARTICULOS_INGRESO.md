# Matriz UAT P2 — listar artículos ingreso (oleada 63)

**Épica:** Decreto 1919 / motor solicitudes V2 — **P2 oleada 63**  
**Callable / core:** `listarArticulosIngresoPatronB` (`functions/modules/shared/listarArticulosIngresoCore.js`)  
**Piloto:** `per_01KQN9WXFXF69Z9DCT5YNJ3TFZ` — DNI **28914247**  
**Script verificación:** `node scripts/seed-v2/verify-oleada-63-listar.mjs`

Marcar **OK** / **Falla** / **N/A** — anotar fecha y evidencia (`sol_*` si aplica).

---

| ID | Escenario | Precondición | Pasos | Resultado esperado | OK | Notas |
|----|-----------|--------------|-------|-------------------|-----|-------|
| UAT-P2-01 | Listado post-seed | `--apply` oleada 63 ejecutado; persona piloto con HLC vigente hoy | Ejecutar script verify o UI ticketera `/alta` | Aparecen **5** tarjetas con `codigo_grilla` `63-C`, `63-D`, `63-I`, `63-J`, `63-K` | | |
| UAT-P2-02 | Patrón saldo B | Misma precondición | Inspeccionar payload listado | Cada ítem con `patron_saldo` = B y `dias_solicitados` ≥ 1 coherente con versión | | |
| UAT-P2-03 | Cómputo 63.j corridos | Versión `63-J` publicada | Abrir detalle versión / verify `regla_computo_dias_id` | `cfg_rcd_corridos`; `modo_computo` corridos en listado | | |
| UAT-P2-04 | Cómputo hábiles 63.c/d/i/k | Versiones publicadas | Verify listado | `63-C`, `63-D`, `63-I`, `63-K` con `cfg_rcd_habiles_compuesto` (o equivalente hábil) | | |
| UAT-P2-05 | Opciones consumo 63.j | ABM / Firestore versión `63-J` | Revisar `opciones_consumo_solicitud[]` | **4** filas (5/3/2/1 días) con `id` estable RFC | | |
| UAT-P2-06 | Elegibilidad escalafón abierto | `escalafon_ids: []` en las cinco versiones | Piloto 28914247 lista artículos | No `ELEG_ESCALAFON` por escalafón vacío; otros filtros RRHH pueden aplicar | | |
| UAT-P2-07 | Idempotencia seed | Segundo `--apply` sin borrar datos | Re-ejecutar apply | Sin duplicar `codigo` en `cfg_articulos`; `applied-ids.json` estable | | |

---

## Criterio de cierre P2 (listar)

- UAT-P2-01 y UAT-P2-02 **obligatorios OK** en piloto.
- Mínimo **2 incisos** con smoke MDC+GSO (plan maestro §10) — fuera de esta matriz de listado.