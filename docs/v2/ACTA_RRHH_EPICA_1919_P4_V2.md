# Acta RRHH — épica 1919, Bloque P4 (licencias médicas — Caja Negra, Art. 14 corta)

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

**Fuera de alcance (backlog P4.4):** Art. **16 / 19** licencia larga (`cfg_mlm_larga_episodio`, episodio/causal).

## Caso canónico UAT (piloto)

| Campo | Valor de referencia |
|-------|---------------------|
| Titular prueba | MOSTO, JORGE ANTONIO — DNI 28914247 |
| Solicitud LM | `sol_013EE8A16E710808627AC4DBA2` |
| Artículo Firestore | `art_01KWH4NM0BW4HKGGWV1NFD599K` (código **14**) |
| Flujo | Aviso completo → clasificación favorable **18 d** → junta favorable → `cfg_esa_aprobada` + `licencia_medica` + MDC `CONSOLIDAR_APROBADO` |
| Bandejas | Sale de auditoría y junta tras cierre; resumen grilla muestra **14 — ENFERMEDAD DE CORTA DURACION** |

**Nota datos piloto:** pueden existir avisos `SOL_MED_AVISO_V1` de prueba con `articulo_id` distinto del 14 (p. ej. chip «64-A» en grilla). No invalidan el caso canónico; saneamiento opcional en backlog.

## Criterios de aceptación RRHH (checklist)

- [ ] Agente puede dar aviso médico y completar incompleta dentro del plazo configurado.
- [ ] Auditor clasifica aviso completo; ≤15 días aprueba sin junta; >15 días deriva a junta.
- [ ] Junta emite dictamen favorable/desfavorable; desfavorable rechaza y revierte proyección en grilla.
- [ ] Grilla muestra licencia coherente con estado (LM / consolidación); sin etiqueta “pendiente clasificación” en solicitudes ya aprobadas.
- [ ] Enlace desde detalle de día no envía trámites médicos a bandeja jefe/RRHH genérica (portal médico o sin enlace si ya cerrado).
- [ ] RRHH acepta dejar **P4.4 largas** para oleada posterior tras merge a `master`.

## Transversal

| Tema | Decisión |
|------|----------|
| Circuito Art. 14 | `CFG_USUARIO`, `CFG_RRHH`, `CFG_MEDICO`, `CFG_VISUALIZADOR` |
| Aprobación sustantiva LM | Solo auditor / junta (no jefe ni TC RRHH como cierre médico) |
| Índices Firestore | Query bandejas por `estado_solicitud_id`; filtros finos en memoria (límite 400) en piloto |

## Evidencia técnica (repo)

- Rama: `feat/1919-p4-licencias-medicas`
- Smokes: `scripts/smoke/med-*.mjs` (clasificación, junta, vencimiento, rechazo MDC)
- Seed Art. 14: `applied-ids.json` en `docs/v2/seeds/p4_art14/`

## Firmas

| Rol | Nombre | Fecha |
|-----|--------|-------|
| RRHH | | |
| Medicina laboral / auditoría | | |
| Producto / desarrollo | | |
