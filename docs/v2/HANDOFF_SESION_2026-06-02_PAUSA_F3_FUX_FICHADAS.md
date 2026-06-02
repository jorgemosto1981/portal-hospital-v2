# Handoff — Pausa implementación F3 + F-UX.2 (fichadas esperadas)

> **Fecha pausa:** 2026-06-02  
> **Rama:** `feat/epic-multi-hlg-fase1-execution`  
> **Producción:** https://portal-hospital-v2.web.app  
> **Punto de retomo:** [`PENDIENTES_PROXIMA_SESION.md`](./PENDIENTES_PROXIMA_SESION.md) § PAUSA

---

## 1. Objetivo de la sesión (cerrado en este handoff)

Cerrar el tramo **F3 backend parcial** (segmentos, materialización día, fichadas esperadas) y **F-UX.2** (mostrar `fichadas_esperadas` en grilla operativa), con deploy a prod y validación visual del usuario (**F:2** OK).

---

## 2. Qué se implementó (detalle)

### 2.1 F1 / GSO (sesión previa + cierre QA)

| Ítem | Archivos / artefacto | Estado |
|------|----------------------|--------|
| Purge HLg post-deshabilitar (corte inclusivo capa, exclusivo operativo grilla) | `purgeCapaTeoricaGdtRango.js`, `catalogosLaborales.js` (`rrhhDeshabilitarHlg`), `resolveHastaPurgeTrasDeshabilitarHlg` | ✅ Prod |
| Script purge con `--apply` | `scripts/audit-purge-hlg-post-corte.mjs` | ✅ Ejecutado Portería MOSTO 01–13/06 |
| QA B1–B5 GSO RRHH | Acta en `HANDOFF_SESION_2026-06-01_PAUSA_GSO_CIERRE_PERIODO.md` | ✅ |
| Smoke F1 D2 | `scripts/smoke-f1-qa-4-2-prod.mjs` (SKIP sin HLg activa) | ✅ |

### 2.2 F3 — T-02 Contrato segmentos

| Ítem | Detalle |
|------|---------|
| Schema Zod web | `web/src/schemas/capaTeoricaSegmentos.schema.js` |
| Contrato functions | `functions/modules/asistencia/schemas/capaTeoricaSegmentos.contract.js` |
| Golden + tests | `functions/test/capaTeoricaSegmentos.contract.test.mjs`, `functions/test/fixtures/capaTeoricaSegmentos.golden.json` |
| Comando | `npm run test:segmentos-contract` → 6/6 |

### 2.3 F3 — T-03 Materialización día + segmentos

| Ítem | Detalle |
|------|---------|
| Worker segmentado | `functions/modules/asistencia/capaTeoricaSegmentosCore.js` |
| Materialización mes/día | `functions/modules/asistencia/rdaTurnoTeoricoWorker.js` |
| Smoke integración | `scripts/smoke-materializar-turno-dia-dev.mjs` (modo seguro: **no** muta `tipo_patron` fijo salvo `--force-mutate-regimen`) |
| Validación vis fichadas | Smoke valida `vis_*.fichadas_esperadas === capa.fichadas_esperadas` |

**IDs piloto smoke (Dev/prod Firestore):**

| Rol | persona_id | DNI |
|-----|------------|-----|
| MOSTO (XX) | `per_01KQN9WXFXF69Z9DCT5YNJ3TFZ` | 28914247 |
| LOKITO (YY) | `per_01KQQJA5Q1VKBTJ74RHQ0HSHSB` | 12345678 |

| Grupo | gdt_id |
|-------|--------|
| Oficina PERSONAL | `gdt_01KR3H81ENQK84ZK21EQWEQQXG` |
| Sala Internación 1 | `gdt_01KQA6QCA8TDQK9YBTHKYA4R2V` |
| Portería | `gdt_01KQA9FVEW53JSNTPGX32NWQ5B` |

### 2.4 F3 — T-04 Cobertura + materializar día afectado

| Ítem | Detalle |
|------|---------|
| `materializarDiaAfectado` | `functions/modules/asistencia/cambiosTurno.js` (origen + cobertura, scoped `gdt`, sin rematerializar mes entero) |
| Freeze período cerrado | `scripts/smoke-outbox-freeze-dev.mjs` → `ASI-PER-001` junio 2026 Oficina |

