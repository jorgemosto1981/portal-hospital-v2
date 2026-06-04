# RFC — Caché local + envío batch asistencia (F4)

**Estado:** borrador operativo — código parcial en rama `feat/epic-multi-hlg-fase1-execution`  
**Prerequisito:** F3 cerrada (`v2.3.0-f3-turnos-compuestos`)  
**Ampliación F-UX.3:** [`RFC_F4_AMPLIADO_FUX_GESTION_TURNO_V2.md`](./RFC_F4_AMPLIADO_FUX_GESTION_TURNO_V2.md)  
**Registro implementación:** [`REGISTRO_FASE_DOCUMENTAL_FUX_GESTION_TURNO_V3.md`](./REGISTRO_FASE_DOCUMENTAL_FUX_GESTION_TURNO_V3.md)  
**Relación:** [`EPIC_CACHE_LOCAL_ASISTENCIA_V2.md`](./EPIC_CACHE_LOCAL_ASISTENCIA_V2.md) · [`CAPA_TEORICA_SEGMENTOS_V2.md`](./CAPA_TEORICA_SEGMENTOS_V2.md)

---

## 1. Objetivo

Permitir **ediciones locales** en grilla (outbox RAM + `localStorage`) y **envío consolidado** al backend sin reescribir documentos `asi_*` completos. Tras el batch, materializar **solo días afectados**.

---

## 2. Nombre del callable (F4.2)

| Roadmap | Implementación actual |
|---------|----------------------|
| `enviarAccionesAsistencia` | **`aplicarBatchAsistencia`** (`functions/modules/asistencia/cambiosTurno.js`) |

Mismo contrato; no duplicar segundo callable salvo alias en `functions/index.js`.

---

## 3. Outbox local (F4.3 — parcial)

**Hook:** `web/src/features/grilla/useAsistenciaOutbox.js`

| Campo envelope | Descripción |
|----------------|-------------|
| `editorPersonaId` | Quien edita |
| `periodo` | `YYYY-MM` |
| `ops[]` | Cola pendiente |
| `createdAt` / `updatedAt` | TTL 24 h |

Cada op lleva `id` (UUID / `op_*`) = **`temp_id`** idempotente por intento de envío.

**UI:** `GrillaMesLicenciasPanel.jsx` — botón aplicar batch, toasts `ASI-CONC` / `ASI-PER` / `ASI-GSO`.

---

## 4. Payload batch → backend

```json
{
  "ops": [
    {
      "id": "uuid-op",
      "tipo": "cobertura_parcial",
      "persona_origen_id": "per_…",
      "persona_cobertura_id": "per_…",
      "grupo_trabajo_id": "gdt_…",
      "fecha": "YYYY-MM-DD",
      "segmentos_cubiertos": ["T"],
      "expected_version_token": "<vis.metadata.version_token ISO>",
      "motivo": "texto obligatorio"
    }
  ]
}
```

**MVP tipos soportados:** `cobertura_parcial`, `reemplazo`, `adicional`.

---

## 5. Reglas backend (implementadas)

| Regla | Código |
|-------|--------|
| Máx. 50 ops / batch | `[BATCH-005]` |
| Mismo período YYYY-MM | `[BATCH-006]` |
| Freeze período cerrado | `[ASI-PER-001]` — `estado_periodo_liquidacion_id === cfg_epl_liquidado_cerrado` |
| Concurrencia optimista | `[ASI-CONC-001]` — `expected_version_token` vs `vis_*.metadata.version_token` |
| Append overrides | `overrides_turno: [...current, ...extra]` — **no** `set` completo de capa |
| Post-batch | `rematerializarBatchOps` → días afectados (origen + cobertura) |

Smoke freeze: `scripts/smoke-outbox-freeze-dev.mjs` → `ASI-PER-001`.

---

## 6. Pendiente F4 (DoD incompleto)

| ID | Gap |
|----|-----|
| 4.3 | Outbox en pantallas GSO restantes (`GrillaOperativa` legacy aún directo a API) |
| 4.3 | Recuperación borrador UX en móvil (TTL / confirmación) |
| 4.2 | ~~Tipos `reemplazo`, `adicional`~~ | ✅ |
| 4.4 | ~~Rematerialización mes entero~~ | ✅ Solo día afectado en overrides/batch |
| — | Alias callable `enviarAccionesAsistencia` (opcional) |

---

## 7. Comandos verificación

```bash
npm run test:batch-asistencia-normalize
node scripts/smoke-outbox-freeze-dev.mjs
node scripts/smoke-outbox-batch-dev.mjs
npm run test:grilla-sanitize-gso
```
