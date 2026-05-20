# Handoff sesión 2026-05-20 — Oleada B MDC/RDA + validaciones Patrón B (PAUSA)

**Estado:** **PAUSA** — Oleada B **implementada y desplegada** en Firebase; Oleada A (bandejas TO-BE) **pendiente**.  
**Rama:** `feature/ticketera-puente-campos-config`  
**Commit de esta pausa:** (ver `git log -1` tras push)  
**Firebase:** `portal-hospital-v2` · Functions `southamerica-east1` · Firestore `southamerica-east1`

> **Retomar en la próxima sesión desde § 8** (primer paso concreto). Leer § 5 (qué ya corre en prod) antes de tocar código.

---

## 1. Piloto y evidencia Firestore

| Dato | Valor |
|------|--------|
| DNI habitual | `28914247` |
| Titular ejemplo | `per_01KQN9WXFXF69Z9DCT5YNJ3TFZ` |
| Artículos probados | `art_01KRNK10V10CH7W5M2W6V558GS` (64-A), `art_01KRYEX0JZY4Y8J1GY3Q9F8BJQ` (64-B) |

### Solicitudes de prueba (sesión 20-may)

| `sol_id` | Fecha | Artículo | Flujo validado |
|----------|-------|----------|----------------|
| `sol_01KS3RSD7T3RXBB6N6HQ0MGQGA` | 2026-05-20 | 64-A | Alta **sin** MDC (pre-deploy) |
| `sol_01KS3TFHE1DWVPXB0E3V1TA64P` | 2026-05-20 | 64-A | Alta + jefe + RRHH → `asi_*` / `vis_*` |
| `sol_01KS3VY4XP0S786GRY5GGZM17J` | 2026-05-21 | 64-B | MDC 3 pasos + `AUTORIZADO_JEFE` + consolidación |
| (superposición) | mismo día | — | Bloqueo `SUPERPOSICION_FECHAS` **OK** post-deploy |

### IDs RDA esperados

| Día | `asistencia_diaria` | `vistas_grilla_mes_agente` |
|-----|---------------------|----------------------------|
| 2026-05-20 | `asi_per_01KQN9WXFXF69Z9DCT5YNJ3TFZ_20260520` | `vis_2026_05_per_01KQN9WXFXF69Z9DCT5YNJ3TFZ` → clave día `20` |
| 2026-05-21 | `asi_per_01KQN9WXFXF69Z9DCT5YNJ3TFZ_20260521` | misma `vis_*` → clave día `21` |

---

## 2. Qué se implementó en código (esta sesión)

### 2.1 Oleada B — MDC emisor + worker

| Módulo | Rol |
|--------|-----|
| `functions/modules/shared/mdcComandosConstants.js` | Comandos y colecciones |
| `functions/modules/shared/mdcRdaDocumentIds.js` | `asi_<per>_YYYYMMDD`, `vis_YYYY_MM_per_<ULID>` |
| `functions/modules/shared/mdcWorkerCore.js` | `PROYECTAR_PENDIENTE`, `AUTORIZAR_JEFE`, `CONSOLIDAR_APROBADO`, `REVERTIR_PROYECCION` |
| `functions/modules/shared/mdcFanOutVis.js` | Fan-out `vistas_grilla_mes_agente` |
| `functions/modules/shared/mdcTicketeraEmisor.js` | Emisor async + flags `mdc_*` en `sol_*` |
| `functions/modules/shared/mdcGrillaHorariaGate.js` | Gate `depende_rda` (plan / `capa_teorica`) |
| `functions/modules/shared/mdcVersionEnriquecimiento.js` | `version_id_aplicada` desde versión cfg |
| `functions/modules/shared/mdcVisConflictoDia.js` | `tiene_conflicto` real (multievento) |
| `functions/onCall/solicitudes/reprocesarMdcSolicitudPatronB.js` | Backfill / prueba |

**Cableado:**

- `functions/triggers/solicitudArticuloPatronBOnCreate.js` → `PROYECTAR_PENDIENTE` + `grupo_trabajo_id_ancla`
- `functions/modules/shared/solicitudBandejaJefeCore.js` → `AUTORIZAR_JEFE` al aprobar; `REVERTIR` al rechazar
- `functions/modules/shared/solicitudBandejaRrhhCore.js` → `CONSOLIDAR_APROBADO` al aprobar RRHH (sin cambio de estados MVP)

