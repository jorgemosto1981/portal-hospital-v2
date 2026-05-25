# Evidencia — snapshot `grupos_trabajo_involucrados_ids` (multigrupo)

**RFC:** [`RFC_SOLICITUD_GRUPOS_TRABAJO_INVOLUCRADOS_V2.md`](./RFC_SOLICITUD_GRUPOS_TRABAJO_INVOLUCRADOS_V2.md)  
**Fecha:** 2026-05-23  
**Código:** `solicitudGrupoTrabajoAncla.js`, triggers LAO + Patrón B.

---

## Checklist piloto multigrupo (manual)

**Titular piloto:** DNI `28914247` · `per_01KQN9WXFXF69Z9DCT5YNJ3TFZ` (varios HLg vigentes).

| Paso | Acción | Esperado |
|------|--------|----------|
| 1 | Wizard LAO: elegir `grupo_trabajo_id_ancla` distinto al segundo grupo vigente | Alta OK → `cfg_esa_en_revision_jefe` |
| 2 | Firestore `solicitudes_articulo/{sol_id}` | `grupos_trabajo_involucrados_ids` = array de **todos** los `gdt_*` vigentes a `fecha_desde`; `grupo_trabajo_id_ancla` ∈ array |
| 3 | `eventos_ticket` alta (`lao_on_create_ok`) | `metadata.grupos_trabajo_involucrados_ids` presente |
| 4 | Grilla equipo — grupo **no ancla** | Celda ámbar / tooltip «En revisión (jefe)» en fila del titular |
| 5 | Agente un solo HLg | Array longitud 1; ancla = único `gdt_*` |

**Consulta auditoría (consola / script):**

```javascript
// Reemplazar gdt_* y sol_id
db.collection("solicitudes_articulo")
  .where("grupos_trabajo_involucrados_ids", "array-contains", "gdt_…")
  .where("estado_solicitud_id", "==", "cfg_esa_en_revision_jefe")
  .limit(10);
```

> Índice compuesto: ver `firebase-v2/firestore.indexes.json` si la query en producción lo exige.

---

## Regresión

- `node --test functions/test/solicitudGruposTrabajoInvolucrados.test.js`
- Patrón B 64-A: mismo campo tras `patron_b_on_create_ok`.
