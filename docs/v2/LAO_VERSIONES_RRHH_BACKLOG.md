# Backlog RRHH — versiones LAO por ejercicio

**Artículo LAO:** `art_01KRNYDN5WR7RER7MWXRZ817E7`  
**Referencia auditada:** `ver_01KRNYDP14Y5V6F73DFXPBFATM` (`correspondencia_anio` = **2024**)

**Estrategia cerrada:** una versión **publicada** (`cfg_est_ver_publicada`) por cada `correspondencia_anio`, aunque la matriz Art. 40 sea idéntica entre años.

---

## Checklist de publicación

| `correspondencia_anio` | Estado | `version_id` | Notas |
|------------------------|--------|--------------|--------|
| 2024 | Hecho | `ver_01KRNYDP14Y5V6F73DFXPBFATM` | Auditado 2026-05-15 |
| 2023 | Hecho | `ver_01KRPPTZ86XK1GR4MNCJA804TE` | Confirmado Firestore 2026-05-15 |
| 2025 | Hecho | *(ver configurador/listado RRHH si hace falta id fijo en doc)* | Listado RRHH muestra todas las versiones |
| **2026** | Hecho RRHH | `ver_01KRPT6XEF3MD46NZT9SKW42C4` | Mismo artículo `art_01KRNYDN5WR7RER7MWXRZ817E7`; ejercicio alineado con **A = 2026** (T1–T6) |
| **A** (valor en check-in) | Cubierto con versión ejercicio | `ver_01KRPT6XEF3MD46NZT9SKW42C4` cuando **A = 2026** | El número **A** se informa en check-in; versión motor 2026 = esta fila |
| A+1 | Pendiente | — | Clonar desde A si matriz sin cambios |

---

## Workflow en configurador

1. Abrir `/portal/rrhh/configuracion-articulos/art_01KRNYDN5WR7RER7MWXRZ817E7`.
2. Duplicar versión **2024** (o crear versión nueva).
3. Ajustar **Año fiscal del derecho** (`correspondencia_anio`) al ejercicio.
4. Revisar matriz Art. 40 y pestaña Impacto y saldo (`cfg_rcd_habiles_compuesto`, `cfg_rcc_nunca`, `cfg_os_interno`, `cfg_cad_nunca`).
5. Publicar: `estado_version_id` = `cfg_est_ver_publicada`.

---

## Parámetros fijos (todas las versiones LAO)

| Campo | Valor |
|--------|--------|
| Es LAO anual | true |
| Criterio de descuento | `cfg_rcd_habiles_compuesto` |
| Momento de reseteo | `cfg_rcc_nunca` |
| Origen saldo (artículo) | `cfg_os_interno` |
| Tipo de vencimiento | `cfg_cad_nunca` |
| Acción saldo | `cfg_as_resta` |

---

## Relación con check-in y motor

- **Check-in** (`anio_origen < A`): bolsas con `es_arrastre: true`; cada fila exige versión publicada con el mismo `correspondencia_anio`.
- **Motor** (`anio_origen ≥ A`): bolsas con `es_arrastre: false`; acreditación usa versión del ejercicio **A** o posterior.

Ver [`PLAN_LAO_BOLSAS_CHECKIN_SOLICITUD_V2.md`](./PLAN_LAO_BOLSAS_CHECKIN_SOLICITUD_V2.md) y handoff [`HANDOFF_SESION_2026-05-15.md`](./HANDOFF_SESION_2026-05-15.md).
