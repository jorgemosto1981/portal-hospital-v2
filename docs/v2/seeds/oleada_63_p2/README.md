# Oleada 63 P2 — seeds Art. 63.c–k

**Deploy hosting (referencia):** 2026-06-24, rama alineada a `HEAD` `8033605` (`1919-p1-ticketera`).

## Prerrequisitos

- Catálogos `cfg_*` de artículos sembrados (`npm run seed:catalogos-articulos-v2`).
- Credencial ADC en `GOOGLE_APPLICATION_CREDENTIALS` (típico: `.env.v2.local` vía `scripts/load-env-v2.mjs`).

## Comandos

```bash
node scripts/seed-v2/apply-oleada-63-p2.mjs --dry-run
node scripts/seed-v2/apply-oleada-63-p2.mjs --apply
node scripts/seed-v2/verify-oleada-63-listar.mjs
```

## Artefactos

| Archivo | Rol |
|---------|-----|
| `OLEADA_63_P2_SPECS.json` | Parámetros de negocio (5 incisos) |
| `applied-ids.json` | `art_*` / `ver_*` tras `--apply` |
| `scripts/seed-v2/lib/buildOleada63Version.mjs` | Builder 7 bloques + opciones 63.j |

Especificación normativa: [`LINEAMIENTOS_DECRETO_1919_89_POR_ARTICULO_V2.md`](../../LINEAMIENTOS_DECRETO_1919_89_POR_ARTICULO_V2.md).