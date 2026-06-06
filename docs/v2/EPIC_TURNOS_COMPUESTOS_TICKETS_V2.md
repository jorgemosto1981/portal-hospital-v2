# Epic turnos compuestos — Desglose de tickets

**Rama integración:** `feat/epic-turnos-compuestos-v2`  
**Tag contrato:** `v2.0.0-rfc-turnos-compuestos`  
**RFC:** [`CAPA_TEORICA_SEGMENTOS_V2.md`](./CAPA_TEORICA_SEGMENTOS_V2.md)

---

| ID | Fase | Área | Título | Entregable | Depende de |
|----|------|------|--------|------------|------------|
| T-10 | DoR | Tech | Definition of Ready | Tag + schemas + esta tabla | — |
| T-01 | A0 | Backend/DevOps | Catálogos cfg_* | Manifiesto + upsert + whitelist | T-10 |
| T-02 | A | Backend | Contrato segmentos | Docs + Zod + contract.js | T-01 |
| T-03 | B | Backend | Motor materialización | `rdaTurnoTeoricoWorker`, ISO, segmentos[] | T-02 |
| T-04 | C | Backend | Cobertura parcial + freeze | `cambiosTurno`, materializar día XX/YY | T-03 |
| T-05 | D | Frontend | Grilla selector dinámico | `GrillaMensualEditor`, labels, DD/MM/AAAA | T-02 |
| T-06 | D | Frontend | Bandeja superior + ayuda | `BandejaAprobaciones`, HelpContext | T-02 |
| T-07 | E | Full-stack | Lecturas vis_* + caché RAM catálogo | Sin outbox completo | T-03 |
| T-08 | F | Backend | Pre-fichadas | `fichadas_esperadas`, expectativas salida momentánea | T-04 |
| T-09 | G | Docs/UX | Guías + helpContent | GUIA_* + glosarios | T-05 |

**Epic siguiente (no mezclar):** caché local + `enviarAccionesAsistencia` — después de T-04.

---

## Ramas sugeridas por ticket

- `feat/turnos-a0-catalogos` → merge a `feat/epic-turnos-compuestos-v2`
- `feat/turnos-b-motor`, `feat/turnos-c-cobertura`, `feat/turnos-d-grilla`, etc.

Merge a `main`/`develop` solo cuando T-08 probado + release notes.
