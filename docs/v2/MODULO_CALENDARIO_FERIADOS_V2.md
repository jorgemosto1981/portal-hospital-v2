# Especificación de estructura: calendario central de feriados y asuetos

**Estado:** acordado producto 2026-05-16.  
**Rol:** única fuente operativa de días no laborables para el cálculo de días consumidos por solicitudes que operan bajo regla de **días hábiles** institucionales (Caso 4 en [`CASOS_BORDE_SALDOS_V2.md`](./CASOS_BORDE_SALDOS_V2.md)).

**Relación:** [`REGISTRO_FASE_DOCUMENTAL_SALDOS_ABC_V2.md`](./REGISTRO_FASE_DOCUMENTAL_SALDOS_ABC_V2.md), [`RFC_SALDOS_PATRONES_ABC_V2.md`](./RFC_SALDOS_PATRONES_ABC_V2.md), [`CASOS_BORDE_SALDOS_V2.md`](./CASOS_BORDE_SALDOS_V2.md) (Caso 4), [`MODULO_CONFIGURACION_V2.md`](./MODULO_CONFIGURACION_V2.md), prefijos `cfg_cal_*` / `cfg_cfi_*` en [`DICCIONARIO_CFG_ARTICULOS_V2.md`](./DICCIONARIO_CFG_ARTICULOS_V2.md).

---

## 1. Categorización de días no laborables

Todo registro incorporado al calendario debe pertenecer estrictamente a una de las siguientes dos categorías en el campo **`tipo_dia_id`**:

| Valor | Definición |
|-------|------------|
| **`feriado`** | Días no laborables decretados a nivel nacional, provincial o municipal (ej. Año Nuevo, Día de la Independencia). Afectan la totalidad de la administración pública y el hospital de forma general. |
| **`asueto`** | Días de cese de actividad total o parcial dictados por la propia institución o disposiciones gubernamentales específicas (ej. Día del Trabajador de la Sanidad, asuetos administrativos de fin de año). |

---

## 2. Schema de la colección `cfg_calendario_feriados_institucional`

**ID documento:** unificado por año calendario (`cfg_cal_2026`, `cfg_cal_2027`) para garantizar lecturas rápidas por llave primaria (**point reads**).

```json
{
  "anio_calendario": 2026,
  "actualizado_el": "2026-05-16T18:30:00Z",
  "operador_id": "per_rrhh_9988",
  "dias_no_laborables": {
    "2026-01-01": {
      "motivo": "Año Nuevo",
      "tipo_dia_id": "feriado"
    },
    "2026-05-01": {
      "motivo": "Día del Trabajador",
      "tipo_dia_id": "feriado"
    },
    "2026-06-19": {
      "motivo": "Asueto institucional hospitalario",
      "tipo_dia_id": "asueto"
    },
    "2026-09-21": {
      "motivo": "Día de la Sanidad",
      "tipo_dia_id": "asueto"
    }
  }
}
```

### 2.1 ABM RRHH (fase 1)

| Acción | Regla |
|--------|--------|
| Alta / edición / baja lógica | Solo rol RRHH (o delegado documentado) |
| Campos editables | Fecha (`YYYY-MM-DD` como clave en mapa), `motivo`, `tipo_dia_id` |
| Auditoría | `operador_id`, `actualizado_el`; evento en `eventos_ticket` si aplica política transversal |

---

## 3. Comportamiento del motor ante cambios de último momento

Si el Estado decreta un feriado imprevisto y RRHH actualiza este documento mediante el ABM de configuración:

| Estado de la solicitud | Comportamiento |
|------------------------|----------------|
| Trámite **en curso** (aún no confirmado administrativamente el consumo final, o pendiente de recomputo documentado) | Las solicitudes futuras o en validación pueden **recalcular** el impacto en días cuando el motor de aprobación o el hook de inicio ejecute el cómputo hábil actualizado. |
| **Aprobada** y saldo ya impactado en el marcador al iniciar trámite | **No** se recalculan solas. El desfasaje se resuelve mediante el flujo manual de RRHH: **ajuste de saldo** (Caso 7) o anulación/reverso según política. |

> **Nota:** no confundir con Caso 8 (colisión LAO + enfermedad), que es un flujo distinto de interrupción de licencia.

---

## Historial

| Fecha | Cambio |
|-------|--------|
| 2026-05-16 | Versión inicial — schema `cfg_cal_YYYY`, tipos feriado/asueto, comportamiento motor |