### 2.5 F3 — T-08 Fichadas esperadas

| Ítem | Detalle |
|------|---------|
| Fórmula | `fichadas_esperadas = 2 × bloques_continuos_ejecutante + Σ extras` (`EXPECTATIVAS_FICHADA_SALIDA_MOMENTANEA_V2.md`) |
| Export cálculo | `calcularFichadasEsperadas` en `capaTeoricaSegmentosCore.js` |
| Tests | `functions/test/fichadasEsperadas.test.js` |
| Smoke fórmula | `scripts/smoke-fichadas-esperadas-dev.mjs` (A=2, B=4, C=6) |
| Comandos | `npm run test:fichadas-esperadas`, `npm run smoke:fichadas-esperadas` |

### 2.6 F-UX.2 — UI grilla (fichadas en celda)

| Ítem | Archivo |
|------|---------|
| Badge **F:n** | `web/src/features/grilla/GrillaFichadasEsperadasBadge.jsx` |
| Helpers | `web/src/features/grilla/grillaFichadasEsperadasDisplay.js` |
| Grilla equipo | `GrillaMesEquipoTabla.jsx` |
| Calendario titular | `GrillaMesTitularCalendario.jsx` |
| Modal día | `DiaGrillaDetalleModal.jsx` ("Fichadas esperadas: N") |
| Plan aprobado | `PlanGrillaAprobadaTable.jsx` |
| Leyenda GSO | `GrillaMesLicenciasPanel.jsx` |

### 2.7 Backend — proyección `vis_*`

Al materializar (mes o día), cada celda en `vistas_grilla_mes_agente.dias[dd]` incluye:

- `fichadas_esperadas` (número, alineado a capa teórica del `gdt`)

**Fix crítico (fijo/rotativo):** si el día tiene horario (`rda_ingreso`/`rda_egreso`) pero el régimen no resuelve `turno_id` en catálogo, el worker genera **segmento fallback** desde horario para que no quede `fichadas_esperadas: 0` con jornada visible.

- Helper: `buildSegmentosHorarioFallback` en `rdaTurnoTeoricoWorker.js`
- Validación prod: MOSTO Oficina `2026-06-16` → `fichadas_esperadas: 2` tras rematerializar

### 2.8 Deploy producción (esta sesión)

| Capa | Comando | Notas |
|------|---------|-------|
| Functions | `npm run firebase:deploy:functions` | 2 deploys en sesión (fichadas en vis + fallback fijo/rotativo); 429 con reintentos |
| Hosting | `npm run build:web` + `npx firebase deploy --project portal-hospital-v2 --only hosting` | UI badge F:n |

### 2.9 Validación final usuario

- **F:2** en grilla/modal: **OK** (planificado, fijo, rotativo tras fix + rematerialización donde aplicaba).
- Casos con **0** fichadas (sin jornada propia, cobertura cedida, NL): coherente; badge no se muestra (`F:n` solo si `n >= 1`).

---

## 3. Qué NO se hizo (pendiente explícito)

### 3.1 F3 — tickets abiertos

| Ticket | Título | Pendiente |
|--------|--------|-----------|
| **T-05** | Grilla selector dinámico (editor mensual) | Segmentos en UI editor; sin legacy monolítico |
| **T-06** | Bandeja + ayuda | `HelpContext`, guías |
| **T-07** | Lecturas vis_* + caché catálogo | Optimización lectura; sin outbox |
| **T-09** | Guías + helpContent | Docs UX |

### 3.2 F3 — cierre épica turnos compuestos

- [ ] Piloto **nocturno/compuesto** (M+T+N) en un `gdt` real con validación RRHH en grilla mes completo.
- [ ] **Release notes** épica turnos compuestos.
- [ ] **Tag** (criterio: T-08 probado + notas — T-08 y F-UX.2 fichadas ya validados; falta piloto + tag formal).

### 3.3 F-UX.2 — matriz capas (parcial)

| Ítem | Estado |
|------|--------|
| UX-5 menú jefe `/portal/jefe/grilla-operativa` | Verificar en otra PC si ya estaba en rama |
| UX-6 sin `fichadas_reales` para jefe en API | **Pendiente auditoría** callables/GSO |
| UX-7 helpContent “qué ve el jefe” | Pendiente |

