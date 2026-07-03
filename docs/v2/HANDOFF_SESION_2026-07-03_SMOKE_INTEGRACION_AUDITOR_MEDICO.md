# Handoff — Smoke integración bandeja auditoría médica (P0 + P1 + P2b)

> **Fecha:** 2026-07-03  
> **Piloto:** `portal-hospital-v2` · https://portal-hospital-v2.web.app  
> **Rama `master`:** `72e5a87` (`feat(1919): p1 ficha ingreso agente en bandeja auditor medica`)  
> **Titular UAT:** MOSTO — `per_01KQN9WXFXF69Z9DCT5YNJ3TFZ` · DNI 28914247  
> **Veredicto smoke:** **PASS** (con nota P2b trazabilidad Firestore en caso pre-deploy)

---

## Alcance validado

| Oleada | Entregable | Estado |
|--------|------------|--------|
| **P0** | Visor PDF certificado en bandeja | ✅ UAT previo + hosting |
| **P1** | `ficha_ingreso_agente` (contacto + clínica + contexto) | ✅ UAT 2026-07-03 |
| **P2b** | Fechas editables, preview en vivo, `fechas_corregidas_por_auditor` | ✅ UAT UI + tests core |

---

## Checklist smoke integración (Caja Negra)

| # | Escenario | Evidencia | Resultado |
|---|-----------|-----------|-----------|
| 1 | **Integridad P1** — ficha sin consola | `sol_01KWM0R9KMDEJ7ZKS416H5FSGR` pendiente; DTO mapper: tel `3466004444`, email, domicilio, síntomas `sss`; UI bandeja (captura UAT) | **PASS** |
| 2 | **Edición P2b** — banner + preview 60% | UAT visual sesión: acortamiento fechas + recálculo tramos; tests `clasificarSolicitudMedicaAuditorCore` 5/5 | **PASS** |
| 3 | **Dictamen favorable ≤15 d** | `sol_01KWKVW4SED7ETGKPDMB61ES8Q` → `cfg_esa_aprobada`, `fecha_desde/hasta` 2026-07-20..21; vis `LM` + `cfg_esa_aprobada` día 20/07 | **PASS** |
| 4 | **Derivación junta >15 d** | `sol_01KWKTC9BD5BJQ37TMAGADN1XR` → auditor `requiere_junta_medica: true`, 32 d; junta favorable → `cfg_esa_aprobada`; vis día 23/07 consolidado | **PASS** |
| 5 | **Dictamen junta desfavorable** | `sol_01448C1850AA72A73CED4C2C65` → `cfg_esa_rechazada`, `junta_medica_dictamen.dictamen_favorable: false`; sin evento `sol_*` en vis muestra (REVERTIR) | **PASS** |
| 6 | **Trazabilidad Firestore P2b** | `sol_01KWM0R9KMDEJ7ZKS416H5FSGR` dictamen post-deploy: `fechas_corregidas_por_auditor: true` (estimado 22/07 → dictamen 21/07). Ver [`EVIDENCIA_P2B_DICTAMEN_2026-07-03.md`](./EVIDENCIA_P2B_DICTAMEN_2026-07-03.md) | **PASS** |

---

## Casos de referencia

| `solicitud_id` | Rol en smoke |
|----------------|--------------|
| `sol_01KWM0R9KMDEJ7ZKS416H5FSGR` | P1 + **P2b trazabilidad** — aprobada 21/07 con flag auditor |
| `sol_01KWKVW4SED7ETGKPDMB61ES8Q` | P2b + aprobación corta (2 d editados) |
| `sol_01KWKTC9BD5BJQ37TMAGADN1XR` | Derivación junta + cierre favorable (32 d) |
| `sol_01448C1850AA72A73CED4C2C65` | Junta desfavorable + grilla sin proyección |

---

## Automatización ejecutada

```bash
node --test functions/test/solicitudBandejaAuditorMedicaCore.test.js \
              functions/test/clasificarSolicitudMedicaAuditorCore.test.js \
              functions/test/solicitudResumenGrillaCore.test.js \
              web/src/features/solicitudes/fichaIngresoAgenteUi.test.js
# → 20/20 PASS

node scripts/smoke/med-clasificar-junta.mjs --dry-run --solicitud=sol_01KWM0R9KMDEJ7ZKS416H5FSGR
# → dry-run OK
```

---

## Deploy piloto (sesión)

| Recurso | Estado |
|---------|--------|
| `listarSolicitudesBandejaAuditorMedica` | Desplegado (P1 DTO) |
| Hosting `portal-hospital-v2.web.app` | Desplegado @ `72e5a87` (P1 UI + fix modal grilla) |
| `clasificarSolicitudMedicaAuditor` (P2b flag) | Desplegado 2026-07-03 |

---

## Recomendación RRHH

1. **Firmar acta** [`ACTA_RRHH_EPICA_1919_P4_V2.md`](./ACTA_RRHH_EPICA_1919_P4_V2.md) con P0/P1/P2b en bandeja auditor.
2. **Siguiente loop:** smoke RRHH presencial **o** P4.3b historial normativo en bandeja si piden más contexto acumulado sin abrir preview.

---

## Firmas acta express

| Rol | Nombre | Fecha |
|-----|--------|-------|
| RRHH | | |
| Medicina laboral | | |
| Producto / desarrollo | | |