### 2.2 Validaciones Patrón B

| Regla | Archivo |
|-------|---------|
| Superposición `cfg_ps_bloqueante` | `patronBSuperposicionValidacion.js` + motor |
| Frecuencia mensual cuenta también `en_revision_rrhh` y `aprobada` | `solicitudPatronBAltaMotor.js` |
| Códigos `SUPERPOSICION_FECHAS`, `GRUPO_ANCLA_*`, `SIN_GRUPO_VIGENTE` | `shared/utils/solicitudElegibilidadLaboral.js` (sync → functions) |

### 2.3 Grupo de trabajo ancla (`grupo_trabajo_id_ancla`)

| Capa | Cambio |
|------|--------|
| Backend | `solicitudGrupoTrabajoAncla.js` — HLg vigentes en `fecha_desde` |
| Motor + trigger | Persisten `grupo_trabajo_id_ancla` en `sol_*` y aportes MDC |
| Callable | `resolverContextoLaboralSolicitud` → `grupos_trabajo_vigentes` |
| Web | Selector si >1 HLg; auto si uno; envío en `solicitudesArticuloV2Service.js` |

### 2.4 Documentación (sesiones previas en rama + anexo)

- [`RFC_TICKETERA_AUTORIZACION_TOMA_CONOCIMIENTO_V2.md`](./RFC_TICKETERA_AUTORIZACION_TOMA_CONOCIMIENTO_V2.md) — §7.4 fan-out, §15 D.O.D.
- [`ANEXO_ALINEACION_RDA_GEMINI_V6_A_V2.md`](./ANEXO_ALINEACION_RDA_GEMINI_V6_A_V2.md)
- [`PLAN_IMPLEMENTACION_RFC_AUTORIZACION_TICKETERA_V2.md`](./PLAN_IMPLEMENTACION_RFC_AUTORIZACION_TICKETERA_V2.md)

---

## 3. Cadena MDC desplegada (AS-IS runtime prod)

```text
Alta (trigger)     → PROYECTAR_PENDIENTE   → asi PENDIENTE_REVISION, vis naranja
Jefe aprueba       → AUTORIZAR_JEFE        → asi AUTORIZADO_JEFE, vis naranja + en_revision_rrhh
RRHH aprueba       → CONSOLIDAR_APROBADO   → asi codigo_grilla, vis azul, aprobada
Jefe/RRHH rechaza  → REVERTIR_PROYECCION   → limpia aporte y evento día
```

**Importante:** Estados de **solicitud** siguen siendo MVP de dos bandejas (`en_revision_rrhh` tras jefe). Solo la **proyección RDA** refleja el paso intermedio del jefe.

---

## 4. Functions desplegadas en `portal-hospital-v2` (20-may)

Despliegues puntuales exitivos (`Deploy complete`):

- `onSolicitudArticuloPatronBOnCreate`
- `previsualizarSolicitudPatronB`
- `resolverDecisionJefeSolicitud`
- `resolverDecisionRrhhSolicitud`
- `reprocesarMdcSolicitudPatronB`
- `resolverContextoLaboralSolicitud`

**Nota:** Un `firebase deploy --only functions` masivo falló con 409/429 (deploy concurrente); no es bloqueante si las anteriores están OK.

**Web:** cambios en `web/src/…` — **no** hay deploy Hosting en esta pausa; en otra PC: `cd web && npm run dev` (o build+deploy si aplica).

---

## 5. Huecos conocidos (no bloquean pausa)

| Hueco | Estado |
|-------|--------|
| `version_id_aplicada` en aportes viejos | Código listo; reprocesar o nueva solicitud |
| `tiene_conflicto` en `vis_*` viejos | Recalcula en próximo MDC; 1 evento/día → `false` |
| Oleada A bandejas TO-BE | **Pendiente** — jefe cierra a `aprobada`, RRHH solo TC |
| Bandeja jefe filtra por HLg, no por `grupo_trabajo_id_ancla` en doc | Mejora Oleada A |
| Reglas Firestore `asistencia_diaria` / `vis_*` | Sin rules cliente; Admin SDK en Functions |
| Epic P planificación / `capa_teorica` | Posteriores |

---

## 6. Comandos útiles (otra PC)

