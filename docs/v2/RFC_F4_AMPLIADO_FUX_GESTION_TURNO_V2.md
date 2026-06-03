# RFC F4 ampliado — Outbox gestión turno del día (F-UX.3)

**Estado:** aprobado producto 2026-06-03 · **amendment Flujo B** 2026-06-03 (§3.2 B-N5…B-N7) · implementación por fases  
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

**Compatibilidad:** el normalizador en `cambiosTurno.js` acepta `payload` anidado o campos planos legacy (MVP una fecha).

**Batch consolidado (B-BATCH-1 + A-BATCH):** la normalización v2 de `reemplazo` (dos fechas, multi-tramo) y `cobertura_parcial` (swap bilateral) se implementará **en una sola fase backend** cuando las UIs A/B/C vuelquen el contrato §3 al outbox. Hasta entonces, outbox + preview UI son la fuente de verdad operativa; «Aplicar cambios» puede seguir en MVP legacy para ops de una sola fecha.

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

Traslado origen → destino (mismo mes); **aditivo** en destino (no pisar segmentos ya presentes); origen con **franco total o saldo parcial** según tramos quitados.

#### Payload v2 (contrato outbox → batch)

```json
{
  "tipo": "reemplazo",
  "motivo": "Traslado por reunión institucional",
  "expectedVersionToken": "ISO",
  "grupoId": "gdt_…",
  "periodo": "2026-06",
  "payload": {
    "persona_id": "per_…",
    "fecha_origen": "2026-06-16",
    "fecha_destino": "2026-06-17",
    "segmentos_a_trasladar": ["cfg_reg_turno_n"],
    "segmentos_incorporados_destino": ["cfg_reg_turno_m"],
    "turno_id_destino": "cfg_reg_turno_m",
    "franco_en_origen": false,
    "origen_op_ref": "uuid-op-outbox"
  }
}
```

Ejemplo multi-tramo con compuesto régimen (M+T+N):

```json
{
  "segmentos_a_trasladar": ["cfg_reg_turno_m", "cfg_reg_turno_t", "cfg_reg_turno_n"],
  "segmentos_incorporados_destino": ["cfg_reg_turno_m", "cfg_reg_turno_t", "cfg_reg_turno_n"],
  "turno_id_destino": "cfg_reg_turno_m+cfg_reg_turno_t+cfg_reg_turno_n",
  "franco_en_origen": true
}
```

#### Campos

| Campo | Uso |
|-------|-----|
| `fecha_origen` | Día del que se **quitan** tramos |
| `fecha_destino` | Día al que se **incorporan** tramos (puede ser igual a origen — ver B-N5) |
| `segmentos_a_trasladar` | Ids régimen simples a quitar del origen (≥1) |
| `segmentos_incorporados_destino` | **SSoT** de lo que se suma en destino; longitud = `segmentos_a_trasladar.length` |
| `turno_id_destino` | Id **wire** para batch/materialización: compuesto del régimen si existe para ese conjunto exacto; si no, primer id de `segmentos_incorporados_destino` |
| `franco_en_origen` | `true` **solo si** no queda ningún tramo teórico en origen tras quitar `segmentos_a_trasladar`; si queda saldo (ej. M+T tras quitar N), `false` |
| `origen_op_ref` | Id op outbox para auditoría B-N4 (opcional en UI, recomendado) |

#### Reglas de negocio (producto cerrado)

| Id | Regla |
|----|--------|
| **B-N1** | Preview acumulado: validar contra grilla destino + ops pendientes del mismo `persona_id` y `fecha_destino`. |
| **B-N2** | Tope **24 h**/día en destino tras aplicar preview. |
| **B-N3** | Destino en feriado: persiste flag feriado en registro; celda mantiene color feriado. |
| **B-N4** | Auditoría franco/saldo origen: motivo obligatorio + `origen_op_ref` recomendado (sin nuevo `cfg_*` motivo franco). |
| **B-N5** | **Corrimiento intra-día:** `fecha_origen === fecha_destino` **permitido** (caso hospitalario: reubicar tramos dentro del mismo día). **Rechazar** si `segmentos_a_trasladar` y `segmentos_incorporados_destino` son el **mismo conjunto** (noop). UI: aviso informativo mientras el preview muestre cambio neto. |
| **B-N6** | **Destino multi-tramo:** cantidad destino = cantidad origen. Combinación **libre** entre simples incorporables del régimen (**sin exigir contigüidad** — ej. M+N válido). Contigüidad solo afecta si el régimen define un `turno_id` compuesto para ese conjunto exacto (M+T, T+N, M+T+N…). |
| **B-N7** | Colisión: ningún id en `segmentos_incorporados_destino` puede estar ya presente en destino (capa + borradores). |

#### Validación UI (implementación referencia)

- Colisión por tramo (B-N7), no solo por `turno_id_destino` único.
- Anti-noop mismo día (B-N5).
- `franco_en_origen` calculado, no constante.

#### Mapper y batch

| Contexto | Comportamiento |
|----------|----------------|
| **Outbox UI (fase actual)** | Payload §3.2 completo; `fecha` redundante = `fecha_destino`. |
| **Mapper legacy (transición)** | Si falta `fecha_destino`, `fecha` = `fecha_origen` (corrimiento mismo día MVP). |
| **Batch v2 (B-BATCH-1, pendiente)** | Normalizar dos fechas; aplicar quita en origen + suma en destino; rematerializar **ambas** celdas; respetar `franco_en_origen` y `segmentos_incorporados_destino[]`. |

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
| 3 | Flujo B + preview + outbox §3.2 | §3.2 (UI ✅; batch B-BATCH-1 diferido) |
| 4 | Flujo A UI + outbox §3.1 | §3.1 (batch A-BATCH diferido) |
| 5 | Flujo C | §3.3 |
| 6 | Batch consolidado B-BATCH-1 + A-BATCH | §2, §3.1, §3.2 |
| 7–9 | Ayuda, banner, QA apply | — |

---

## 6. Verificación

```bash
npm run test:batch-asistencia-normalize
```

Tras ampliar backend: tests nuevos para payload v2 A/B/C.
