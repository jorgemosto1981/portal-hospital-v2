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
| 2026-06-26 | P5.0-fix 63.j | Duelo: `cfg_rcd_habiles_compuesto` + `fechaHastaDesdeVersionPatronBAsync` vía calendario institucional |
| 2026-06-26 | P5.0b + reapply | Listado expone `opciones_consumo_solicitud`; `--reapply` en seed; Firestore piloto sincronizado |
| 2026-06-24 | (rama `feat/1919-p5-config-rfc`) | **P5.2:** ticketera `OpcionConsumoSelect`, borrador Patrón B, enriquecimiento listado oleada 63 |
| 2026-06-24 | (rama `feat/1919-p5-config-rfc`) | **P5.1b / P5.1b-fix:** Fase S sin bolsa para `cupo_dias_por_ciclo === null` (63-J, 63-D); deploy `firestore.rules`; check-in etiqueta por evento |
| 2026-06-24 | (rama `feat/1919-p5-config-rfc`) | **P5.3 / P5.3b:** ABM `opciones_consumo_solicitud` en Avanzado; validación UI + bloqueo `formBloqueadoPorCatalogos` |
| 2026-06-24 | **Paquete P5 — UAT VERDE** | Matriz [`MATRIZ_UAT_P5_OPCIONES_CONSUMO_63J.md`](./MATRIZ_UAT_P5_OPCIONES_CONSUMO_63J.md): UAT-P5-01 … UAT-P5-05 aprobados en piloto |
| 2026-06-26 | **`1919-p5-config-rfc`** | Merge `7a8997c`: Paquete P5 opciones consumo 63.j — UAT VERDE |
| —          | `1919-pre-firestore-clean` | Antes de limpieza/reseed piloto (con export GCS) |
| 2026-06-26 | (rama `feat/1919-p4-licencias-medicas`) | **P4.1** motor tramos `licenciaMedicaTramosCore` (TDD) — uso en preview Modo B |
| 2026-06-26 | P4.3 UI agente: `/portal/solicitudes/aviso-medico`, Storage `avisos-med/{year}/{uid}/`, `crearAvisoMedicoCajaNegra` |
| 2026-06-26 | RFC Caja Negra §0.2 Licencia Incompleta — plazos `cfg_parametros_sistema`, §5.6–5.8; pausa código post-P4.3 |
| 2026-06-26 | RFC §0.3 gobernanza G1–G4, §8 inmutabilidad, §9 as-built + prompt Cursor |
