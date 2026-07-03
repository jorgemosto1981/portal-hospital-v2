# Handoff — Smoke integración bandeja auditoría médica (P0 + P1 + P2b + P4.3b)

> **Fecha:** 2026-07-03 (actualizado P4.3b)  
> **Piloto:** `portal-hospital-v2` · https://portal-hospital-v2.web.app  
> **Rama `master`:** `2704ff2` (`feat(1919): implementar historial LM lazy-load en FichaIngresoAgente`)  
> **Titular UAT:** MOSTO — `per_01KQN9WXFXF69Z9DCT5YNJ3TFZ` · DNI 28914247  
> **Veredicto smoke:** **PASS** (P0–P2b documentado; **P4.3b UAT flash PASS** 2026-07-03)

---

## Alcance validado

| Oleada | Entregable | Estado |
|--------|------------|--------|
| **P0** | Visor PDF certificado en bandeja | ✅ UAT previo + hosting |
| **P1** | `ficha_ingreso_agente` (contacto + clínica + contexto) | ✅ UAT 2026-07-03 |
| **P2b** | Fechas editables, preview en vivo, `fechas_corregidas_por_auditor` | ✅ UAT UI + tests core |
| **P4.3b** | Historial LM inline en ficha (lazy-load, últimos 5, overflow 25) | ✅ UAT flash 2026-07-03 |

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
| 7 | **P4.3b historial inline** — lazy-load + datos | Piloto MOSTO: acordeón en ficha; 5 ítems; casos `sol_01KWM0R9KMDEJ7ZKS416H5FSGR`, `sol_01KWKVW4SED7ETGKPDMB61ES8Q`, `sol_01KWKTC9BD5BJQ37TMAGADN1XR` visibles; solicitud en curso excluida; callable solo al expandir (captura UAT) | **PASS** |

---

## UAT flash P4.3b (2026-07-03)

**Contexto:** solicitud pendiente MOSTO con reposo estimado 29/08/2026; ficha P1 con tel `3466004444`, email `anysan015@hotmail.com`, domicilio IRIGOYEN 511.

**Validado en UI piloto:**

| Criterio | Resultado |
|----------|-----------|
| Acordeón *Historial reciente de licencias médicas* renderiza sin error | ✅ |
| Lazy-load (fetch al expandir, no en carga inicial) | ✅ |
| Contador badge = 5 | ✅ |
| Ítems históricos incluyen smoke refs KWM0 / KWKV / KWKT | ✅ |
| Badges estado *Aprobada* (verde) en historial MOSTO | ✅ |
| Solicitud abierta en bandeja **no** duplicada en lista | ✅ |

**Automatización (repo):**

```bash
node --test functions/test/historialLmTitularBandejaAuditorCore.test.js   # 4/4 PASS
node --test web/src/features/solicitudes/historialLmBandejaAuditorUi.test.js  # 3/3 PASS
node scripts/smoke/med-p43b-historial-flash.mjs   # requiere GOOGLE_APPLICATION_CREDENTIALS
```

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

node --test functions/test/historialLmTitularBandejaAuditorCore.test.js
# → 4/4 PASS (P4.3b)

node scripts/smoke/med-clasificar-junta.mjs --dry-run --solicitud=sol_01KWM0R9KMDEJ7ZKS416H5FSGR
# → dry-run OK
```

---

## Deploy piloto (sesión)

| Recurso | Estado |
|---------|--------|
| `listarSolicitudesBandejaAuditorMedica` | Desplegado (P1 DTO) |
| `clasificarSolicitudMedicaAuditor` (P2b flag) | Desplegado 2026-07-03 |
| `obtenerHistorialLmTitularBandejaAuditor` (P4.3b) | Desplegado 2026-07-03 |
| Hosting `portal-hospital-v2.web.app` | Desplegado @ `2704ff2` (P4.3b UI + rebuild `web/dist`) |

---

## Recomendación RRHH

1. **Firmar acta** [`ACTA_RRHH_EPICA_1919_P4_V2.md`](./ACTA_RRHH_EPICA_1919_P4_V2.md) con P0/P1/P2b/**P4.3b** en bandeja auditor.
2. **Demo sugerida:** abrir aviso pendiente MOSTO → ficha agente → expandir historial (ítem 7 checklist).
3. **Siguiente loop post-RRHH:** brechas bandeja (`BRECHAS_FUNCIONALES_BANDEJA_AUDITOR_MEDICA_P4_V2.md`) o motor P4 grilla según prioridad institucional.

---

## Firmas acta express

| Rol | Nombre | Fecha |
|-----|--------|-------|
| RRHH | | |
| Medicina laboral | | |
| Producto / desarrollo | | |