### 3.4 F1 / producto

- Paso 4 QA formal matriz §4.2 biblia Multi-HLG (ítems residuales).
- PR merge `feat/epic-multi-hlg-fase1-execution` → `master` (decisión equipo).
- **No mezclar** `feat/epic-turno-mensual-fase2-pr3` sin decisión explícita.

### 3.5 Deuda técnica / ops

- Rematerializar meses ya materializados **antes** del deploy de `fichadas_esperadas` en `vis_*` (solo días con jornada que sigan en 0 en modal).
- Script útil: `node scripts/_tmp-materializar-dia-y-leer-vis.mjs --persona=... --gdt=... --fecha=YYYY-MM-DD`
- Considerar renombrar script sin prefijo `_tmp` en próxima sesión.
- `scripts/_tmp-qa-b-gso-estados.mjs`: auxiliar QA; no obligatorio en prod.

---

## 4. Reglas de negocio recordatorio (fichadas + grilla)

1. **Grilla operativa** = verdad actualizada; sin HLg activa al **cierre del mes** → sin dotación (ej. Portería mayo sin HLg al 31/05).
2. **Deshabilitar HLg:** corte **inclusivo** en capa/imputación; **exclusivo** en dotación operativa desde corte; purge no pisa HLg activa posterior (`resolveHastaPurgeTrasDeshabilitarHlg`).
3. **`fichadas_esperadas`:** por **bloques continuos** del ejecutante en `segmentos[]`; cobertura parcial puede dejar titular en 0 y cobertura en 2.
4. **Smokes:** no usar `--force-mutate-regimen` en prod; régimen fijo del piloto fue revertido por usuario tras incidente smoke.

---

## 5. Comandos — otra PC

```bash
git pull origin feat/epic-multi-hlg-fase1-execution
npm install
# Copiar manualmente .env.v2.local (NO está en git)

npm run test:segmentos-contract
npm run test:fichadas-esperadas
npm run smoke:fichadas-esperadas

# Opcional integración Firestore (requiere GAC):
node scripts/smoke-materializar-turno-dia-dev.mjs --apply --persona-origen=per_01KQQJA5Q1VKBTJ74RHQ0HSHSB --fecha=2026-06-09
node scripts/_tmp-materializar-dia-y-leer-vis.mjs --persona=per_01KQN9WXFXF69Z9DCT5YNJ3TFZ --gdt=gdt_01KR3H81ENQK84ZK21EQWEQQXG --fecha=2026-06-16
```

Deploy (solo si hubo cambios locales sin desplegar):

```bash
npm run firebase:deploy:functions
npm run build:web
npx firebase deploy --project portal-hospital-v2 --only hosting
```

---

## 6. Archivos clave tocados en esta pausa

| Área | Ruta |
|------|------|
| Worker materialización | `functions/modules/asistencia/rdaTurnoTeoricoWorker.js` |
| Segmentos + fichadas | `functions/modules/asistencia/capaTeoricaSegmentosCore.js` |
| Cambio turno / día | `functions/modules/asistencia/cambiosTurno.js` |
| Purge HLg | `functions/modules/asistencia/purgeCapaTeoricaGdtRango.js` |
| UI grilla | `web/src/features/grilla/*` (badge, tablas, modal) |
| Tests | `functions/test/fichadasEsperadas.test.js`, `capaTeoricaSegmentos.contract.test.mjs` |
| Smokes | `scripts/smoke-fichadas-esperadas-dev.mjs`, `smoke-materializar-turno-dia-dev.mjs` |
| Roadmap | `docs/v2/ROADMAP_IMPLEMENTACION_SUCESIVA_V2.md` |

---

## 7. Próxima sesión — orden sugerido

1. `git pull` + `.env.v2.local` + `npm install`.
2. Confirmar prod sigue mostrando **F:2** en caso piloto (Oficina jun-2026).
3. **F3 cierre:** piloto nocturno/compuesto un `gdt` + release notes + tag.
4. **UX-6:** revisar que jefe no reciba `fichadas_reales` por API.
5. PR/merge épica Multi-HLG cuando RRHH apruebe acta formal.

---

*Documento generado al pausar implementación post-validación F:2.*
