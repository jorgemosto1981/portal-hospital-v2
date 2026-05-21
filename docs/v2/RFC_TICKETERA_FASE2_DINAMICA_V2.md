# RFC — Ticketera Fase 2 (dinámica + rendimiento)

**Estado:** **implementado (P0 + wizard UI)** · **2026-05-21**  
**Plan:** [`PLAN_TICKETERA_V2.md`](./PLAN_TICKETERA_V2.md) § Fase 2 · **Visión:** [`CONCEPTO_TICKETERA_BANDEJA_DINAMICA_V2.md`](./CONCEPTO_TICKETERA_BANDEJA_DINAMICA_V2.md)

---

## 1. Objetivo

Unificar contrato de **listado elegible**, **fechas impuestas** y **preview** sin escanear todo `cfg_articulos` en cada request.

---

## 2. Callable `listarArticulosIngresoAgente`

### 2.1 Entrada

| Campo | Tipo | Obligatorio |
|-------|------|-------------|
| `fecha_desde` | `YYYY-MM-DD` | sí |

Auth: agente con `persona_id`, `isPortalRoleUsuario` (HL completa).

### 2.2 Salida (enriquecida Fase 2)

```json
{
  "persona_id": "per_…",
  "fecha_desde": "2026-05-19",
  "articulos": [
    {
      "articulo_id": "art_…",
      "version_id": "ver_…",
      "codigo_grilla": "64-A",
      "nombre": "…",
      "patron_saldo": "B",
      "dias_solicitados": 1,
      "fecha_hasta": "2026-05-19"
    }
  ],
  "elegibilidad_vacia": { "codigos": [], "mensajes": [] }
}
```

`elegibilidad_vacia` solo si `articulos` está vacío y hubo al menos un rechazo de elegibilidad en candidatos evaluados (misma semántica MVP).

### 2.3 Carga de candidatos (P0)

| Modo | Cuándo | Lecturas Firestore (orden de magnitud) |
|------|--------|----------------------------------------|
| **Whitelist MVP** | `ARTICULO_IDS_MVP.length > 0` (hoy) | `2 × |MVP|` paralelo: doc artículo + query versión publicada |
| **Catálogo Patrón B** | `TICKETERA_LISTAR_TODOS_PATRON_B=1` o lista MVP vacía (Fase 2.5) | 1× `collectionGroup("versiones")` filtrado por `estado_version_id` + `getAll` en chunks de 10 |

Implementación: `functions/modules/shared/listarArticulosIngresoCore.js`, IDs en `ticketeraArticulosMvp.js`, helper `firestoreGetAllChunked.js`.

**Prohibido en hot path:** `cfg_articulos.get()` sin filtro · scan sin `where` en collection group.

**Índice Firestore:** query `collectionGroup("versiones").where("estado_version_id")` usa índice de campo único (auto por consola); no requiere entrada compuesta en `firestore.indexes.json`.

### 2.4 Reglas `dias_solicitados` / `fecha_hasta`

- `dias_solicitados` ← `bloque_topes_plazos_computo.tope_dias_por_evento` (default 1).
- `fecha_hasta` ← `patronBFechasSolicitud.fechaHastaDesdeVersionPatronB` (MVP: 1 día ⇒ igual a `fecha_desde`).
- UI: **solo lectura**; el alta Patrón B sigue validando en motor (`fecha_hasta === fecha_desde` para evento 1 día).

---

## 3. Callable preview (Fase 2.4 — implementado)

**Nombre propuesto:** `previsualizarSolicitudPatronB`

| Campo | Tipo |
|-------|------|
| `articulo_id`, `version_id`, `fecha_desde`, `dias_solicitados` | obligatorios |

**Salida:** `{ ok, codigos[], mensajes[], fecha_hasta, saldo_* }` — ejecuta elegibilidad + topes mes/ciclo **sin** escribir `sol_*`. Reutilizar `runPatronBAltaMotor` en modo dry-run o extraer validadores compartidos con el trigger.

Referencia LAO: `simularLaoPreview`.

---

## 4. UI agente (oleadas)

| Oleada | Entrega |
|--------|---------|
| 2.2 | `TicketeraPatronB` + `SolicitudPatronBForm` wizard 3 pasos · auto-avance si 1 artículo |
| 2.3 | `fecha_hasta` RO + `dias_solicitados` desde listado (paso 2) |
| 2.4 | Paso 3: Previsualizar explícito → callable §3 → Confirmar envío |

---

## 5. Menú / provider

`ArticulosIngresoProvider` y `MODULOS_PORTAL` siguen usando el mismo callable a **fecha hoy**; benefician del P0 sin cambio de contrato (campos nuevos ignorables en cliente antiguo).

---

## 6. Pruebas

- Piloto DNI 28914247: listado 64-A + 64-B, tiempos < 2 s en red normal.
- T2 escalafón: listado vacío + `elegibilidad_vacia` si aplica.
- Tras deploy Functions: `node scripts/diagnostico-listar-64a.mjs --dni=…`

---

## 7. Archivos

| Archivo | Rol |
|---------|-----|
| `listarArticulosIngresoCore.js` | Lógica listado + discovery |
| `ticketeraArticulosMvp.js` | Whitelist MVP |
| `patronBFechasSolicitud.js` | Cálculo fechas/días lectura |
| `listarArticulosIngresoAgente.js` | onCall delgado |
