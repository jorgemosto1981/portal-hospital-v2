# Seed P4.4 — Arts. 16/19 licencia médica larga (episodio)

Espejo de [`../p4_art14/README.md`](../p4_art14/README.md).

## Artefactos

| Archivo | Rol |
|---------|-----|
| `ART16_19_P44_SPECS.json` | Ficha piloto `art16_larga` (`cfg_mlm_larga_episodio`) |
| `applied-ids.json` | IDs estables tras `--apply` (generado) |

## Catálogos previos

Antes de `--apply`, sembrar en piloto:

1. `cfg_causal_larga_duracion` y `cfg_ac_episodio_continuo` vía `npm run seed:catalogos-articulos-v2`
2. `cfg_mlm_larga_episodio` ya está en el mismo JSON

## Comandos

```bash
node scripts/seed-v2/apply-p4-art1619.mjs --dry-run
node scripts/seed-v2/apply-p4-art1619.mjs --apply
```

## Motor

- Episodio: `shared/utils/licenciaMedicaEpisodioCore.js` (tope 730 días, sin acumulador 35/35).
- Causal en **solicitud** (`causal_larga_duracion_id`), no en versión publicada.
