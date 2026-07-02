# Acta de cierre — épica 1919, Bloque **P4.4** (licencias médicas largas, Arts. 16 y 19)

**Plantilla / registro institucional.** Completar firma tras UAT en piloto (`portal-hospital-v2`).  
**Relación:** complementa [`ACTA_RRHH_EPICA_1919_P4_V2.md`](./ACTA_RRHH_EPICA_1919_P4_V2.md) (Art. 14 corta — Caja Negra).  
**Referencias técnicas:** [`RFC_P4_LICENCIAS_MEDICAS_ART_11_14_V2.md`](./RFC_P4_LICENCIAS_MEDICAS_ART_11_14_V2.md) §4.4 · [`docs/v2/seeds/p4_art1619/README.md`](./seeds/p4_art1619/README.md) · [`RFC_TICKETERA_SLICE_MEDICO_CAJA_NEGRA_V2.md`](./RFC_TICKETERA_SLICE_MEDICO_CAJA_NEGRA_V2.md) §5 (clasificación auditor).

**Estado desarrollo:** **CERRADO** en rama `feat/1919-p4-licencias-largas` — **HEAD `c165fe2`** (push a `origin`, 2026-07-02).  
**Normativa:** Decreto 1919/89 — enfermedad de **larga duración** (Art. 16) y **causal** Art. 19 en solicitud.

---

## 1. Alcance entregado

| Ítem | Entregable |
|------|------------|
| **Artículo normativo** | **Art. 16** — `cfg_mlm_larga_episodio`, código grilla **LM-L**, tope episodio **730 días** corridos (sin reinicio año civil) |
| **Motor** | `S_MED_LARGA` — `licenciaMedicaEpisodioCore`, consumo episodio continuo, preview/clasificador larga vs corta (`S_MED` / `cfg_mlm_corta_anual`) |
| **Catálogos** | `cfg_causal_larga_duracion`, `cfg_ac_episodio_continuo`, `cfg_cie10` (piloto OPS/OMS, 20 códigos) vía `npm run seed:catalogos-articulos-v2` |
| **Alta agente (Patrón B)** | Wizard Art. 16: `CausalLargaSelect`, `Cie10Select`, Zod `cie10` + `causal_larga_duracion_id` inmutables en `sol_` |
| **Auditoría** | Bandeja `/portal/medico/solicitudes`: lectura CIE-10 y causal; callable pasa `causal_larga_duracion_id`; exige CIE-10 en `sol_` para larga |
| **MDC / `vis_*`** | Payload y fan-out con `fase_motor: S_MED_LARGA`, `cie10_codigo`, causal; enriquecimiento desde versión `cfg_mlm_larga_episodio` |
| **Grilla operativa** | `renderChipLicenciaMedica` — etiqueta **LM-L**, violeta `#7C3AED` (consolidado), borde violeta punteado en trámite (incl. **junta médica**) |
| **Seed artículo** | `docs/v2/seeds/p4_art1619/` + `apply-p4-art1619.mjs` → `applied-ids.json` (`art16_larga`) |
| **QA automatizado** | Tests unitarios backend (motor, bandeja, MDC metadatos) + Vitest grilla (11 tests LM larga/corta) |

**Fuera de alcance (backlog explícito):**

- Saneamiento masivo de avisos `SOL_MED_AVISO_V1` huérfanos / `articulo_id` ≠ 14 en piloto (no bloquea merge).
- Dictamen junta E2E larga en smoke dedicado de **cierre** (smoke actual cubre clasificación → junta; dictamen favorable post-junta = flujo compartido P4.3c).
- Patrón B puro en cola auditor sin aviso médico: cola sigue priorizando `SOL_MED_AVISO_V1`; largas con metadatos en `sol_` ya visibles en bandeja.

---

## 2. Resumen técnico (trazabilidad)

### 2.1 Contratos clave

