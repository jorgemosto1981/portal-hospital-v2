# Changelog — épica Decreto 1919 / configurador / grilla / solicitudes

Registro de **tags Git** y hitos documentales/código. Detalle operativo en `[PLAN_LINEAMIENTOS_DECRETO_1919_MOTOR_SOLICITUDES_V2.md](./PLAN_LINEAMIENTOS_DECRETO_1919_MOTOR_SOLICITUDES_V2.md)`.


| Fecha      | Tag / hito                 | Resumen                                                                                                       |
| ---------- | -------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 2026-06-24 | `1919-baseline-2026-06-24` | Baseline post-fix CHAPARRO (fichada fuera tramo); tests grilla OK                                             |
| 2026-06-24 | (rama `feat/1919-p0-doc`)  | P0 doc: `LINEAMIENTOS` oleada 63.c–k, guía día vs tramo, RFC extensiones configurador, acta RRHH en plantilla |
| 2026-06-24 | —                          | **Auditoría consolidación:** G1-doc cerrado (ecosistema alineado); cierre formal P0 = acta + PR + tag abajo |
| 2026-06-24 | —                          | Plan maestro ampliado (este changelog + merge PLAN)                                                           |
| 2026-06-24 | `1919-p0-doc-g1`           | Merge PR #7 (`a173c80`): P0 G1 formal en `master` |
| —          | `1919-pre-p1` (opcional)   | Opcional: tag en punta de `feat/1919-p1-ticketera` antes del primer commit código |
| 2026-06-24 | `1919-p1-ticketera`        | Merge PR #8 (`8033605`): S1 `/alta`, guard 1:1, smoke piloto VERDE |
| 2026-06-24 | (rama `feat/1919-p2-oleada-63`) | Deploy hosting alineado a `HEAD` `8033605` (post P1); seeds oleada 63 |
| 2026-06-24 | `1919-p2-oleada-63` | Merge P2: 5 incisos Firestore (`63.c`–`63.k`), seeds/apply, UAT listado+RDA+GSO+regresión VERDE (piloto 28914247) |
| 2026-06-24 | (rama `feat/1919-p5-config-rfc`) | **P5.0:** Zod `opciones_consumo_solicitud[]`, `shared/utils/opcionesConsumoSolicitud.js`, seeds oleada 63 validadas en dry-run |
| 2026-06-24 | `c0075f9` (pausa sesión P5) | P5.0 en remoto; siguiente: **P5.1 motor** (`runPatronBAltaMotorV2`, fechas corridos, rules create) → P5.2 ticketera |
| 2026-06-26 | (rama `feat/1919-p5-config-rfc`) | **P5.1:** motor `opcion_consumo_id`, fechas corridos multi-día, rules + schema create |
| —          | `1919-pre-firestore-clean` | Antes de limpieza/reseed piloto (con export GCS) |
