# Ticketera Fase 3 — Evidencia piloto bandeja jefe

**Fecha:** 2026-05-19  
**Revisor RRHH/jefe piloto:** DNI **28914247** · `per_01KQN9WXFXF69Z9DCT5YNJ3TFZ`

---

## J2 — Aprobar desde bandeja (OK)

| Campo | Valor |
|-------|--------|
| `solicitud_id` | `sol_01KS0896610NA49M9G6VABMMEK` |
| Alta agente (toast UI) | «Solicitud aceptada (…). Estado: en revisión por jefe.» — esperado tras envío Patrón B |
| Acción bandeja | **Aprobar** por sesión DNI **28914247** (modo RRHH) |
| Estado esperado post-aprobación | `cfg_esa_en_revision_rrhh` |
| Campos auditoría esperados | `jefe_revision_persona_id` = `per_01KQN9WXFXF69Z9DCT5YNJ3TFZ`, `jefe_revision_en`, `jefe_motivo` (si se cargó) |

**Verificación Firestore (2026-05-19):** `solicitudes_articulo/sol_01KS0896610NA49M9G6VABMMEK`

| Campo | Valor |
|-------|--------|
| `estado_solicitud_id` | `cfg_esa_en_revision_rrhh` |
| `jefe_revision_persona_id` | `per_01KQN9WXFXF69Z9DCT5YNJ3TFZ` (DNI 28914247) |
| `jefe_revision_en` | 2026-05-19 ~10:55 ART |
| `titular_persona_id` | `per_01KR3HD24AMJ6YX3N7B3GPAZJ4` (= `actor_alta_persona_id`) |
| `articulo_id` | `art_01KRNK10V10CH7W5M2W6V558GS` (64-A) |
| `fecha_desde` / `fecha_hasta` | `2026-05-19` · `dias_solicitados` 1 |
| `motor_descuento_aplicado` | `true` · `motor_dias_descontados` 1 |
| `motor_bolsa_id` | `bol_art_01KRNK10V10CH7W5M2W6V558GS_2026` |
| `debito_origen[0]` | `anio_origen` 2026, misma `bolsa_id`, `dias` 1 |
| `patron_saldo` | `B` |
| `jefe_motivo` | `null` (sin observación) |

Ciclo coherente: descuento al alta → jefe aprueba **sin** reverso (saldo sigue consumido hasta RRHH/cierre).

---

## J3 — Rechazar desde bandeja + reverso saldo (OK)

**Artículo:** 64-B · `art_01KRYEX0JZY4Y8J1GY3Q9F8BJQ` · bolsa `bol_art_01KRYEX0JZY4Y8J1GY3Q9F8BJQ_2026`

| Campo | Valor |
|-------|--------|
| `estado_solicitud_id` | `cfg_esa_rechazada` |
| `jefe_revision_persona_id` | `per_01KQN9WXFXF69Z9DCT5YNJ3TFZ` (DNI 28914247) |
| `jefe_motivo` | `rechazado porque si` |
| `jefe_revision_en` | 2026-05-19 ~11:02 ART |
| `titular_persona_id` | `per_01KQN9WXFXF69Z9DCT5YNJ3TFZ` (solicitud propia piloto) |
| `motor_descuento_aplicado` | `true` (descuento al alta ~08:50) |
| `motor_reverso_jefe_aplicado` | **`true`** — reverso Patrón B al rechazar |
| `debito_origen[0]` | `anio_origen` 2026, `dias` 1, misma `bolsa_id` |
| `fecha_desde` / `fecha_hasta` | `2026-05-19` |

**Saldos (`saldos_articulo_agente`):** operador confirmó que la bolsa **64-B 2026** del titular refleja bien el reverso (`disponible` / `consumido`) tras rechazo — **OK**.

*(Pegar `solicitud_id` en consola cuando lo tengas para trazabilidad completa.)*

---

## Nota sobre mensajes UI

| Momento | Mensaje | Significado |
|---------|---------|-------------|
| Agente envía solicitud | «Solicitud aceptada … en revisión por jefe» | Alta OK; queda pendiente de jefe |
| Jefe pulsa Aprobar | «Derivada a revisión RRHH.» (toast bandeja) | Pasa a cola RRHH |

No confundir el toast del **ingreso** con el del **jefe**.
