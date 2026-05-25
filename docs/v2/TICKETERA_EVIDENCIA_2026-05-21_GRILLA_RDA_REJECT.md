# Evidencia — Rechazo grilla RDA en motor Patrón B (trigger)

**Fecha:** 2026-05-21  
**Deploy motor:** commit `325413c` · functions `onSolicitudArticuloPatronBOnCreate`, `previsualizarSolicitudPatronB`  
**Proyecto:** `portal-hospital-v2`

---

## 0. Prerrequisito de datos

| Verificación | Valor |
|--------------|--------|
| `depende_rda` en versión 64-A (`ver_01KRNKNBXNBFC9HZN7CZJGPRDH`) | **`true`** (habilitado 2026-05-21 para piloto operativo) |
| Día sin grilla (`asistencia_diaria` sin `capa_teorica` válida) | **`2026-12-25`** — sin doc `asi_per_01KR3HD24AMJ6YX3N7B3GPAZJ4_20261225` |

---

## 1. Protocolo de prueba (operador UI — opcional, mismo criterio)

| Paso | Acción | Resultado esperado |
|------|--------|-------------------|
| P1 | Login DNI **27667499** (`per_01KR3HD24AMJ6YX3N7B3GPAZJ4`) | Sesión agente |
| P2 | 64-A · fecha **2026-12-25** · grupo ancla Oficina PERSONAL | Preview: **GRILLA_NO_AUTORIZADA** |
| P3 | Enviar (si UI lo permite) | `cfg_esa_rechazada` · sin descuento |

**Script de verificación:**

```powershell
Set-Location "e:\web nueva\portal-hospital-v2"
node scripts/verificar-solicitud-patron-b-grilla.mjs sol_<ULID>
node scripts/probar-grilla-patron-b-motor.mjs 2026-12-25
```

---

## 2. Caso cerrado — trigger E2E (prod)

Alta en `solicitudes_articulo` en `cfg_esa_borrador` (Patrón B, contrato Bloque A) → **`onSolicitudArticuloPatronBOnCreate`** ejecutó `runPatronBAltaMotor` → rechazo antes de transacción de saldo.

| Campo | Valor |
|-------|--------|
| **`sol_id`** | **`sol_01KS51ZN44J3S70Q0J86C9T1FD`** |
| Titular | `per_01KR3HD24AMJ6YX3N7B3GPAZJ4` (DNI 27667499) |
| `fecha_desde` / `fecha_hasta` | `2026-12-25` |
| `grupo_trabajo_id_ancla` | `gdt_01KR3H81ENQK84ZK21EQWEQQXG` |
| Artículo | 64-A · `art_01KRNK10V10CH7W5M2W6V558GS` |
| `estado_solicitud_id` | **`cfg_esa_rechazada`** |
| `motor_codigos` | **`["GRILLA_NO_AUTORIZADA"]`** |
| `motor_descuento_aplicado` | **ausente / false** |
| `_debito_origen` | **ausente** |
| `motor_mensajes` | *Acción bloqueada: su servicio no registra una grilla horaria aprobada por la dirección para el período solicitado. Contacte a su jefatura.* |

### Saldo 64-A ciclo 2026 (`sal_2026_per_01KR3HD24AMJ6YX3N7B3GPAZJ4`)

| Momento | `consumido` | `disponible` |
|---------|-------------|--------------|
| Antes del alta | **4** | **2** |
| Después del trigger | **4** | **2** |

Bolsa: `bol_art_01KRNK10V10CH7W5M2W6V558GS_2026`.

### Motor aislado (misma fecha, sin escritura `sol_*`)

`node scripts/probar-grilla-patron-b-motor.mjs 2026-12-25` → `okGrilla: true`, código **`GRILLA_NO_AUTORIZADA`**.

---

## 3. Criterios de aceptación

- [x] Trigger deja `sol_*` en **`cfg_esa_rechazada`** con **`GRILLA_NO_AUTORIZADA`**
- [x] **Sin** `motor_descuento_aplicado` ni `_debito_origen`
- [x] Bolsa 64-A **sin** cambio `consumido` / `disponible`
- [x] Motor callable/trigger comparten `runPatronBAltaMotor` + `mdcGrillaHorariaGate`

---

## 4. Referencias

- Gate: `functions/modules/shared/mdcGrillaHorariaGate.js`
- Motor: `functions/modules/shared/solicitudPatronBAltaMotor.js`
- Handoff: [`HANDOFF_SESION_2026-05-21_BLOQUE_A_Y_CONTINUIDAD.md`](./HANDOFF_SESION_2026-05-21_BLOQUE_A_Y_CONTINUIDAD.md) § B
