# RFC — Acreditación anual LAO (años ≥ A)

**Estado:** callable `acreditarLaoBolsaAgente` + hook log en publicación de versión.  
**Plan:** [`PLAN_LAO_BOLSAS_CHECKIN_SOLICITUD_V2.md`](./PLAN_LAO_BOLSAS_CHECKIN_SOLICITUD_V2.md)

---

## Objetivo

Abrir o actualizar bolsa motor (`es_arrastre: false`, `origen_saldo_id: cfg_os_interno`) para un agente y ejercicio **≥ A**, usando la versión LAO publicada de ese `correspondencia_anio`.

**No** sobrescribir bolsas con `es_arrastre: true` (check-in).

---

## Callable `acreditarLaoBolsaAgente`

| Campo | Tipo |
|--------|------|
| `persona_id` | `per_*` |
| `articulo_id` | `art_*` |
| `anio_origen` | number — debe coincidir con `correspondencia_anio` de la versión |
| `version_id` | opcional; resuelve por año si falta |
| `cantidad_inicial` | opcional; si falta, usa preview motor (`fecha_desde` = `YYYY-07-01`) |
| `anio_corte_a` | opcional — si se envía, exige `anio_origen >= anio_corte_a` |

Cupo preview: camino stock o proporcional según `laoPreviewMotor` (misma lógica que solicitud).

---

## Hook `onCfgArticuloVersionWritten`

Al pasar a `cfg_est_ver_publicada` con `es_lao_anual` y `correspondencia_anio` definido:

- Log `lao_version_publicada_lista_acreditacion` con `articuloId`, `versionId`, `correspondencia_anio`.
- Batch masivo por hospital: invocar callable por agente (ticketera / job futuro).

---

## Relación con check-in

- **A** se informa en check-in (`anio_corte_a`); puede persistirse en persona como `anio_corte_portal_a`.
- Acreditación de ejercicio **A** no reemplaza filas de check-in &lt; A.

---

## Código

| Pieza | Ruta |
|--------|------|
| Callable | `functions/onCall/solicitudes/acreditarLaoBolsaAgente.js` |
| Hook | `functions/modules/articulosCfg.js` |