| Concepto | Valor / regla |
|----------|----------------|
| Fase motor | `fase_motor: "S_MED_LARGA"` en `licencia_medica` / preview / eventos `vis_*` |
| Modo versión | `modo_licencia_medica_id: cfg_mlm_larga_episodio` |
| Causal | `causal_larga_duracion_id` en **solicitud** (`cfg_cld_*`), no en versión publicada |
| Diagnóstico | `cie10: { codigo, descripcion }` en `sol_` — obligatorio para clasificar larga |
| Clasificación | Misma regla >15 d → `cfg_esa_esperando_dictamen_junta`; episodio preview sin materializar `licencia_medica` hasta dictamen favorable |

### 2.2 Commits representativos (rama `feat/1919-p4-licencias-largas`)

| Commit | Resumen |
|--------|---------|
| `dd263ad` | Motor episodio P4.4, preview, clasificador larga |
| `566dc61` | Wizard Art. 16, catálogo `cfg_cie10`, rules Patrón B |
| `d174e72` | Bandeja auditor CIE-10/causal; metadatos `S_MED_LARGA` en MDC |
| `526c807` | Smoke E2E `med-clasificar-junta-larga.mjs` + `applied-ids` Art. 16 |
| `c165fe2` | Grilla LM-L (`grillaLicenciaMedicaChip.js`) |

### 2.3 Archivos ancla (revisión / onboarding)

| Área | Rutas |
|------|--------|
| Motor episodio | `shared/utils/licenciaMedicaEpisodioCore.js` (sync → `functions/…`) |
| Clasificador | `functions/modules/shared/clasificarSolicitudMedicaAuditorCore.js` |
| Bandeja listado | `functions/modules/shared/solicitudBandejaAuditorMedicaLargaMeta.js` |
| MDC | `functions/modules/shared/mdcLicenciaMedicaMetadatos.js`, `mdcWorkerCore.js`, `mdcFanOutVis.js` |
| UI bandeja | `web/src/features/solicitudes/BandejaAuditorSolicitudDetalle.jsx` |
| UI grilla | `web/src/features/grilla/grillaLicenciaMedicaChip.js`, `grillaMesCellUtils.js` |

---

## 3. Smoke tests y evidencia piloto

### 3.1 Prerrequisitos piloto

```bash
ALLOW_FIRESTORE_SEED_V2=true npm run seed:catalogos-articulos-v2
node scripts/seed-v2/apply-p4-art1619.mjs --apply
```

### 3.2 Comandos de verificación

| Script | Propósito | Resultado esperado |
|--------|-----------|-------------------|
| `node scripts/smoke/med-clasificar-junta-larga.mjs --dry-run` | Resuelve Art. 16 + causal + CIE-10 | Exit 0 |
| `node scripts/smoke/med-clasificar-junta-larga.mjs --apply` | Fixture + clasificación 18 d larga | **PASS** — `vis_fase_motor: S_MED_LARGA`, `cie10` en `vis_*` |
| `node --test functions/test/mdcLicenciaMedicaMetadatos.test.js` | Payload MDC | 7/7 (suite bandeja incluida) |
| `npm test -- --run src/features/grilla/grillaLicenciaMedicaChip.test.js` | Regresión visual LM | 11/11 con `grillaMesCellUtils.test.js` |

### 3.3 Caso canónico UAT P4.4 (piloto)

| Campo | Valor de referencia |
|-------|---------------------|
| Proyecto Firebase | `portal-hospital-v2` |
| Functions región | `southamerica-east1` |
| Titular prueba (smoke) | `per_01KQN9WXFXF69Z9DCT5YNJ3TFZ` (MOSTO — alinear con DNI 28914247 en UI) |
| Artículo Firestore | `art_01KWH9KCZZ6JDH5T3VP4CHPERB` (código **16**, ver `ver_01KWH9KD015H7T0KR0RWN0PDG3`) |
| Código grilla | **LM-L** |
| CIE-10 smoke | **J06.9** |
| Causal smoke (ej.) | `cfg_cld_accidente_trabajo` (cualquier `cfg_cld_*` activo válido) |
| Solicitud smoke (clasificación → junta) | `sol_01448C1850AA72A73CED4C2C65` |
| Flujo | Aviso completo con `cie10` + causal → auditor clasifica **18 d** favorable → `cfg_esa_esperando_dictamen_junta` + chip grilla **LM-L** (borde violeta transicional) |

---

## 4. Criterios de aceptación RRHH (checklist UAT)

