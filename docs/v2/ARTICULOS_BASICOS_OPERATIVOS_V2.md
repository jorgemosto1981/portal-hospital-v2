# Artículos básicos operativos — Portal V2 (check-in / ticketera)

**Estado:** catálogo acordado RRHH **2026-05-18** (piloto `per_01KQN9WXFXF69Z9DCT5YNJ3TFZ`).  
**Uso:** referencia para check-in, pruebas de solicitudes y altas en configurador. No es seed automático: cada `art_*` existe en Firestore por flujo RRHH.

---

## Circuito de ingreso (estándar operativo)

Todas las versiones publicadas de los artículos básicos deben incluir en `bloque_workflow_sla_cobertura.circuito_ingreso_ids`:

| Rol (`cfg_rol`) | Uso |
|-----------------|-----|
| `CFG_USUARIO` | Agente estándar |
| `CFG_RRHH` | Personal RRHH (menú agente + extras) |
| `CFG_MEDICO` | Personal médico |
| `CFG_VISUALIZADOR` | Visualizador |

**Auditoría:** `node scripts/auditar-circuito-ingreso-articulos.mjs`

---

## Resumen por patrón

| Patrón | Rol | Artículos básicos |
|--------|-----|-------------------|
| **A** | LAO / bolsas históricas (&lt; A) | LAO |
| **B** | Topes cíclicos (año = A) | 64-A, 64-B |
| **C** | Cuenta continua (global) | 68-B compensatorio |

---

## Ficha por artículo

### LAO — Licencia anual ordinaria (Patrón A)

| Campo | Valor |
|-------|--------|
| `articulo_id` | `art_01KRNYDN5WR7RER7MWXRZ817E7` |
| Código | LAO (referencia grilla) |
| Patrón | A — `cfg_rcc_nunca` + `cfg_os_interno` + `es_lao_anual: true` |
| Check-in | Pestaña **LAO (A)** — filas por año &lt; A |
| Circuito | `CFG_USUARIO`, `CFG_RRHH`, `CFG_MEDICO`, `CFG_VISUALIZADOR` (todas las versiones publicadas) |
| Versiones publicadas (ejercicio) | 2022 `ver_01KRXKS1TZPHRRG2NNWFHS78GC` · 2023 `ver_01KRPPTZ86XK1GR4MNCJA804TE` · 2024 `ver_01KRNYDP14Y5V6F73DFXPBFATM` · 2025 `ver_01KRPQDTM7BHZKYGKR91BEXHTR` · 2026 `ver_01KRPT6XEF3MD46NZT9SKW42C4` |
| Notas | Detalle RRHH: [`LAO_VERSIONES_RRHH_BACKLOG.md`](./LAO_VERSIONES_RRHH_BACKLOG.md) |

### 64-A — Asuntos particulares **con goce** (Patrón B)

| Campo | Valor |
|-------|--------|
| `articulo_id` | `art_01KRNK10V10CH7W5M2W6V558GS` |
| `version_id` (publicada piloto) | `ver_01KRNKNBXNBFC9HZN7CZJGPRDH` |
| Código / nombre | `64-A` — ASUNTOS PARTICULARES |
| Patrón | B — `cfg_rcc_anual` + `cfg_os_interno` |
| `es_sin_goce` | **false** |
| Cupo | 6 días/ciclo, 1/mes, 1 por evento |
| Elegibilidad | Escalafón `CFG_ESC_02_ADMINISTRACION` |
| Circuito | `CFG_USUARIO`, `CFG_RRHH`, `CFG_MEDICO`, `CFG_VISUALIZADOR` |
| Check-in | Pestaña **B** — días consumidos en ciclo A |
| Doc | [`HANDOFF_SESION_2026-05-14.md`](./HANDOFF_SESION_2026-05-14.md) § 64-A |

### 64-B — Asuntos particulares **sin goce de haberes** (Patrón B)

| Campo | Valor |
|-------|--------|
| `articulo_id` | `art_01KRYEX0JZY4Y8J1GY3Q9F8BJQ` |
| `version_id` (publicada) | `ver_01KRYEX13QN7VBPMFQFES1QHB4` |
| Código / nombre | `64-B` — ASUNTOS PARTICULARES SIN GOCE DE HABERES |
| Patrón | B — igual motor que 64-A |
| `es_sin_goce` | **true** |
| `justifica_sueldo_id` | `cfg_js_no` |
| Cupo | 6 días/ciclo (misma parametrización que 64-A en piloto) |
| Elegibilidad / circuito | Igual criterio 64-A en piloto |
| Check-in | Pestaña **B** — bolsa `bol_art_01KRYEX0…_{A}` en `sal_{A}_per_*` |
| Relación con 64-A | **Artículo nuevo** (no versión del 64-A) |

### 68-B — Compensatorio (Patrón C, horas)

| Campo | Valor |
|-------|--------|
| `articulo_id` | `art_01KRYEF39ZM0KB0F0Y4GPBH38F` |
| `version_id` (publicada) | `ver_01KRYEFZRQF0RKHJ5JTK6244G8` |
| Código / nombre | `68-B` — COMPENSATORIO - Art 68 Inc B |
| Patrón | C — `cfg_rcc_nunca` + `cfg_os_externo_informado` |
| Unidad | **Horas** (`cfg_uma_horas`) |
| `es_sin_goce` | false (compensatorio ≠ licencia sin goce 64-B) |
| Check-in | Pestaña **C** — saldo global en `sal_global_per_*` |
| Circuito | `CFG_USUARIO`, `CFG_RRHH`, `CFG_MEDICO`, `CFG_VISUALIZADOR` |
| Doc | [`GUIA_ALTA_ARTICULO_68B_COMPENSATORIO_V2.md`](./GUIA_ALTA_ARTICULO_68B_COMPENSATORIO_V2.md) |

---

## Piloto de saldos (misma persona)

**`persona_id`:** `per_01KQN9WXFXF69Z9DCT5YNJ3TFZ` (DNI 28914247)

| Doc / ciclo | Bolsas cargadas (ejemplo 2026-05-18) |
|-------------|--------------------------------------|
| `sal_2026_per_…` | 64-A y 64-B: cupo 6, consumido 1, disponible 5 |
| `sal_global_per_…` | 68-B: 100 h disponibles (rectificación C) |
| LAO (años &lt; A) | Según sesiones previas (2024/2025, etc.) |

---

## Validación técnica

```bash
node scripts/inspect-articulo-version-checkin.mjs <articulo_id> <version_id>
```

| Artículo | Patrón esperado |
|----------|----------------|
| 68-B | C |
| 64-A / 64-B | B |
| LAO | A (por versión publicada con `es_lao_anual`) |

---

## Próximos artículos (fuera del básico)

- Ticketera: ampliar según plan [`HANDOFF_SESION_2026-05-13_TICKETERA.md`](./HANDOFF_SESION_2026-05-13_TICKETERA.md)
- Licencias médicas, exámenes, otros incisos — nuevos `art_*`, no nuevas versiones salvo mismo inciso otro ejercicio

---

## Enlaces

- Check-in: [`GUIA_OPERATIVA_CHECKIN_SALDOS_RRHH.md`](./GUIA_OPERATIVA_CHECKIN_SALDOS_RRHH.md) · [`CHECKIN_SALDOS_MATRIZ_PRUEBAS.md`](./CHECKIN_SALDOS_MATRIZ_PRUEBAS.md)
- Patrones A/B/C: [`RFC_SALDOS_PATRONES_ABC_V2.md`](./RFC_SALDOS_PATRONES_ABC_V2.md)
