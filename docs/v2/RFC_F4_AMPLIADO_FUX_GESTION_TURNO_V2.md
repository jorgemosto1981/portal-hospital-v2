# RFC F4 ampliado — Outbox gestión turno del día (F-UX.3)

**Estado:** aprobado producto 2026-06-03 · implementación por fases  
**Tag spec:** `v2.4.0-pre-fux-gestion-turno-spec`  
**Handoff:** [`HANDOFF_SESION_2026-06-02_PAUSA_FUX_GESTION_TURNO_DIA.md`](./HANDOFF_SESION_2026-06-02_PAUSA_FUX_GESTION_TURNO_DIA.md)  
**Base:** [`RFC_CACHE_LOCAL_ASISTENCIA_V2.md`](./RFC_CACHE_LOCAL_ASISTENCIA_V2.md)

---

## 1. Envelope outbox (sin cambio)

| Campo | Descripción |
|-------|-------------|
| `editorPersonaId` | `per_*` del editor |
| `periodo` | `YYYY-MM` |
| `ops[]` | Cola local |
| `id` | UUID por op → `temp_id` en batch |
| `creado_en` | ISO |

Cada op incluye además (UI → batch mapper):

- `tipo` — `cobertura_parcial` | `reemplazo` | `adicional`
- `grupoId` — `gdt_*`
- `periodo` — redundante con envelope
- `expectedVersionToken` — concurrencia `vis_*`
- `motivo` — ≥3 caracteres (todos los tipos)
- `payload` — forma v2 según §3

---

## 2. Batch wire format (envío a `aplicarBatchAsistencia`)

```json
{
  "editor_persona_id": "per_…",
  "periodo": "2026-06",
  "ops": [
    {
      "id": "uuid",
      "tipo": "cobertura_parcial",
      "creado_en": "ISO",
      "concurrencia": { "expected_version_token": "ISO" },
      "context": { "grupo_id": "gdt_…", "periodo": "2026-06" },
      "payload": { }
    }
  ]
}
```

**Compatibilidad:** el normalizador en `cambiosTurno.js` acepta `payload` anidado o campos planos legacy (MVP una fecha). F-UX.3 fase backend ampliará normalización según §3.

---

## 3. Payloads v2 por flujo

### 3.1 A — `cobertura_parcial` (Intercambio de guardia)

Swap bilateral; **dos fechas**; emparejamiento parcial de segmentos; misma carga horaria.

```json
{
  "tipo": "cobertura_parcial",
  "motivo": "Intercambio acordado con guardia pediátrica",
  "expectedVersionToken": "ISO",
  "grupoId": "gdt_…",
  "periodo": "2026-06",
  "payload": {
    "origen": {
      "persona_id": "per_XX",
      "fecha": "2026-06-05",
      "segmentos_cedidos": ["M"]
    },
    "destino": {
      "persona_id": "per_YY",
      "fecha": "2026-06-12",
      "segmentos_cedidos": ["T"]
    },
    "tipo_compensacion_id": "cfg_tcc_01KSN4ZJPJZ6H3ARPEX750YBTH"
  }
}
```

| Regla | Detalle |
|-------|---------|
| `tipo_compensacion_id` | Default **`cfg_tcc` → CAMBIO_INTERNO** (`seed-ids-asistencia-turnos.v2.json`) |
| Concurrencia | Tokens de **origen.fecha** y **destino.fecha** (fase backend: dos asserts o op compuesta) |
| Post-batch | Rematerializar XX@fecha₁, YY@fecha₂ |

**Mapper legacy (transición):** si solo hay campos planos `persona_origen_id`, `fecha`, `segmentos_cubiertos` → tratar como MVP mismo día (hasta backend v2).

---

### 3.2 B — `reemplazo` (Cambio de turno propio)

Traslado origen → destino; segmentos inmutables en destino; origen → franco auditado.

```json
{
  "tipo": "reemplazo",
  "motivo": "Traslado por reunión institucional",
  "expectedVersionToken": "ISO",
  "grupoId": "gdt_…",
  "periodo": "2026-06",
  "payload": {
    "persona_id": "per_…",
    "fecha_origen": "2026-06-10",
    "fecha_destino": "2026-06-15",
    "segmentos_a_trasladar": ["M"],
    "turno_id_destino": "N",
    "franco_en_origen": true,
    "origen_op_ref": null
  }
}
```

| Campo | Uso |
|-------|-----|
| `segmentos_a_trasladar` | Ids régimen (M/T/N…); compuesto: subconjunto |
| `turno_id_destino` | Segmento a **incorporar** en destino (no pisar ids existentes) |
| `franco_en_origen` | Siempre `true` en producto cerrado |
| `origen_op_ref` | Id op outbox para auditoría B-N4 (opcional en UI, recomendado) |

**Validación UI (preview acumulado B-N1):**

- Colisión: `turno_id_destino` ∉ segmentos ya en destino (caché + ops pendientes).
- Tope **24 h**/día en destino tras aplicar preview.

**Mapper legacy:** `fecha` = `fecha_origen` si falta `fecha_destino` (corrimiento mismo día).

---

### 3.3 C — `adicional` (Horas adicionales)

Registro declarativo; **sin** `horas_efectivas` en alta jefe (C-N1).

```json
{
  "tipo": "adicional",
  "motivo": "Refuerzo guardia pediátrica",
  "expectedVersionToken": "ISO",
  "grupoId": "gdt_…",
  "periodo": "2026-06",
  "payload": {
    "persona_id": "per_…",
    "fecha": "2026-06-08",
    "turno_id": "N",
    "es_feriado": false
  }
}
```

| Regla | Detalle |
|-------|---------|
| `turno_id` | Obligatorio; **≠** teórico del día si existe teórico laborable |
| `horas_efectivas` | **null** / omitido en alta; RRHH usa fichadas en fase 2 |
| `es_feriado` | Persistir flag calendario si el día es feriado (B-N3 registro) |

---

## 4. Callable auxiliar — materializar celda

| Callable | `materializarTurnoTeoricoDia` |
|----------|--------------------------------|
| Input | `persona_id`, `fecha` (YYYY-MM-DD), `grupo_trabajo_id` |
| Efecto | Capa teórica segmentada en `asi_*` para ese `gdt` |
| UI | Gate «Calcular turno de este día» (Entregable 1) |

---

## 5. Orden implementación ↔ RFC

| Fase | Entregable | RFC |
|------|------------|-----|
| 1 | Shell + gate + materializar celda | §4 |
| 2 | Wizard A/B/C paso 1 | — |
| 3 | Flujo B + preview | §3.2 |
| 4 | Flujo A | §3.1 + backend swap |
| 5 | Flujo C | §3.3 |
| 6–8 | Ayuda, banner, QA | — |

---

## 6. Verificación

```bash
npm run test:batch-asistencia-normalize
```

Tras ampliar backend: tests nuevos para payload v2 A/B/C.
