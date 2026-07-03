# Evidencia P2b — dictamen post-deploy (piloto)

**Fecha:** 2026-07-03  
**Solicitud:** `sol_01KWM0R9KMDEJ7ZKS416H5FSGR`  
**Titular:** MOSTO — `per_01KQN9WXFXF69Z9DCT5YNJ3TFZ`  
**Script:** `scripts/smoke/med-p2b-evidence-dictamen.mjs --apply`

## Plan de dictamen

| Campo | Valor agente (estimado) | Valor auditor (dictamen) |
|-------|-------------------------|---------------------------|
| `fecha_desde` | `2026-07-22` | `2026-07-21` |
| `fecha_hasta` | `2026-07-22` | `2026-07-21` |
| Artículo | — (caja negra) | `art_01KWH4NM0BW4HKGGWV1NFD599K` (14) |

## Resultado callable/core

```json
{
  "ok": true,
  "estado_solicitud_id": "cfg_esa_aprobada",
  "auditor_medico_clasificacion": {
    "fecha_desde": "2026-07-21",
    "fecha_hasta": "2026-07-21",
    "fechas_corregidas_por_auditor": true,
    "dictamen_favorable": true,
    "dias_solicitados": 1,
    "requiere_junta_medica": false
  }
}
```

## Checks automáticos

| Check | Resultado |
|-------|-----------|
| `clasif_ok` | ✅ |
| `estado_aprobada` | ✅ |
| `fechas_corregidas_por_auditor` | ✅ `true` |
| `fecha_desde` / `fecha_hasta` persistidos | ✅ |

**Veredicto:** PASS — trazabilidad P2b verificada en Firestore piloto post-deploy.
