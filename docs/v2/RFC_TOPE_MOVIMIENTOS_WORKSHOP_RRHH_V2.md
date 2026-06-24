# Workshop RRHH — Tope de movimientos (gestión de turno)

> **RFC técnico:** [`RFC_BORRADOR_TOPE_MOVIMIENTOS_GESTION_TURNO_V2.md`](./RFC_BORRADOR_TOPE_MOVIMIENTOS_GESTION_TURNO_V2.md)  
> **Gate técnico:** ✅ Épica B · `[BATCH-LIM-001]` en prod (`2525ae5`, dormido hasta D6)  
> **Estado:** ✅ **Ratificado RRHH / piloto** — acta **2026-06-23**

---

## Acta de ratificación

| Campo | Valor |
|--------|--------|
| **Fecha acta** | 2026-06-23 |
| **Ámbito** | GSO piloto — gestión turno (traslado v2 + intercambio v2) |
| **Implementación** | Desplegada; activación por `TOPE_MOVIMIENTOS_VIGENTE_DESDE` |
| **Ajuste vs simulacro técnico** | **D3:** bypass de excepción **solo RRHH** (no jefe de sala) |

### Decisiones ratificadas (D0–D7)

| # | Decisión | Detalle RRHH |
|---|----------|----------------|
| **D0** | Por **tramo** × día × persona × gdt | Máx. 2 por M, por T, por N (hasta 6/día si M+T+N). |
| **D1** | **2** movimientos | 1 corrección + 1 cambio; 3.º bloqueado. |
| **D2** | **Bloqueo duro** | Sin advertencia blanda. |
| **D3** | Bypass **solo RRHH** | Motivo obligatorio + auditoría en override. |
| **D4** | Intercambio **+1 por agente/tramo** | Swap típico = 2 incrementos. |
| **D5** | v1: traslado v2 + intercambio v2 | Sin adicional/reemplazo clásico. |
| **D6** | Historial **post-activación** | **2026-07-01 00:00 ART** (`2026-07-01T03:00:00.000Z`). Sin retroactivo jun-2026. |
| **D7** | Mensaje usuario | Ver abajo. |

### Mensaje usuario (D7)

*«Límite de movimientos excedido para este tramo (máx. 2 por día). Contacte a RRHH para solicitar una excepción.»*

---

## Guía de reunión (referencia)

1. **Por qué:** proteger integridad de grilla ante cadenas abusivas; caso legítimo CHAPARRO d25→26 (3 tramos) sigue permitido.
2. **Qué:** ratificar tabla anterior.
3. **Cuándo:** contador desde **1 jul 2026** (no penaliza QA de junio).
4. **Excepciones:** únicamente RRHH con motivo auditado.

---

## Anexo — casuísticas (D0-A + D1=2)

| Caso | Resultado esperado |
|------|---------------------|
| CHAPARRO d25→26 (M, T, N) | No bloquea al 3.er batch si son tramos distintos. |
| Ida y vuelta mismo tramo mismo día | 3.º movimiento → `[BATCH-LIM-001]`. |
| Intercambio bilateral | +1 por persona/tramo (D4). |
| Cadena N→franco→M | Cuenta movimientos en overrides, no estado final. |

---

## Post-acta (operación)

| Paso | Estado |
|------|--------|
| Código `[BATCH-LIM-001]` | ✅ `2525ae5` |
| Config `TOPE_MOVIMIENTOS_VIGENTE_DESDE` | ✅ `2026-07-01T03:00:00.000Z` en repo |
| Deploy functions (re-sync config) | ✅ 2026-06-23 (functions + hosting) |
| Deploy hosting (toast D7) | ✅ `index-BSFCEpNO.js` |
| UI bypass RRHH (modales traslado + intercambio) | ✅ web — `bypass_tope_movimientos` + `motivo_bypass_tope` en batch |
| Observación piloto 1 semana | Tras 01/07 |

---

## Criterios de éxito piloto

- Sin falsos positivos en traslados legítimos (parcial, d25→26).
- 3.er movimiento del **mismo tramo/día** bloqueado con mensaje D7.
- Excepciones **solo RRHH**, auditadas en override.