- [ ] Catálogo causal larga y CIE-10 visibles en alta Art. 16 (Patrón B / ticketera según circuito piloto).
- [ ] Auditor ve **diagnóstico (solo lectura)** y **causal** en bandeja para avisos largos.
- [ ] Clasificación favorable larga **>15 d** deriva a junta sin romper consumo episodio (preview tope 730 d).
- [ ] Grilla distingue **LM-L** (violeta / borde transicional) de **LM** / **LM-P** (Art. 14 / aviso provisorio).
- [ ] Detalle de día en grilla muestra tooltip con copy Art. 16/19 y código CIE-10 cuando MDC propagó metadatos.
- [ ] Regresión Art. 14: smoke `med-clasificar-junta.mjs --apply` sigue en **PASS** tras despliegue conjunto.

---

## 5. Riesgos y decisiones registradas

| Tema | Decisión |
|------|----------|
| Inmutabilidad CIE-10/causal | Persistidos en `sol_` en alta; auditor no edita diagnóstico en bandeja |
| Cola auditor | Filtro `SOL_MED_AVISO_V1` + `cfg_esa_pendiente_clasificacion_medica`; metadatos larga se muestran cuando existen en `sol_` |
| `asi_*` vs `vis_*` | Smoke valida fan-out **`vis_*`** con `S_MED_LARGA`; aportes `asi_*` pueden no materializarse en todos los estados (igual que corta en piloto) |
| PR #10 | Registro administrativo previo; **no** sustituye merge de `feat/1919-p4-licencias-largas` |

---

## 6. Backlog post-merge

1. Script de saneamiento avisos médicos huérfanos (`articulo_id` incoherente / chips no-LM en pruebas).
2. Smoke opcional: dictamen junta favorable larga → `licencia_medica` + `CONSOLIDAR_APROBADO` + fondo violeta consolidado en grilla.
3. Tag Git sugerido tras merge: `1919-p4-licencias-largas` o `1919-p4.4-art1619`.

---

## 7. Firmas

| Rol | Nombre | Fecha |
|-----|--------|-------|
| RRHH | | |
| Medicina laboral / auditoría | | |
| Producto / desarrollo | | |

---

## Anexo A — Plantilla PR hacia `master` (opción B)

Usar como cuerpo de PR al merge de `feat/1919-p4-licencias-largas`.

### Título sugerido

`feat(1919): P4.4 licencias médicas largas Art. 16/19 (S_MED_LARGA, CIE-10, grilla LM-L)`

### Summary

- Motor de episodio continuo (730 d) y clasificador médico para `cfg_mlm_larga_episodio`.
- Wizard y bandeja auditor con CIE-10 y causal Art. 19; MDC propaga `fase_motor: S_MED_LARGA` a `vis_*`.
- Grilla operativa: chip **LM-L** y estética violeta; smoke E2E `med-clasificar-junta-larga.mjs`.
- Documentación: acta [`ACTA_RRHH_EPICA_1919_P4_4_LARGAS_V2.md`](./ACTA_RRHH_EPICA_1919_P4_4_LARGAS_V2.md).

### Test plan

- [ ] `node --test functions/test/mdcLicenciaMedicaMetadatos.test.js functions/test/solicitudBandejaAuditorMedicaCore.test.js`
- [ ] `cd web && npm test -- --run src/features/grilla/grillaLicenciaMedicaChip.test.js src/features/grilla/grillaMesCellUtils.test.js`
- [ ] Piloto: `node scripts/smoke/med-clasificar-junta-larga.mjs --apply` → PASS
- [ ] Piloto: regresión `node scripts/smoke/med-clasificar-junta.mjs --apply` → PASS
- [ ] UAT RRHH: checklist §4 de esta acta

### Deploy (post-merge)

- [ ] `firebase deploy --only functions` (región `southamerica-east1`)
- [ ] `firebase deploy --only hosting`
- [ ] Verificar seeds piloto si entorno limpio: catálogos + `apply-p4-art1619.mjs --apply`

### Base branch

`master` (confirmar ausencia de conflictos con `feat/1919-p4-licencias-medicas` ya mergeada).

---

*Documento generado al cierre de desarrollo P4.4 — 2026-07-02.*
