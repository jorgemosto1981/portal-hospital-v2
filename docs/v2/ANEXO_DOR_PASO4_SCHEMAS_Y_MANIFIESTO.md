# Anexo DoR — Paso 4 (código) + manifiesto A0

Aplicar en rama `feat/epic-turnos-compuestos-v2` tras commit de docs (paso 1).

---

## `scripts/seed-v2/seed-ids-asistencia-turnos.v2.json`

Ver contenido en [`DICCIONARIO_CFG_ASISTENCIA_TURNOS_V2.md`](./DICCIONARIO_CFG_ASISTENCIA_TURNOS_V2.md) §2 — copiar JSON completo al path indicado.

---

## `web/src/schemas/capaTeoricaSegmentos.schema.js`

Crear con Zod: `segmentoTeoricoSchema`, `capaTeoricaSegmentadaSchema`, `coberturaParcialOverrideSchema`, `expectativaFichadaExtraSchema`. Referencia: [`CAPA_TEORICA_SEGMENTOS_V2.md`](./CAPA_TEORICA_SEGMENTOS_V2.md).

---

## `web/src/schemas/cfgAsistenciaTurnos.schema.js`

Enums de ids desde manifiesto; schemas de payload override cobertura.

---

## `functions/modules/asistencia/schemas/capaTeoricaSegmentos.contract.js`

JSDoc `@typedef` espejo de los schemas web (Functions sin Zod en package.json).

---

## `functions/modules/shared/cfgAsistenciaTurnosIds.js`

Exportar constantes `CFG_EPL_LIQUIDADO_CERRADO`, etc., importando el JSON del manifiesto.

---

## Git (pasos 1 y 3)

```powershell
cd c:\Users\jorge\Desktop\portal-hospital-v2
git checkout -b feat/epic-turnos-compuestos-v2
git add docs/v2/CAPA_TEORICA_SEGMENTOS_V2.md docs/v2/EXPECTATIVAS_FICHADA_SALIDA_MOMENTANEA_V2.md docs/v2/DICCIONARIO_CFG_ASISTENCIA_TURNOS_V2.md docs/v2/RFC_CIERRE_PERIODO_LIQUIDACION_V2.md docs/v2/EPIC_TURNOS_COMPUESTOS_TICKETS_V2.md docs/v2/EPIC_CACHE_LOCAL_ASISTENCIA_V2.md docs/v2/ANEXO_DOR_PASO4_SCHEMAS_Y_MANIFIESTO.md docs/v2/README.md docs/v2/PLAN_CAPA_TEORICA_ASISTENCIA_V2.md docs/v2/PLAN_REGIMEN_HORARIO_V2.md
git commit -m "$(cat <<'EOF'
docs(asistencia): aprueba arquitectura y contrato para turnos compuestos v2

RFC segmentos, catálogos cfg, freeze liquidación, tickets epic y cruce con epic caché.
EOF
)"
git tag -a v2.0.0-rfc-turnos-compuestos -m "Contrato turnos compuestos y cobertura parcial V2"
```

Luego añadir archivos del anexo (paso 4) en commit separado: `chore(asistencia): contratos Zod y manifiesto cfg A0`.
