# Seed P4.3 — Artículo 14 (licencia médica corta anual)

Ficha normativa operativa para **Caja Negra** y bandejas auditor/junta.

## Archivos

| Archivo | Rol |
|---------|-----|
| `ART14_P43_SPECS.json` | Contrato de negocio (sin IDs Firestore) |
| `applied-ids.json` | Mapa estable `art14_corta` → `art_*` / `ver_*` tras `--apply` |

## Campos clave de la versión

- `es_licencia_medica: true`
- `modo_licencia_medica_id: cfg_mlm_corta_anual`
- Patrón saldo **C** (`cfg_rcc_nunca` + `cfg_os_externo_informado`)
- `cupo_dias_por_ciclo: null` — acumulador vía motor **S_MED**, no bolsa clásica
- `codigo_grilla: LM` — celda post-clasificación (distinto de aviso `LM-P` / `LM`)
- `requiere_adjunto_obligatorio: true`

## Prerrequisito catálogo

Ejecutar (o verificar) semilla de catálogos para filas `cfg_mlm_*`:

```bash
ALLOW_FIRESTORE_SEED_V2=true npm run seed:catalogos-articulos-v2
```

## Uso

```bash
npm run seed:p4-art14:dry-run
ALLOW_FIRESTORE_SEED_V2=true npm run seed:p4-art14
node scripts/seed-v2/apply-p4-art14.mjs --apply --reapply
```

## Verificación

Tras `--apply`, `clasificarSolicitudMedicaAuditor` debe resolver `esLicenciaMedicaCortaAnual(version)` sin parche smoke.
