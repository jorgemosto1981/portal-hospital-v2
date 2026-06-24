# Matriz UAT P2 — oleada Art. 63 (conductor + GSO)

**Épica:** Decreto 1919 / Bloque E — **P2 oleada 63**  
**Piloto:** `per_01KQN9WXFXF69Z9DCT5YNJ3TFZ` — DNI **28914247**  
**Cierre:** 2026-06-24 — matriz **100% VERDE** (Sala piloto + scripts Admin)

**Scripts de referencia**

| Script | Uso |
|--------|-----|
| `node scripts/seed-v2/verify-oleada-63-listar.mjs` | UAT-P2-01 listado catálogo |
| `node scripts/auditar-circuito-ingreso-articulos.mjs` | 13/13 circuitos (8 legado + 5 oleada) |
| `node scripts/uat-p2-oleada-63-motor.mjs` | UAT-P2-04 RDA gate |
| `node scripts/revert-fanout-huerfanos-vis.mjs` | Limpieza eventos `vis_*` sin `sol_*` real |

**IDs Firestore (oleada):** ver [`seeds/oleada_63_p2/applied-ids.json`](./seeds/oleada_63_p2/applied-ids.json).

---

## Resultados — smoke manual y backend

| ID | Componente / API | Escenario | Resultado | Estado |
|----|------------------|-----------|-----------|--------|
| **UAT-P2-01** | `listarArticulosIngresoAgente` | Listado con token piloto; `meta.listado_modo: "catalogo"` | 5 incisos `63-C` … `63-K` en catálogo elegible | **Aprobado / VERDE** |
| **UAT-P2-02** | `GuardArticuloIngreso` | `/portal/solicitudes/alta?articulo=art_01KVWVW9Z50VR6T1BC6J0R3YQ8` | Wizard Patrón B abre; ULID validado contra provider | **Aprobado / VERDE** |
| **UAT-P2-03** | Wizard 63.j | Fallback P1 sin leer `opciones_consumo_solicitud[]` en UI | Tope rígido 5 días corridos; array en versión listo para P5 | **Aprobado / VERDE** |
| **UAT-P2-04** | Motor RDA / `depende_rda` | 63-I; día sin turno planificado (`TURNO_NO_PLANIFICADO`) | Gate bloquea alta (control positivo con plan HABILITADO en gdt piloto) | **Aprobado / VERDE** |
| **UAT-P2-05** | `mdcFanOutVis` / MDC | Proyección 63-C (2 días laborables; validación Admin) | `eventos[].codigo_grilla: "63-C"` en `vis_*` | **Aprobado / VERDE** |
| **UAT-P2-06** | GSO grilla pasiva | Junio 2026 — días con licencia aprobada real / validación visual | Chip `63-C` `#F97316`; teoría visible; sin ROJO inasistencia bajo chip | **Aprobado / VERDE** |
| **UAT-P2-07** | Regresión LAO / 64-A | Ticketera + check-in saldos | `resolvePatronSaldo` estable; sin errores consola | **Aprobado / VERDE** |

---

## Criterio de cierre P2 (cumplido)

- Cinco `art_*` publicados en Firestore con versión `cfg_est_ver_publicada` y Patrón **B**.
- Listado catálogo + circuito 13/13 + UAT MDC/GSO y regresión 64-A/LAO en VERDE.
- Tag Git: **`1919-p2-oleada-63`** sobre merge a `master`.

**Nota operativa:** el fan-out UAT con `sol_*` sintético (sin `solicitudes_articulo`) produce “La solicitud no existe” en modal; usar flujo real aprobado o `revert-fanout-huerfanos-vis.mjs`.
