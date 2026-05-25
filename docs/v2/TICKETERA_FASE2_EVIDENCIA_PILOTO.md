# Evidencia piloto — Ticketera Fase 2 (shell + preview)

**Plan:** [`PLAN_TICKETERA_V2.md`](./PLAN_TICKETERA_V2.md) oleadas 2.1–2.4 · **RFC:** [`RFC_TICKETERA_FASE2_DINAMICA_V2.md`](./RFC_TICKETERA_FASE2_DINAMICA_V2.md)  
**Entorno prueba UI:** `http://localhost:5173` (Vite) · **Functions:** `portal-hospital-v2` · `southamerica-east1` (deploy 2026-05-19: `listarArticulosIngresoAgente`, `previsualizarSolicitudPatronB`)

**Piloto habitual:** DNI **28914247** · `per_01KQN9WXFXF69Z9DCT5YNJ3TFZ`

Marcar **OK** / **Falla** / **Pendiente** · anotar `sol_*`, fecha permiso y pantalla.

---

## Flujo ticketera unificada

| Ruta | Rol |
|------|-----|
| `/portal/solicitudes` | Hub: fecha + carril Patrón B / LAO |
| `/portal/solicitudes/patron-b?fecha=YYYY-MM-DD` | Alta 64-A / 64-B + previsualizar + enviar |
| `/portal/solicitudes/lao` | LAO (Patrón A, sin cambio motor) |

---

## Casos Fase 2 (operador)

| # | Caso | Esperado | OK | Notas |
|---|------|----------|-----|-------|
| **F2-1** | **64-A** vía ticketera: listado → Patrón B → previsualizar → enviar | Preview «Podés enviar»; saldo ciclo −1; `cfg_esa_en_revision_jefe` | **OK** | **2026-05-19** local · fecha permiso **2026-08-14** · artículo **64-A — ASUNTOS PARTICULARES** · preview: disponible **5** → tras envío **4** (consumo 1) · mes **0 de 1** · `sol_01KS06F95Z0X1P6713PHKERAK5` |
| **F2-1b** | **64-A** mismo mes calendario que F2-1 (re-preview / 2.º envío) | Preview «No podés enviar» · `SALDO_MES` · *Ya usaste la solicitud permitida este mes.* | **OK** | Coherente con matriz **T7** y `sol_01KS06F95Z0X1P6713PHKERAK5` en **2026-08** — tope **1/mes por artículo** |
| **F2-1c** | **64-A** otro mes (**2026-09**) — preview | «Podés enviar» · saldo **4→3** · mes **0/1** | **OK** | Fecha **2026-09-17** |
| **F2-1e** | Envío **64-A** sept | `sol_*` + revisión jefe | **OK** | `sol_01KS06Q8ZAS8ZVHQV4S122Q3F8` — 2026-05-19 local |
| **F2-2** | **64-B** ticketera + preview (**2026-09**) | «Podés enviar» · bolsa 64-B **5→4** · mes **0/1** independiente de 64-A | **OK** | Fecha **2026-09-17** |
| **F2-2e** | Envío **64-B** sept | `sol_*` + revisión jefe | **OK** | `sol_01KS06QVPZD80YPHV6QJVYBX2T` — 2026-05-19 local |
| **F2-3** | Hub sin artículos Patrón B (ej. T2 / 1234567) | Carril asuntos partic. deshabilitado; mensaje elegibilidad si aplica | Pendiente | |
| **F2-4** | Regresión LAO desde hub | `/portal/solicitudes/lao` operativo | Pendiente | Opcional si ya R1 matriz 64-A |

---

## Detalle F2-1 (64-A + preview)

| Campo | Valor |
|-------|--------|
| `articulo_id` | `art_01KRNK10V10CH7W5M2W6V558GS` |
| `fecha_desde` / `fecha_hasta` | `2026-08-14` (1 día, RO en UI) |
| Callable preview | `previsualizarSolicitudPatronB` |
| `solicitud_id` | `sol_01KS06F95Z0X1P6713PHKERAK5` |
| Estado post-envío | En revisión por jefe (toast UI) |

**Relación matriz 64-A cerrada:** refuerza T6 (consumo bolsa) y UX Fase 2; no reabre T1–T8 salvo regresión.

### F2-1b — segundo intento 64-A (mismo mes)

Tras F2-1, cualquier **Previsualizar** / envío de **64-A** con `fecha_desde` en **agosto 2026** debe fallar con **`SALDO_MES`**. El botón **Enviar** queda deshabilitado hasta cambiar artículo o mes.

---

## Septiembre 2026 — 64-A y 64-B (misma fecha, artículos distintos)

| Artículo | `fecha_desde` | Preview saldo ciclo | Frecuencia mes (preview) |
|----------|---------------|---------------------|---------------------------|
| **64-A** con goce | `2026-09-17` | disponible **4** → tras envío **3** | **0 de 1** (+1 al enviar) · `sol_01KS06Q8ZAS8ZVHQV4S122Q3F8` |
| **64-B** sin goce | `2026-09-17` | disponible **5** → tras envío **4** | **0 de 1** (+1 al enviar) · `sol_01KS06QVPZD80YPHV6QJVYBX2T` |

**Interpretación:** en el **mismo mes calendario**, cada artículo tiene su propio cupo mensual; 64-B no hereda el bloqueo de agosto de 64-A (F2-1b).

---

## Detalle F2-2 (64-B) — envío

| Campo | Valor |
|-------|--------|
| `articulo_id` | `art_01KRYEX0JZY4Y8J1GY3Q9F8BJQ` |
| `version_id` (piloto cfg) | `ver_01KRYEX13QN7VBPMFQFES1QHB4` |
| Fecha permiso (preview OK) | `2026-09-17` |
| Preview | 5 → 4, mes 0/1 |
| `solicitud_id` | `sol_01KS06QVPZD80YPHV6QJVYBX2T` (asignación por orden de prueba operador; validar `articulo_id` en Firestore si auditoría) |

---

## Cierre Fase 2 piloto (borrador)

| Criterio | Estado |
|----------|--------|
| F2-1 64-A ticketera + preview | **OK** |
| F2-2 64-B ticketera + preview + envío (2026-09) | **OK** | `sol_01KS06QVPZD80YPHV6QJVYBX2T` |
| F2-1c / F2-1e 64-A sept preview + envío | **OK** | `sol_01KS06Q8ZAS8ZVHQV4S122Q3F8` |
| Cupo mes independiente 64-A / 64-B | **OK** | F2-1c + F2-2 misma fecha 2026-09-17 |
| Piloto Fase 2 (shell + preview + envío A/B) | **OK** | Pendiente F2-3/F2-4 opcionales |
| Deploy Functions listado + preview | **OK** |
| Deploy Hosting (prod) | Pendiente si solo local |

Cuando F2-2 esté **OK**, actualizar [`PLAN_TICKETERA_SLICE_64B_V2.md`](./PLAN_TICKETERA_SLICE_64B_V2.md) §3 fila B1 con referencia a este doc.
