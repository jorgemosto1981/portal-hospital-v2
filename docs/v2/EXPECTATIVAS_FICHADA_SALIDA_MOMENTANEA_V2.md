# Expectativas de fichada y salida momentánea — V2

**Estado:** RFC aprobado (tag `v2.0.0-rfc-turnos-compuestos`).  
**Relación:** [`CAPA_TEORICA_SEGMENTOS_V2.md`](./CAPA_TEORICA_SEGMENTOS_V2.md).

---

## 1. Separación de motores

| Responsabilidad | Motor turnos / capa teórica | Motor licencias |
|-----------------|----------------------------|-----------------|
| Segmentos, cobertura parcial, huecos | Sí | No |
| Cupos, duración, veces salida momentánea | No | Sí |
| Enlace fichada ↔ permiso | Empaqueta expectativas | Valida y resuelve |

---

## 2. Fórmula fichadas esperadas (Fase F)

```
fichadas_esperadas = 2 × segmentos_efectivos + Σ fichadas_extra_evento_intrajornada
```

- `segmentos_efectivos`: segmentos con ejecutante vigente post overrides.
- `fichadas_extra_evento_intrajornada`: suma de `cantidad_fichadas_esperadas` en `expectativas_fichada_extra[]`.

---

## 3. Shape `expectativas_fichada_extra[]`

```json
{
  "tipo": "salida_momentanea",
  "fecha_base": "2026-05-20",
  "cantidad_fichadas_esperadas": 2,
  "patron_esperado": ["egreso", "ingreso"],
  "solicitud_id": "sol_…",
  "articulo_id": "art_…"
}
```

La capa teórica **no** valida horas máximas ni cantidad de usos del permiso.

---

## 4. Consumo futuro

- Módulo fichadas (epic caché): comparar teórico vs real con tolerancias por régimen.
- Divergencias parciales por `segmento_id` para RRHH.
