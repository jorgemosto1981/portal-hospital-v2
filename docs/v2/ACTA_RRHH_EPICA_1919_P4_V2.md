# Acta RRHH — épica 1919, Bloque P4 (licencias médicas — Caja Negra, Art. 14 corta)

> **UAT bandeja auditor P0/P1/P2/P3 + P2b:** **VERDE** (2026-07-03) — [`HANDOFF_SESION_2026-07-03_CIERRE_UAT_P4_V2.md`](./HANDOFF_SESION_2026-07-03_CIERRE_UAT_P4_V2.md), [`HANDOFF_SESION_2026-07-03_SMOKE_INTEGRACION_AUDITOR_MEDICO.md`](./HANDOFF_SESION_2026-07-03_SMOKE_INTEGRACION_AUDITOR_MEDICO.md)  
> **Caso UAT cierre:** `sol_01KWKTC9BD5BJQ37TMAGADN1XR` · 32 d · Art. 14 · auditor → junta → aprobada  
> **Caso P1:** `sol_01KWM0R9KMDEJ7ZKS416H5FSGR` · ficha ingreso agente en bandeja

**Plantilla / registro institucional.** Completar firma tras UAT en piloto (`portal-hospital-v2`).  
**Referencia técnica:** [`RFC_TICKETERA_SLICE_MEDICO_CAJA_NEGRA_V2.md`](./RFC_TICKETERA_SLICE_MEDICO_CAJA_NEGRA_V2.md), [`PLAN_P4_LICENCIAS_MEDICAS_ART_11_14_V2.md`](./PLAN_P4_LICENCIAS_MEDICAS_ART_11_14_V2.md).

## Alcance validado en esta oleada

| Ítem | Entregable |
|------|------------|
| **Artículo normativo** | **Art. 14** — enfermedad de corta duración (modo `cfg_mlm_corta_anual`, acumulador S_MED) |
| **Agente** | Alta aviso médico (`SOL_MED_AVISO_V1`), incompleta con plazo G3, completar certificado |
| **Auditoría** | Bandeja `/portal/medico/solicitudes`, callable `clasificarSolicitudMedicaAuditor` (≤15 d aprobación directa; >15 d derivación junta) |
| **Junta médica** | Bandeja `/portal/medico/junta`, callable `registrarDictamenJuntaMedica` |
| **MDC / grilla** | Proyección LM/LM-P, post-clasificación `CONSOLIDAR_APROBADO` / `REVERTIR_PROYECCION`; detalle día en grilla operativa |
| **Vencimientos** | Job §5.7 aviso incompleto (`vencimientosLicenciaIncompletaScheduled` + callable dry-run) |
| **Seed** | `docs/v2/seeds/p4_art14/` + catálogo `cfg_mlm_*` |
| **Hosting piloto** | https://portal-hospital-v2.web.app (oleada UI bandejas + fixes grilla) |

**Fuera de alcance (entregado en P4.4):** ver [`ACTA_RRHH_EPICA_1919_P4_4_LARGAS_V2.md`](./ACTA_RRHH_EPICA_1919_P4_4_LARGAS_V2.md) — Art. **16 / 19** licencia larga (`cfg_mlm_larga_episodio`, episodio/causal, grilla LM-L).

## Caso canónico UAT (piloto)

| Campo | Valor de referencia |
|-------|---------------------|
| Titular prueba | MOSTO, JORGE ANTONIO — DNI 28914247 |
| **Solicitud LM (cierre UAT 2026-07-03)** | **`sol_01KWKTC9BD5BJQ37TMAGADN1XR`** |
| Artículo Firestore | `art_01KWH4NM0BW4HKGGWV1NFD599K` (código **14**) |
| Flujo | Aviso completo → preview 32 d (19 d previos) → clasificación favorable auditor → junta favorable → `cfg_esa_aprobada` + `licencia_medica` + MDC |
| Bandejas | Sale de auditoría y junta tras cierre; grilla **14 — ENFERMEDAD DE CORTA DURACION** |

**Caso histórico motor (jun-2026):** `sol_013EE8A16E710808627AC4DBA2` (18 d) — válido para regresión motor; no sustituye evidencia bandeja P0/P2/P3.

**Nota datos piloto:** solicitudes 64-A espurias purgadas 2026-07-03; selector auditor filtra solo `codigo_grilla` LM/LM-L.

## Criterios de aceptación RRHH (checklist)

