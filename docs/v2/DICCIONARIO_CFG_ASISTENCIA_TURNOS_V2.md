# Diccionario — Catálogos asistencia y turnos V2

**Estado:** RFC aprobado (tag `v2.0.0-rfc-turnos-compuestos`).  
**Convenciones:** [`MODULO_CONFIGURACION_V2.md`](./MODULO_CONFIGURACION_V2.md) §1–§2.

---

## 1. Colecciones nuevas

| Colección | Prefijo | Consumidor |
|-----------|---------|------------|
| `cfg_tipo_compensacion_cobertura` | `cfg_tcc_` | `overrides_turno.tipo_compensacion_id` |
| `cfg_estado_periodo_liquidacion` | `cfg_epl_` | `vis_*.estado_periodo_liquidacion_id` |
| `cfg_clasificacion_dia_calendario` | `cfg_cdc_` | `capa_teorica.clasificacion_dia_calendario_id` |
| `cfg_tipo_override_turno` | `cfg_tov_` | `overrides_turno.tipo_override_id` |

---

## 2. Manifiesto de IDs (SSoT en repo)

Archivo: [`scripts/seed-v2/seed-ids-asistencia-turnos.v2.json`](../../scripts/seed-v2/seed-ids-asistencia-turnos.v2.json)

| codigo_interno | document_id |
|----------------|-------------|
| **cfg_tipo_compensacion_cobertura** | |
| CAMBIO_INTERNO | `cfg_tcc_01KSN4ZJPJZ6H3ARPEX750YBTH` |
| EXTRA_PAGA | `cfg_tcc_01KSN4ZJPT494X97SD4N2GB2XF` |
| DEVOLUCION_HORAS | `cfg_tcc_01KSN4ZJPTVC0VPNJGXSAC2MMZ` |
| **cfg_estado_periodo_liquidacion** | |
| ABIERTO | `cfg_epl_01KSN4ZJPTDMSK2K7AR2SV4B1R` |
| CONCILIADO | `cfg_epl_01KSN4ZJPVQ8GPKGNZV7HM9A2E` |
| LIQUIDADO_CERRADO | `cfg_epl_01KSN4ZJPVJE8C6X1VS2HQSR20` |
| **cfg_clasificacion_dia_calendario** | |
| HABIL | `cfg_cdc_01KSN4ZJPVPW986NK2K2JV0PP3` |
| FIN_DE_SEMANA | `cfg_cdc_01KSN4ZJPV5T8KD87A8PYSB4NN` |
| FERIADO | `cfg_cdc_01KSN4ZJPVM4YPG01KSQ8H78GY` |
| ASUETO | `cfg_cdc_01KSN4ZJPWHGW22YKBRVY8X10S` |
| INSTITUCIONAL | `cfg_cdc_01KSN4ZJPWV1H7MWK3JCAT11SN` |
| **cfg_tipo_override_turno** | |
| COBERTURA_PARCIAL | `cfg_tov_01KSN4ZJPXNNGSY07ZVXPQSSE5` |

---

## 3. Despliegue de catálogos A0

1. **No** usar `npm run seed:*` genérico salvo excepción hospital (`ALLOW_FIRESTORE_SEED_V2=true`).
2. Ejecutar `node scripts/upsert-cfg-asistencia-turnos-a0.mjs` en Dev → Staging → Prod (mismos ids).
3. Registrar en handoff: fecha, operador, ambiente, resultado.
4. Verificar: listado callable = tabla §2; smoke override con `tipo_compensacion_id`.

Backend gates: `functions/modules/shared/cfgAsistenciaTurnosIds.js` (importa el JSON).

---

## 4. Whitelist

Registrar colecciones en whitelists backend/frontend antes de merge de código de negocio.
