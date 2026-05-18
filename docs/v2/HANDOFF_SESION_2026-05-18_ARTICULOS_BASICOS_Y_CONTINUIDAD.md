# Handoff — Artículos básicos operativos + continuidad post check-in

**Fecha:** 2026-05-18 (continuación tras cierre epic check-in)  
**Rama:** `feature/ticketera-puente-campos-config`  
**Firebase:** `portal-hospital-v2`  
**Piloto RRHH:** `per_01KQN9WXFXF69Z9DCT5YNJ3TFZ` (DNI 28914247)

**Relación:** [`ARTICULOS_BASICOS_OPERATIVOS_V2.md`](./ARTICULOS_BASICOS_OPERATIVOS_V2.md) · [`HANDOFF_SESION_2026-05-18_CHECKIN_SALDOS.md`](./HANDOFF_SESION_2026-05-18_CHECKIN_SALDOS.md) · [`HANDOFF_SESION_2026-05-13_TICKETERA.md`](./HANDOFF_SESION_2026-05-13_TICKETERA.md)

---

## 1. Registro de lo hecho (esta tanda)

### Epic check-in saldos A/B/C + guía alta RRHH

| Ámbito | Estado |
|--------|--------|
| Oleadas 1–3 (UI, callables, lote B/C, búsqueda personas) | **Hecho** — commits `ad86cbf`, `4dc09f2` |
| Refactor hooks (#21) | **Hecho** — `74e100e`, `f90ee57` |
| Deploy Functions | **OK** 2026-05-18 |
| Fase A documental epic | **Hecho** — commit `8744e4f` (matriz, handoffs, contrato #24) |
| Cierre global + rectificación LAO | **Probado** en piloto (sesiones previas + 18/05) |

### Catálogo básico operativo (acordado RRHH)

Cuatro artículos cubren **patrones A, B y C** para check-in y base ticketera:

| Artículo | Patrón | `articulo_id` |
|----------|--------|---------------|
| LAO | A | `art_01KRNYDN5WR7RER7MWXRZ817E7` |
| 64-A (con goce) | B | `art_01KRNK10V10CH7W5M2W6V558GS` |
| 64-B (sin goce) | B | `art_01KRYEX0JZY4Y8J1GY3Q9F8BJQ` |
| 68-B compensatorio | C | `art_01KRYEF39ZM0KB0F0Y4GPBH38F` |

**Decisión de producto:** 64-B es **artículo nuevo** (`art_*` distinto de 64-A), no versión del mismo inciso.

Detalle de versiones publicadas y parámetros: [`ARTICULOS_BASICOS_OPERATIVOS_V2.md`](./ARTICULOS_BASICOS_OPERATIVOS_V2.md).

### Validación en BD (piloto, 2026-05-18)

| Prueba | Resultado |
|--------|-----------|
| 68-B — guardado/rectificación pestaña **C** | OK — `sal_global_per_…`, bolsa `bol_art_01KRYEF39…_global`, 100 h; toast rectificación C |
| 64-A + 64-B — pestaña **B** mismo ciclo A | OK — `sal_2026_per_…`, dos bolsas: cupo 6, consumido 1, disponible 5 c/u; `es_arrastre: false` |
| LAO — años &lt; A | OK en sesiones previas (2024/2025, etc.) |
| Script inspección patrón | `scripts/inspect-articulo-version-checkin.mjs` |

### Documentación y UX creados (parte sin commit aún)

| Artefacto | Ruta |
|-----------|------|
| Catálogo básico | `docs/v2/ARTICULOS_BASICOS_OPERATIVOS_V2.md` |
| Guía operativa check-in | `docs/v2/GUIA_OPERATIVA_CHECKIN_SALDOS_RRHH.md` |
| Guía alta 68-B | `docs/v2/GUIA_ALTA_ARTICULO_68B_COMPENSATORIO_V2.md` |
| Modal ayuda (botón **i**) | `web/src/features/checkinSaldos/checkinSaldosAyudaRrhh.js`, `CheckinSaldosAyudaModal.jsx` |
| Integración página | `web/src/pages/CheckinSaldosAgente.jsx` (modificado) |

### Git (al cerrar sesión doc)

- Remoto: rama **ahead 1** respecto a `origin` (commit `8744e4f` local pendiente de push o ya parcial).
- **Sin commitear:** docs anteriores + ayuda UI + script inspect + `docs/v2/README.md`.

---

## 2. Matriz de pruebas — avance parcial

Ejecución formal pendiente; en piloto ya cubierto en parte:

| Bloque | Avance piloto | Pendiente |
|--------|---------------|-----------|
| A (agente sin historial) | Parcial | Agente limpio end-to-end |
| B (precarga / rectificación) | **B2–B3** con 64-A/B/C y LAO | Toast una vez, más personas |
| C (cierre global previo) | Cierre probado antes | Re-ejecutar C1–C3 en matriz |
| D (combobox / URL) | Uso habitual | Marcar D1–D3 |
| E (guía alta) | No marcado | E1–E4 |
| F (errores) | Rectificación LAO orientada | F1–F3 |
| G (Vitest) | — | `npm test -- --run checkinOleada2` |
| **H** (artículos básicos) | Ver [`CHECKIN_SALDOS_MATRIZ_PRUEBAS.md`](./CHECKIN_SALDOS_MATRIZ_PRUEBAS.md) § H | Ticketera solicitudes |

---

## 3. Cómo continuar (propuesta ordenada)

### Paso 0 — Cerrar registro en repo (15 min)

1. Revisar diff local (docs + ayuda + script).
2. **Commit** sugerido: `docs(check-in): catálogo artículos básicos, guías RRHH y ayuda modal`
3. **Push** rama `feature/ticketera-puente-campos-config`.

### Paso 1 — Cerrar validación check-in (1–2 h)

1. Ejecutar matriz **A–E** en entorno acordado (local o hosting).
2. Marcar OK/Falla en [`CHECKIN_SALDOS_MATRIZ_PRUEBAS.md`](./CHECKIN_SALDOS_MATRIZ_PRUEBAS.md).
3. Correr **G1** Vitest `checkinOleada2`.
4. Si todo OK → epic check-in **cerrado operativamente** (no solo en código).

### Paso 2 — Ticketera con artículos básicos (siguiente epic lógico)

Seguir [`HANDOFF_SESION_2026-05-13_TICKETERA.md`](./HANDOFF_SESION_2026-05-13_TICKETERA.md):

| Prioridad | Tarea |
|-----------|--------|
| **T1** | Solicitud **64-A** — consumo bolsa Patrón B, cupo/mes/evento |
| **T2** | Solicitud **64-B** — misma bolsa ciclo, `es_sin_goce` / justificación |
| **T3** | Solicitud **68-B** — horas, Patrón C global |
| **T4** | Solicitud **LAO** — FIFO por año bolsa (ya probado en smoke previo; regresión) |
| Config | Completar campos puente artículo ↔ ticket (`circuito_ingreso_ids`, etc.) |

### Paso 3 — Configurador (ampliación catálogo)

- Altas **fuera** del básico según plan hospital (licencias médicas, exámenes, otros incisos).
- Cada uno: **nuevo** `art_*` + versión publicada; guía tipo 68-B solo si el patrón/unidad difiere.
- Opcional: `GUIA_ALTA_ARTICULO_64B_SIN_GOCE_V2.md` (checklist `es_sin_goce`, clon parametrización 64-A).

### Paso 4 — Backlog no bloqueante

| Ítem | Doc |
|------|-----|
| Panel agente «Mis saldos» | RFC § D3 |
| #23 smoke B/C ampliado | `CHECKIN_SALDOS_BACKLOG.md` |
| #24 precarga whitelist | Contrato en backlog — futuro |
| Job cierre ciclo Patrón B | Caso borde 7 |

---

## 4. Comandos útiles

```bash
# Inspeccionar patrón de versión publicada
node scripts/inspect-articulo-version-checkin.mjs <articulo_id> <version_id>

# Tests check-in
cd web && npm test -- --run checkinOleada2

# Deploy functions tras cambios shared
npm run firebase:deploy:functions
```

---

## 5. Criterio de “listo para ticketera piloto”

- [ ] Matriz A–E sin fallas bloqueantes
- [ ] Catálogo básico commiteado y enlazado en README
- [ ] Al menos **una solicitud OK** por 64-A y 64-B en piloto
- [ ] 68-B: solicitud o movimiento que descuente horas en `sal_global_per_*`
- [ ] Documentar IDs de ticket de prueba en handoff ticketera

**Siguiente sesión recomendada:** Paso 0 (commit) → Paso 1 (matriz) → Paso 2 T1/T2.