- [x] Agente puede dar aviso médico y completar incompleta dentro del plazo configurado. *(UAT 2026-07-03)*
- [x] Auditor clasifica aviso completo; ≤15 días aprueba sin junta; >15 días deriva a junta. *(32 d → junta; P2b fechas editables UAT 2026-07-03)*
- [x] Junta emite dictamen favorable/desfavorable; desfavorable rechaza y revierte proyección en grilla. *(favorable verificado; rechazo: smoke vigente)*
- [x] Grilla muestra licencia coherente con estado (LM / consolidación); sin etiqueta “pendiente clasificación” en solicitudes ya aprobadas.
- [x] Enlace desde detalle de día no envía trámites médicos a bandeja jefe/RRHH genérica (portal médico o sin enlace si ya cerrado).
- [ ] RRHH acepta oleada **P4.4 largas** documentada en [`ACTA_RRHH_EPICA_1919_P4_4_LARGAS_V2.md`](./ACTA_RRHH_EPICA_1919_P4_4_LARGAS_V2.md) para merge independiente o conjunto según estrategia de release.

## Transversal

| Tema | Decisión |
|------|----------|
| Circuito Art. 14 | `CFG_USUARIO`, `CFG_RRHH`, `CFG_MEDICO`, `CFG_VISUALIZADOR` |
| Aprobación sustantiva LM | Solo auditor / junta (no jefe ni TC RRHH como cierre médico) |
| Índices Firestore | Query bandejas por `estado_solicitud_id`; filtros finos en memoria (límite 400) en piloto |

## Evidencia técnica (repo)

- Rama activa oleada bandeja auditor: **`feat/1919-p4-visor-auditor`** @ `92cb14e` (push `origin`; **no mergeado** a `master` al 2026-07-02)
- Rama histórica motor P4 + P4.4: `feat/1919-p4-licencias-largas` (contenido absorbido en rama visor)
- `master` @ `7a8997c` — Paquete P5 opciones consumo (UAT VERDE)
- Smokes: `scripts/smoke/med-*.mjs` (clasificación, junta, vencimiento, rechazo MDC)
- Seed Art. 14: `applied-ids.json` en `docs/v2/seeds/p4_art14/`
- Deploy piloto bandeja P0/P2/P3: hosting + callables `listarArticulosLicenciaMedicaAuditor`, `previsualizarClasificacionMedicaAuditor` (ver handoff pausa)

## Oleada UI bandeja auditor — **UAT VERDE 2026-07-03**

| Entregable | Estado código | UAT |
|------------|---------------|-----|
| P0 visor certificado | `master` + hosting | ✅ |
| P2 selector artículo imputado | `master` | ✅ |
| P3 preview tramos/consumo + historial LM | `master` | ✅ |
| P2b fechas editables + preview en vivo | `master` @ `ac2adba` | ✅ smoke integración |
| P1 ficha `ingreso_medico` | `master` @ `72e5a87` + callable listado | ✅ `sol_01KWM0R9KMDEJ7ZKS416H5FSGR` |
| Cierre formal acta | Smoke PASS | **Pendiente firma RRHH** |

Documentación de continuidad:

- [`HANDOFF_SESION_2026-07-03_CIERRE_UAT_P4_V2.md`](./HANDOFF_SESION_2026-07-03_CIERRE_UAT_P4_V2.md) — **SSoT cierre**
- [`BRECHAS_FUNCIONALES_BANDEJA_AUDITOR_MEDICA_P4_V2.md`](./BRECHAS_FUNCIONALES_BANDEJA_AUDITOR_MEDICA_P4_V2.md)
- [`CHECKLIST_REUNION_RRHH_P4.md`](./CHECKLIST_REUNION_RRHH_P4.md) — **guion demo / prep-kit reunión RRHH**
- [`HANDOFF_SESION_2026-07-03_SMOKE_INTEGRACION_AUDITOR_MEDICO.md`](./HANDOFF_SESION_2026-07-03_SMOKE_INTEGRACION_AUDITOR_MEDICO.md) — **smoke integración P0/P1/P2b**
- [`HANDOFF_SESION_2026-07-02_PAUSA_BANDEJA_AUDITOR_P4_V2.md`](./HANDOFF_SESION_2026-07-02_PAUSA_BANDEJA_AUDITOR_P4_V2.md) — histórico pausa

Soporte operativo piloto: `scripts/inspect-solicitud.mjs` (local, no versionado por defecto).

## Firmas

| Rol | Nombre | Fecha |
|-----|--------|-------|
| RRHH | | |
| Medicina laboral / auditoría | | |
| Producto / desarrollo | | |
