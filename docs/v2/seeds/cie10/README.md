# CIE-10 — seed piloto (OPS/OMS)

| Archivo | Uso |
|---------|-----|
| `CIE10_OPS_PILOTO.json` | Entrada manual / ampliación institucional |
| `CIE10_CFG_NORMALIZADO.json` | Salida de `scripts/import-cie10.mjs` → `cfg_cie10` en Firestore |

```bash
node scripts/import-cie10.mjs
npm run seed:catalogos-articulos-v2 -- --dry-run
```

Para catálogo completo: reemplazá `--input` por el JSON oficial (Datos Abiertos / OPS) y volvé a importar.