```powershell
git clone <repo-url>
cd portal-hospital-v2
git checkout feature/ticketera-puente-campos-config
git pull

cd web
npm install
npm run dev

# Reprocesar MDC (sesión Firebase + callable desplegado)
# { "solicitud_id": "sol_01KS3VY4XP0S786GRY5GGZM17J" }

# Deploy Functions (solo si cambiás código backend)
cd ..
firebase deploy --only functions:onSolicitudArticuloPatronBOnCreate,functions:previsualizarSolicitudPatronB,functions:resolverDecisionJefeSolicitud,functions:resolverDecisionRrhhSolicitud,functions:reprocesarMdcSolicitudPatronB,functions:resolverContextoLaboralSolicitud --project portal-hospital-v2
```

Variables: `.env` / `web/.env` según [`web/README`](../../web/README) o handoffs previos; Firebase CLI logueado al proyecto V2.

---

## 7. Configuración artículo relevante (superposición)

En versión publicada del artículo, bloque **Superposición y convivencia**:

| Campo | Valor típico piloto |
|-------|---------------------|
| `nivel_ocupacion_dia_id` | `cfg_nod_exclusivo` (Exclusivo día completo) |
| `politica_superposicion_id` | `cfg_ps_bloqueante` (Bloquea hasta resolución manual) |

Motor aplica bloqueo si ya hay solicitud activa o aporte en `asi_*` el mismo día.

---

## 8. Por dónde continuar (próxima sesión) — ORDEN EXACTO

### Paso 0 — Al abrir

1. Leer este handoff § 5 y § 8.
2. `git pull` en `feature/ticketera-puente-campos-config`.
3. Confirmar en consola Firebase que existen `asi_*` / `vis_*` del piloto.
4. Probar **una** alta nueva en web local: verificar `grupo_trabajo_id_ancla` en `sol_*` y `version_id_aplicada` en aporte.

### Paso 1 — Cerrar piloto Oleada B (opcional, ~30 min)

- [ ] Reprocesar `sol_01KS3VY4…` si falta `version_id_aplicada` en aporte.
- [ ] Confirmar `tiene_conflicto: false` en días 20 y 21 con un solo evento.
- [ ] Commit ya hecho en remoto; si hay cambios locales sin push, `git status`.

### Paso 2 — Oleada A autorización (prioridad producto RFC 19-may)

Seguir [`PLAN_IMPLEMENTACION_RFC_AUTORIZACION_TICKETERA_V2.md`](./PLAN_IMPLEMENTACION_RFC_AUTORIZACION_TICKETERA_V2.md) **Oleada A**:

1. `solicitudBandejaJefeCore`: aprobar → `cfg_esa_aprobada` (no `en_revision_rrhh`).
2. `solicitudBandejaRrhhCore`: toma de conocimiento (sin consolidación sustantiva duplicada).
3. MDC: `CONSOLIDAR_APROBADO` al **aprobar jefe** (ajustar emisor; RRHH solo actualiza TC si aplica).
4. Quitar bypass RRHH en listado bandeja jefe.
5. UI bandejas + evidencia [`TICKETERA_FASE3_EVIDENCIA_PILOTO.md`](./TICKETERA_FASE3_EVIDENCIA_PILOTO.md).

**No mezclar** con Epic planificación mensual (Gemini V6) en la misma sesión salvo spike documental.

### Paso 3 — Después de Oleada A

- Oleada C: rules índices GSO, consumo `vis_*`.
- Epic P: `planificacion_mensual_rotativa`, `capa_teorica`.

---

## 9. Archivos tocados (lista para review)

**Nuevos:** `mdc*.js`, `patronBSuperposicionValidacion.js`, `solicitudGrupoTrabajoAncla.js`, `reprocesarMdcSolicitudPatronB.js`, `ANEXO_ALINEACION_RDA_GEMINI_V6_A_V2.md`

**Modificados:** `solicitudPatronBAltaMotor.js`, `solicitudBandejaJefeCore.js`, `solicitudArticuloPatronBOnCreate.js`, `previsualizarSolicitudPatronB.js`, `resolverContextoLaboralSolicitud.js`, `functions/index.js`, `shared/utils/solicitudElegibilidadLaboral.js`, `web/…/useSolicitud64AAlta.js`, `SolicitudPatronBForm.jsx`, `solicitudesArticuloV2Service.js`, docs RFC/README/plan.

---

## 10. Transcript

Chat: `agent-transcripts/0f02d495-4de9-4c6c-91b8-622f7d19060c` (Cursor).

---

*Generado al cerrar sesión 2026-05-20 — pausa solicitada por usuario.*
